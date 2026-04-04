/**
 * CLI utility command setup (resolve, json, split-json, show, validate, diff).
 *
 * @fileoverview Utility command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const secrets = require('../core/secrets');
const generator = require('../generator');
const logger = require('../utils/logger');
const { handleCommandError, logOfflinePathWhenType } = require('../utils/cli-utils');
const { detectAppType, getDeployJsonPath, getResolveAppPath } = require('../utils/paths');

const JSON_HELP_AFTER = `
Example:
  $ aifabrix json myapp
Generates *-deploy.json (or application-schema.json) for commit before deploy.
`;

const VALIDATE_HELP_AFTER = `
Examples:
  $ aifabrix validate myapp
  $ aifabrix validate --integration
  $ aifabrix validate --builder
`;

/**
 * Resolve app path and type for split-json (integration first, then builder).
 *
 * @param {string} appName - Application name
 * @param {Object} [_options] - Command options (reserved)
 * @returns {Promise<{appPath: string, appType: string}>}
 */
async function resolveSplitJsonApp(appName, _options) {
  const { appPath, appType } = await detectAppType(appName);
  return { appPath, appType };
}

/**
 * Handles split-json command logic
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Paths to generated files
 */
async function handleSplitJsonCommand(appName, options) {
  const { appPath, appType } = await resolveSplitJsonApp(appName, options);
  logOfflinePathWhenType(appPath);

  const outputDir = options.output || appPath;
  if (appType === 'external') {
    const deployJsonPath = getDeployJsonPath(appName, 'external', true);
    if (fs.existsSync(deployJsonPath)) {
      return generator.splitDeployJson(deployJsonPath, outputDir);
    }
    const schemaPath = path.join(appPath, 'application-schema.json');
    if (fs.existsSync(schemaPath)) {
      return generator.splitExternalApplicationSchema(schemaPath, outputDir);
    }
    throw new Error(
      `No deployment or schema file found. Expected one of:\n  • ${deployJsonPath}\n  • ${schemaPath}\n\nRun "aifabrix json ${appName}" to generate the deploy JSON, or provide application-schema.json.`
    );
  }

  const deployJsonPath = getDeployJsonPath(appName, appType, true);
  if (!fs.existsSync(deployJsonPath)) {
    throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
  }

  return generator.splitDeployJson(deployJsonPath, outputDir);
}

/**
 * Logs split-json results
 * @param {Object} result - Generated file paths
 * @returns {void}
 */
function logSplitJsonResult(result) {
  logger.log(chalk.green('\n✓ Successfully split deployment JSON into component files:'));
  logger.log(`  • env.template: ${result.envTemplate}`);
  logger.log(`  • application.yaml: ${result.variables}`);
  if (result.systemFile) {
    logger.log(`  • system: ${result.systemFile}`);
  }
  if (result.datasourceFiles && result.datasourceFiles.length > 0) {
    result.datasourceFiles.forEach(filePath => logger.log(`  • datasource: ${filePath}`));
  }
  if (result.rbac) {
    logger.log(`  • rbac.yaml: ${result.rbac}`);
  }
  if (result.readmeSkipped) {
    logger.log(`  • README.md: (kept existing) ${result.readmeSkipped}`);
  } else if (result.readme) {
    logger.log(`  • README.md: ${result.readme}`);
  }
}

function setupResolveCommand(program) {
  program.command('resolve <app>')
    .description('Generate .env from template; optional validate after')
    .option('-f, --force', 'Generate missing secret keys in secrets file')
    .option('--skip-validation', 'Skip file validation after generating .env')
    .action(async(appName, options) => {
      try {
        const { appPath, envOnly } = await getResolveAppPath(appName);
        const envPath = await secrets.generateEnvFile(
          appName,
          undefined,
          'docker',
          options.force,
          { appPath, envOnly, skipOutputPath: false, preserveFromPath: null }
        );
        logger.log(`✓ Generated .env file: ${envPath}`);
        if (envOnly) {
          logger.log(chalk.gray('  (env-only mode: validation skipped; no application.yaml)'));
        } else if (!options.skipValidation) {
          const validate = require('../validation/validate');
          const result = await validate.validateAppOrFile(appName);
          validate.displayValidationResults(result);
          if (!result.valid) {
            logger.log(chalk.yellow('\n⚠️  Validation found errors. Fix them before deploying.'));
            process.exit(1);
          }
        }
      } catch (error) {
        handleCommandError(error, 'resolve');
        process.exit(1);
      }
    });
}

