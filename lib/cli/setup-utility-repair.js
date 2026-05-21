/**
 * `aifabrix repair` command wiring and CLI output (split from setup-utility for size limits).
 *
 * @fileoverview Repair CLI command
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { handleCommandError, logOfflinePathWhenType } = require('../utils/cli-utils');
const { detectAppType } = require('../utils/paths');
const { formatSuccessParagraph, formatWarningLine } = require('../utils/cli-test-layout-chalk');
const { REPAIR_HELP_AFTER } = require('./setup-utility-help-after');

/**
 * @param {string} appName
 * @param {object} options
 * @param {string} format
 * @returns {object}
 */
function buildRepairExternalIntegrationOptions(appName, options, format) {
  const all = options.all === true;
  return {
    auth: options.auth,
    doc: options.doc || all,
    dryRun: options.dryRun,
    format,
    rbac: options.rbac || all,
    expose: options.expose || all,
    sync: options.sync || all,
    api: options.api || all,
    test: options.test || all,
    backup: options.backup,
    noBackup: options.noBackup
  };
}

/**
 * @param {string[]} changedFiles
 * @param {boolean} dryRun
 */
function logRepairChangedFiles(changedFiles, dryRun) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return;
  const title = dryRun ? '\nWould change files:' : '\nChanged files:';
  logger.log(chalk.white(title));
  changedFiles.forEach((filePath) => logger.log(chalk.cyan(`  ${filePath}`)));
}

/**
 * @param {string[]} warnings
 */
function logRepairWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) return;
  warnings.forEach((msg) => logger.log(formatWarningLine(msg)));
}

/**
 * @param {string[]} changedFiles
 * @param {string[]} warnings
 */
function logRepairNextActions(changedFiles, warnings) {
  const hasFiles = Array.isArray(changedFiles) && changedFiles.length > 0;
  const hasWarnings = Array.isArray(warnings) && warnings.length > 0;
  if (!hasFiles && !hasWarnings) return;
  logger.log(chalk.white('\nNext actions:'));
  if (hasFiles) {
    logger.log(chalk.gray('  • Open the paths above in your editor and review the diff'));
    logger.log(chalk.gray('  • Run: aifabrix validate <systemKey>'));
  }
  if (hasWarnings) {
    logger.log(chalk.gray('  • Fix warnings in the system file (especially authentication.variables.testEndpoint)'));
    logger.log(chalk.gray('  • Run: aifabrix json <systemKey> && aifabrix upload <systemKey>'));
  }
}

/**
 * @param {object} options
 * @param {object} result
 * @param {string[]} changedFiles
 */
function logRepairDryRunOutcome(options, result, changedFiles) {
  logger.log(chalk.yellow('\nWould apply:'));
  result.changes.forEach((c) => logger.log(chalk.gray(`  ${c}`)));
  logRepairChangedFiles(changedFiles, true);
  logRepairWarnings(result.warnings);
  logRepairNextActions(changedFiles, result.warnings);
}

/**
 * @param {object} result
 * @param {string[]} changedFiles
 */
function logRepairSuccessOutcome(result, changedFiles) {
  if (result.updated) {
    logger.log(formatSuccessParagraph('Repaired external integration config.'));
    logRepairChangedFiles(changedFiles, false);
    logRepairNextActions(changedFiles, result.warnings);
    return;
  }
  if (Array.isArray(result.changes) && result.changes.length > 0) {
    logger.log(formatSuccessParagraph('Repair actions completed.'));
    result.changes.forEach((c) => logger.log(chalk.gray(`  ${c}`)));
    logRepairChangedFiles(changedFiles, false);
    logRepairNextActions(changedFiles, result.warnings);
    return;
  }
  if (result.readmeRegenerated) {
    logger.log(formatSuccessParagraph('Regenerated README.md from deployment manifest.'));
    return;
  }
  if (Array.isArray(result.warnings) && result.warnings.length > 0) {
    logRepairNextActions(changedFiles, result.warnings);
    return;
  }
  logger.log(chalk.gray('No changes needed; config already matches files on disk.'));
}

/**
 * @param {object} options
 * @param {object} result
 */
function logRepairResult(options, result) {
  const changedFiles = result.changedFiles;
  if (options.dryRun && result.updated && result.changes.length > 0) {
    logRepairDryRunOutcome(options, result, changedFiles);
    return;
  }
  if (Array.isArray(result.backupPaths) && result.backupPaths.length > 0) {
    result.backupPaths.forEach((p) => logger.log(chalk.gray(`Backup: ${p}`)));
  }
  logRepairWarnings(result.warnings);
  logRepairSuccessOutcome(result, changedFiles);
}

/**
 * @param {string} appName
 * @param {object} options
 * @returns {Promise<void>}
 */
async function handleRepairCommand(appName, options) {
  const { repairExternalIntegration } = require('../commands/repair');
  const { appPath } = await detectAppType(appName);
  logOfflinePathWhenType(appPath);
  let format = 'yaml';
  try {
    const config = require('../core/config');
    format = (await config.getFormat()) || format;
  } catch (_) {
    /* default yaml when config unavailable */
  }
  const result = await repairExternalIntegration(
    appName,
    buildRepairExternalIntegrationOptions(appName, options, format)
  );
  logRepairResult(options, result);
}

/**
 * @param {import('commander').Command} program
 */
function setupRepairCommand(program) {
  program.command('repair <systemKey>')
    .description('Fix external integration drift (files, RBAC, manifest, …)')
    .option('--all', 'Run all repair actions (api, doc, expose, rbac, sync, test)')
    .option(
      '--api',
      'Validate and sync API contracts needed for OpenAPI/MCP (uses local OpenAPI specs at integration/<systemKey>/openapi/*.json when present)'
    )
    .option(
      '--auth <method>',
      'Set authentication method (oauth2, aad, apikey, bearerKey, basic, queryParam, oidc, hmac, none); updates system file and env.template'
    )
    .option('--doc', 'Regenerate README.md from deployment manifest')
    .option('--expose', 'Set exposed.schema on each datasource from all fieldMappings.attributes keys (metadata.<key>); removes deprecated exposed.attributes if present')
    .option('--rbac', 'Ensure RBAC permissions per datasource and add default Admin/Reader roles if none exist')
    .option('--sync', 'Add default sync section to datasources that lack it')
    .option('--test', 'Generate testPayload.payloadTemplate and testPayload.expectedResult from attributes')
    .option('--no-backup', 'Skip timestamped copies under integration/<systemKey>/backup/')
    .option('--dry-run', 'Report changes only; do not write')
    .addHelpText('after', REPAIR_HELP_AFTER)
    .action(async(appName, options) => {
      try {
        await handleRepairCommand(appName, options);
      } catch (error) {
        handleCommandError(error, 'repair');
        process.exit(1);
      }
    });
}

module.exports = {
  setupRepairCommand,
  buildRepairExternalIntegrationOptions,
  logRepairResult
};
