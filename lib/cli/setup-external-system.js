/**
 * CLI external system command setup (download, delete, test, test-integration).
 *
 * @fileoverview External system command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleCommandError } = require('../utils/cli-utils');

function setupDownloadCommand(program) {
  program.command('download <system-key>')
    .description('Download external system from dataplane to local development structure')
    .option('--dry-run', 'Show what would be downloaded without actually downloading')
    .action(async(systemKey, options) => {
      try {
        const download = require('../external-system/download');
        await download.downloadExternalSystem(systemKey, options);
      } catch (error) {
        handleCommandError(error, 'download');
        process.exit(1);
      }
    });
}

function setupUploadCommand(program) {
  program.command('upload <system-key>')
    .description('Upload external system to dataplane (upload → validate → publish; no controller deploy)')
    .option('--dry-run', 'Validate and build payload only; no API calls')
    .option('--dataplane <url>', 'Dataplane URL (default: discovered from controller)')
    .action(async(systemKey, options) => {
      try {
        const upload = require('../commands/upload');
        await upload.uploadExternalSystem(systemKey, options);
      } catch (error) {
        handleCommandError(error, 'upload');
        process.exit(1);
      }
    });
}

function setupDeleteCommand(program) {
  program.command('delete <system-key>')
    .description('Delete external system from dataplane (also deletes all associated datasources)')
    .option('--type <type>', 'Application type (default: external; use "external" to target integration/<app>)')
    .option('--yes', 'Skip confirmation prompt')
    .option('--force', 'Skip confirmation prompt (alias for --yes)')
    .action(async(systemKey, options) => {
      try {
        const externalDelete = require('../external-system/delete');
        await externalDelete.deleteExternalSystem(systemKey, options);
      } catch (error) {
        handleCommandError(error, 'delete');
        process.exit(1);
      }
    });
}

/**
 * Try to run builder-style test integration when app is not in builder or has no externalIntegration.
 * @param {string} appName - App or system key
 * @param {Object} options - CLI options
 * @returns {Promise<boolean>} True if builder test was run, false otherwise
 */
async function tryBuilderTestIntegration(appName, options) {
  const fsSync = require('fs');
  const pathsUtil = require('../utils/paths');
  const { getIntegrationPath, getBuilderPath } = pathsUtil;
  const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
  const { loadConfigFile } = require('../utils/config-format');
  const integrationPath = getIntegrationPath(appName);
  let hasExternalIntegration = false;
  try {
    const integrationConfig = loadConfigFile(resolveApplicationConfigPath(integrationPath));
    hasExternalIntegration = !!(integrationConfig && integrationConfig.externalIntegration);
  } catch {
    // integration path or config missing
  }
  if (!hasExternalIntegration) {
    const builderPath = getBuilderPath(appName);
    const builderConfigPath = resolveApplicationConfigPath(builderPath);
    if (fsSync.existsSync(builderPath) && fsSync.existsSync(builderConfigPath)) {
      const { runAppTestIntegration } = require('../commands/app-test');
      const opts = { env: options.env || options.environment || 'dev' };
      await runAppTestIntegration(appName, opts);
      return true;
    }
  }
  return false;
}

/**
 * Run external system integration test via dataplane and exit on failure.
 * @param {string} appName - App or system key
 * @param {Object} options - CLI options
 * @returns {Promise<void>}
 */
async function runExternalSystemTestIntegration(appName, options) {
  const test = require('../external-system/test');
  const opts = { ...options, environment: options.env || options.environment, debug: options.debug };
  const results = await test.testExternalSystemIntegration(appName, opts);
  test.displayIntegrationTestResults(results, options.verbose);
  if (!results.success) process.exit(1);
}

/**
 * Run test-integration command: builder app in container or external system via dataplane.
 * @param {string} appName - App or system key
 * @param {Object} options - CLI options (datasource, payload, env, verbose, timeout)
 * @returns {Promise<void>}
 */
async function runTestIntegrationCommand(appName, options) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(appName).catch(() => null);
  if (appType && appType.baseDir === 'builder') {
    const { runAppTestIntegration } = require('../commands/app-test');
    const opts = { env: options.env || options.environment || 'dev' };
    await runAppTestIntegration(appName, opts);
    return;
  }
  const ranBuilder = await tryBuilderTestIntegration(appName, options);
  if (ranBuilder) return;
  await runExternalSystemTestIntegration(appName, options);
}

function setupExternalSystemTestCommands(program) {
  // 'test <app>' is registered in setup-app.js and dispatches by app type (builder vs external)
  program.command('test-integration <app>')
    .description('Run integration tests (builder/docker app: in container; external system: via dataplane pipeline API)')
    .option('-d, --datasource <key>', 'Test specific datasource only')
    .option('-p, --payload <file>', 'Path to custom test payload file')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro (default: from aifabrix auth config)')
    .option('-v, --verbose', 'Show detailed test output')
    .option('--debug', 'Include debug output and write log to integration/<app>/logs/')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
    .action(async(appName, options) => {
      try {
        await runTestIntegrationCommand(appName, options);
      } catch (error) {
        handleCommandError(error, 'test-integration');
        process.exit(1);
      }
    });
}

/**
 * Sets up external system commands
 * @param {Command} program - Commander program instance
 */
function setupExternalSystemCommands(program) {
  setupDownloadCommand(program);
  setupUploadCommand(program);
  setupDeleteCommand(program);
  setupExternalSystemTestCommands(program);
}

module.exports = { setupExternalSystemCommands };