function setupJsonCommand(program) {
  program.command('json <app>')
    .description('Write deployment JSON to disk for version control')
    .addHelpText('after', JSON_HELP_AFTER)
    .action(async(appName, options) => {
      try {
        const result = await generator.generateDeployJsonWithValidation(appName, options);
        if (result.success) {
          const fileName = result.path.includes('application-schema.json') ? 'application-schema.json' : 'deployment JSON';
          logger.log(`✓ Generated ${fileName}: ${result.path}`);
          if (result.validation.warnings && result.validation.warnings.length > 0) {
            logger.log('\n⚠️  Warnings:');
            result.validation.warnings.forEach(w => logger.log(`   • ${w}`));
          }
        } else {
          logger.log('❌ Validation failed:');
          (result.validation.errors || []).forEach(e => logger.log(`   • ${e}`));
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'json');
        process.exit(1);
      }
    });
}

function setupSplitJsonCommand(program) {
  program.command('split-json <app>')
    .description('Split deploy JSON into env.template, application.yaml, rbac, README, …')
    .option('-o, --output <dir>', 'Output directory for component files (defaults to same directory as JSON)')
    .action(async(appName, options) => {
      try {
        logSplitJsonResult(await handleSplitJsonCommand(appName, options));
      } catch (error) {
        handleCommandError(error, 'split-json');
        process.exit(1);
      }
    });
}

function setupRepairCommand(program) {
  program.command('repair <systemKey>')
    .description('Fix external integration drift (files, RBAC, manifest, …)')
    .option('--auth <method>', 'Set authentication method (oauth2, aad, apikey, basic, queryParam, oidc, hmac, none); updates system file and env.template')
    .option('--doc', 'Regenerate README.md from deployment manifest')
    .option('--dry-run', 'Report changes only; do not write')
    .option('--rbac', 'Ensure RBAC permissions per datasource and add default Admin/Reader roles if none exist')
    .option('--expose', 'Set exposed.schema on each datasource from all fieldMappings.attributes keys (metadata.<key>); removes deprecated exposed.attributes if present')
    .option('--sync', 'Add default sync section to datasources that lack it')
    .option('--test', 'Generate testPayload.payloadTemplate and testPayload.expectedResult from attributes')
    .action(async(appName, options) => {
      try {
        const { repairExternalIntegration } = require('../commands/repair');
        const { detectAppType } = require('../utils/paths');
        const { appPath } = await detectAppType(appName);
        logOfflinePathWhenType(appPath);
        let format = 'yaml';
        try {
          const config = require('../core/config');
          format = (await config.getFormat()) || format;
        } catch (_) {
          // use default yaml when config unavailable
        }
        const result = await repairExternalIntegration(appName, {
          auth: options.auth,
          doc: options.doc,
          dryRun: options.dryRun,
          format,
          rbac: options.rbac,
          expose: options.expose,
          sync: options.sync,
          test: options.test
        });
        if (options.dryRun && result.updated && result.changes.length > 0) {
          logger.log(chalk.yellow('\nWould apply:'));
          result.changes.forEach(c => logger.log(chalk.gray(`  ${c}`)));
        } else if (result.updated) {
          logger.log(chalk.green('\n✓ Repaired external integration config.'));
        } else if (result.readmeRegenerated) {
          logger.log(chalk.green('\n✓ Regenerated README.md from deployment manifest.'));
        } else {
          logger.log(chalk.gray('No changes needed; config already matches files on disk.'));
        }
      } catch (error) {
        handleCommandError(error, 'repair');
        process.exit(1);
      }
    });
}

