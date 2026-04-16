/**
 * CLI external system command setup (download, upload, delete, test-integration).
 *
 * Registers these commands on the Commander program:
 * - download <systemKey> – Download external system from dataplane to integration/<systemKey>/
 * - upload <systemKey> – Upload publishes to dataplane and registers the app with the controller (draft)
 * - delete <systemKey> – Delete external system and associated datasources from dataplane
 * - test-integration <app> – Run integration tests (builder: in container; external: via dataplane pipeline)
 *
 * @fileoverview External system command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 * @see docs/commands/external-integration.md - User-facing command reference
 * @see docs/external-systems.md - External systems guide and workflow
 */

const { handleCommandError } = require('../utils/cli-utils');
const { TEST_INTEGRATION_HELP_AFTER } = require('./setup-app.help');

function setupDownloadCommand(program) {
  program.command('download <systemKey>')
    .description('Pull external system from dataplane into integration/<key>/')
    .option('--format <format>', 'Output format: json | yaml (default: yaml or config format)')
    .option('--dry-run', 'Show what would be downloaded without actually downloading')
    .option('--force', 'Overwrite existing README.md without prompting')
    .action(async(systemKey, options) => {
      try {
        const config = require('../core/config');
        const effectiveFormat = (options.format || (await config.getFormat()) || 'yaml').trim().toLowerCase();
        if (effectiveFormat !== 'json' && effectiveFormat !== 'yaml') {
          throw new Error('Option --format must be \'json\' or \'yaml\'');
        }
        const download = require('../external-system/download');
        await download.downloadExternalSystem(systemKey, { ...options, format: effectiveFormat });
      } catch (error) {
        handleCommandError(error, 'download');
        process.exit(1);
      }
    });
}

function setupUploadCommand(program) {
  program.command('upload <systemKey>')
    .description('Validate, publish to dataplane, and register with controller (draft application)')
    .option('--dry-run', 'Validate and build payload only; no API calls')
    .option('-v, --verbose', 'Run server-side pipeline validate and print warnings before publish')
    .option('--probe', 'After publish, run dataplane runtime checks (validation/run); slower')
    .option('--minimal', 'Print only a short readiness summary after upload')
    .option('--probe-timeout <ms>', 'Timeout for --probe (default: 120000)', '120000')
    .action(async(systemKey, options) => {
      try {
        const upload = require('../commands/upload');
        const probeTimeout =
          options.probeTimeout === undefined || options.probeTimeout === null
            ? 120000
            : Number(options.probeTimeout);
        await upload.uploadExternalSystem(systemKey, {
          ...options,
          probeTimeout: Number.isFinite(probeTimeout) ? probeTimeout : 120000
        });
      } catch (error) {
        handleCommandError(error, 'upload');
        process.exit(1);
      }
    });
}

function setupDeleteCommand(program) {
  program.command('delete <systemKey>')
    .description('Remove external system and its datasources from dataplane')
    .option('--type <type>', 'Application type (default: external; use "external" to target integration/<systemKey>)')
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
  const opts = {
    ...options,
    environment: options.env || options.environment,
    debug: options.debug,
    perDatasource: options.perDatasource
  };
  const results = await test.testExternalSystemIntegration(appName, opts);
  test.displayIntegrationTestResults(results, options.verbose, { debug: options.debug, runType: 'integration' });
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
    .description('Integration tests: builder in container; external via dataplane')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro (builder: dev/tst for container)', 'dev')
    .option('-v, --verbose', 'Show detailed test output')
    .option('-d, --debug', 'Include debug output and write log to integration/<systemKey>/logs/')
    .addHelpText('after', TEST_INTEGRATION_HELP_AFTER)
    .action(async(appName, options, cmd) => {
      try {
        const rawArgs = Array.isArray(cmd?.rawArgs) ? cmd.rawArgs : [];
        const envExplicit = rawArgs.includes('-e') || rawArgs.includes('--env');
        const opts = {
          ...options,
          env: envExplicit ? options.env : undefined
        };
        await runTestIntegrationCommand(appName, opts);
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
