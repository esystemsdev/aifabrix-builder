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
const { formatSuccessParagraph } = require('../utils/cli-test-layout-chalk');
const generator = require('../generator');
const logger = require('../utils/logger');
const { handleCommandError, logOfflinePathWhenType } = require('../utils/cli-utils');
const { detectAppType, getDeployJsonPath, getResolveAppPath } = require('../utils/paths');
const { setupResolveCommand } = require('./setup-utility-resolve');
const { setupRepairCommand } = require('./setup-utility-repair');
const { setupValidateDiffCommands } = require('./setup-utility-validate');
const { JSON_HELP_AFTER } = require('./setup-utility-help-after');

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
  logger.log(formatSuccessParagraph('Successfully split deployment JSON into component files:'));
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

function setupJsonCommand(program) {
  program.command('json <appKey|systemKey>')
    .description('Write deployment JSON to disk for version control')
    .addHelpText('after', JSON_HELP_AFTER)
    .action(async(appName, options) => {
      try {
        const resolved = await getResolveAppPath(appName);
        const { emitManifestMetadataLineIfTTY } = require('../utils/manifest-source-emit');
        emitManifestMetadataLineIfTTY(logger, {
          appKey: appName,
          appPath: resolved.appPath,
          envOnly: resolved.envOnly,
          json: false
        });
        const result = await generator.generateDeployJsonWithValidation(appName, options);
        if (result.success) {
          const fileName = result.path.includes('application-schema.json') ? 'application-schema.json' : 'deployment JSON';
          logger.log(`✔ Generated ${fileName}: ${result.path}`);
          if (result.validation.warnings && result.validation.warnings.length > 0) {
            logger.log('\n⚠  Warnings:');
            result.validation.warnings.forEach(w => logger.log(`   • ${w}`));
          }
        } else {
          logger.log('✖ Validation failed:');
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
  program.command('split-json <appKey|systemKey>')
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

async function resolveConvertTargetFormat(options) {
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
  return normalized;
}

function logConvertCommandResults(converted, deleted) {
  logger.log(formatSuccessParagraph('Convert complete.'));
  converted.forEach((p) => logger.log(`  • ${p}`));
  if (deleted.length > 0) {
    logger.log(chalk.gray('  Removed old files:'));
    deleted.forEach((p) => logger.log(chalk.gray(`    ${p}`)));
  }
}

async function runConvertCommandForApp(appName, options) {
  const normalized = await resolveConvertTargetFormat(options);
  const { isProtectionScope } = require('../protection/scope');
  if (isProtectionScope(appName)) {
    const { runConvertProtectionBatch } = require('../protection/convert-batch');
    const { converted, deleted } = await runConvertProtectionBatch(normalized, {
      force: options.force
    });
    logConvertCommandResults(converted, deleted);
    return;
  }
  const { runConvert } = require('../commands/convert');
  const { converted, deleted } = await runConvert(appName, { format: normalized, force: options.force });
  logConvertCommandResults(converted, deleted);
}

function setupConvertCommand(program) {
  program.command('convert <appKey|systemKey>')
    .description('Convert config files between JSON and YAML (builder/<appKey>/ or integration/<systemKey>/)')
    .option('--format <format>', 'Target format: json | yaml (required unless config format is set)')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async(appName, options) => {
      try {
        await runConvertCommandForApp(appName, options);
      } catch (error) {
        handleCommandError(error, 'convert');
        process.exit(1);
      }
    });
}

function setupShowCommand(program) {
  program.command('show <appKey|systemKey>')
    .description('Show builder app or external system from local tree (default) or controller (--online)')
    .option('--online', 'Fetch application data from the controller')
    .option('--json', 'Output as JSON')
    .option(
      '--verify-cert',
      'For external integrations, verify trust state on the dataplane when logged in (with --online uses current session; offline attempts the same if a controller URL is configured)'
    )
    .action(async(appKey, options) => {
      try {
        const { showApp } = require('../app/show');
        await showApp(appKey, {
          online: options.online,
          json: options.json,
          verifyCert: options.verifyCert === true
        });
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