function setupConvertCommand(program) {
  program.command('convert <app>')
    .description('Convert integration config files between JSON and YAML')
    .option('--format <format>', 'Target format: json | yaml (required unless config format is set)')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async(appName, options) => {
      try {
        const config = require('../core/config');
        const effectiveFormat = options.format || (await config.getFormat());
        if (!effectiveFormat) {
          throw new Error(
            'Option --format is required and must be \'json\' or \'yaml\' (or set default with aifabrix dev set-format)'
          );
        }
        const normalized = effectiveFormat.trim().toLowerCase();
        if (normalized !== 'json' && normalized !== 'yaml') {
          throw new Error('Option --format must be \'json\' or \'yaml\'');
        }
        const { runConvert } = require('../commands/convert');
        const { converted, deleted } = await runConvert(appName, { format: normalized, force: options.force });
        logger.log(chalk.green('\n✓ Convert complete.'));
        converted.forEach(p => logger.log(`  • ${p}`));
        if (deleted.length > 0) {
          logger.log(chalk.gray('  Removed old files:'));
          deleted.forEach(p => logger.log(chalk.gray(`    ${p}`)));
        }
      } catch (error) {
        handleCommandError(error, 'convert');
        process.exit(1);
      }
    });
}

function setupShowCommand(program) {
  program.command('show <app>')
    .description('Show app from local tree (default) or controller (--online)')
    .option('--online', 'Fetch application data from the controller')
    .option('--json', 'Output as JSON')
    .action(async(appKey, options) => {
      try {
        const { showApp } = require('../app/show');
        await showApp(appKey, { online: options.online, json: options.json });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function setupSplitJsonConvertShowCommands(program) {
  setupSplitJsonCommand(program);
  setupRepairCommand(program);
  setupConvertCommand(program);
  setupShowCommand(program);
}

async function runValidateCommand(appOrFile, options) {
  const validate = require('../validation/validate');
  const opts = options.opts ? options.opts() : options;
  const integration = opts.integration === true;
  const builder = opts.builder === true;
  const outFormat = (opts.format || 'default').toLowerCase();

  if (integration || builder) {
    const batchResult = integration && builder
      ? await validate.validateAll(opts)
      : integration
        ? await validate.validateAllIntegrations(opts)
        : await validate.validateAllBuilderApps(opts);
    if (outFormat === 'json') {
      logger.log(JSON.stringify(batchResult, null, 2));
    } else {
      validate.displayBatchValidationResults(batchResult);
    }
    if (!batchResult.valid) process.exit(1);
    return;
  }

  if (!appOrFile || typeof appOrFile !== 'string') {
    logger.log(chalk.red('App name or file path is required, or use --integration / --builder'));
    process.exit(1);
  }

  const result = await validate.validateAppOrFile(appOrFile, opts);
  if (outFormat === 'json') {
    logger.log(JSON.stringify(result, null, 2));
  } else {
    validate.displayValidationResults(result);
  }
  if (!result.valid) process.exit(1);
}

function setupValidateDiffCommands(program) {
  program.command('validate [appOrFile]')
    .description('Validate one app/file or all under integration/ or builder/')
    .addHelpText('after', VALIDATE_HELP_AFTER)
    .option('--format <format>', 'Output format: json | default (human-readable)')
    .option('--integration', 'Validate all applications under integration/')
    .option('--builder', 'Validate all applications under builder/')
    .action((appOrFile, options) => {
      runValidateCommand(appOrFile, options).catch((error) => {
        handleCommandError(error, 'validate');
        process.exit(1);
      });
    });

  program.command('diff <file1> <file2>')
    .description('Diff two config files (optional schema validate)')
    .option('--no-validate', 'Skip schema validation (type check still applied)')
    .action(async(file1, file2, cmd) => {
      try {
        const diff = require('../core/diff');
        const opts = cmd.opts();
        const result = await diff.compareFiles(file1, file2, { validate: opts.validate !== false });
        diff.formatDiffOutput(result);
        if (!result.identical) process.exit(1);
      } catch (error) {
        handleCommandError(error, 'diff');
        process.exit(1);
      }
    });
}

/**
 * Sets up utility commands
 * @param {Command} program - Commander program instance
 */
function setupUtilityCommands(program) {
  setupResolveCommand(program);
  setupJsonCommand(program);
  setupSplitJsonConvertShowCommands(program);
  setupValidateDiffCommands(program);
}

module.exports = {
  setupUtilityCommands,
  resolveSplitJsonApp,
  handleSplitJsonCommand
};
