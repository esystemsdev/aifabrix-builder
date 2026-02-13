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
const { detectAppType, getDeployJsonPath } = require('../utils/paths');

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
    logger.log(`  • rbac.yml: ${result.rbac}`);
  }
  logger.log(`  • README.md: ${result.readme}`);
}

function setupResolveCommand(program) {
  program.command('resolve <app>')
    .description('Generate .env file from template and validate application files')
    .option('-f, --force', 'Generate missing secret keys in secrets file')
    .option('--skip-validation', 'Skip file validation after generating .env')
    .action(async(appName, options) => {
      try {
        const envPath = await secrets.generateEnvFile(appName, undefined, 'docker', options.force);
        logger.log(`✓ Generated .env file: ${envPath}`);
        if (!options.skipValidation) {
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
    .description('Generate deployment JSON to disk (<app>-deploy.json). Use before commit so version control has the correct file.')
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

function setupSplitJsonConvertShowCommands(program) {
  program.command('split-json <app>')
    .description('Split deployment JSON into component files (env.template, application.yaml, rbac.yml, README.md)')
    .option('-o, --output <dir>', 'Output directory for component files (defaults to same directory as JSON)')
    .action(async(appName, options) => {
      try {
        logSplitJsonResult(await handleSplitJsonCommand(appName, options));
      } catch (error) {
        handleCommandError(error, 'split-json');
        process.exit(1);
      }
    });

  program.command('convert <app>')
    .description('Convert integration/external system and datasource config files between JSON and YAML')
    .option('--format <format>', 'Target format: json | yaml (required)')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async(appName, options) => {
      try {
        const { runConvert } = require('../commands/convert');
        const { converted, deleted } = await runConvert(appName, { format: options.format, force: options.force });
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

  program.command('show <appKey>')
    .description('Show application info from local builder/ or integration/ (offline) or from controller (--online)')
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

function setupValidateDiffCommands(program) {
  program.command('validate <appOrFile>')
    .description('Validate application or external integration file')
    .action(async(appOrFile, options) => {
      try {
        const validate = require('../validation/validate');
        const result = await validate.validateAppOrFile(appOrFile, options);
        validate.displayValidationResults(result);
        if (!result.valid) process.exit(1);
      } catch (error) {
        handleCommandError(error, 'validate');
        process.exit(1);
      }
    });

  program.command('diff <file1> <file2>')
    .description('Compare two configuration files (for deployment pipeline)')
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

module.exports = { setupUtilityCommands };
