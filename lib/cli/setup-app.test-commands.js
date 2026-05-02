/**
 * @fileoverview CLI test/install/lint command setup (builder app + external integration dispatch).
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { cliOptsSkipCertSync } = require('../certification/cli-cert-sync-skip');
const { TEST_HELP_AFTER, TEST_E2E_HELP_AFTER } = require('./setup-app.help');

function setupTestCommand(program) {
  program.command('test <app>')
    .description('Tests: builder in container; external = local validation')
    .option('-e, --env <env>', 'For builder app: dev (running container) or tst (ephemeral)', 'dev')
    .option('-v, --verbose', 'Verbose output')
    .option('-d, --debug', 'Write debug log to integration/<systemKey>/logs/ (external only)')
    .option(
      '--sync',
      'Not supported for this command (local validation only). Use aifabrix upload <systemKey> or dataplane test commands with --sync.'
    )
    .addHelpText('after', TEST_HELP_AFTER)
    .action(async(appName, options, cmd) => {
      try {
        const rawArgs = Array.isArray(cmd?.rawArgs) ? cmd.rawArgs : [];
        const envExplicit = rawArgs.includes('-e') || rawArgs.includes('--env');
        const pathsUtil = require('../utils/paths');
        const appType = await pathsUtil.detectAppType(appName).catch(() => null);
        if (options.sync === true) {
          throw new Error(
            'Option --sync is not supported for aifabrix test (local or container runs do not publish to the dataplane). ' +
              'Use: aifabrix upload <systemKey>, then aifabrix test-integration <systemKey> --sync or aifabrix datasource test-integration <datasourceKey> --sync.'
          );
        }
        if (appType && appType.baseDir === 'integration') {
          const test = require('../external-system/test');
          const externalOpts = {
            ...options,
            // Keep help default but don't override auth/env behavior unless user explicitly set it.
            env: envExplicit ? options.env : undefined
          };
          const results = await test.testExternalSystem(appName, externalOpts);
          test.displayTestResults(results, options.verbose, appName);
          if (!results.valid) process.exit(1);
          return;
        }
        const { runAppTest } = require('../commands/app-test');
        await runAppTest(appName, { env: options.env });
      } catch (error) {
        handleCommandError(error, 'test');
        process.exit(1);
      }
    });
}

/**
 * First failed `certificateIssuance` across E2E datasource rows (for cert-sync hint).
 * @param {Array<{ key?: string, datasourceTestRun?: { certificateIssuance?: { status?: string, reasonCode?: string, message?: string } } }>} results
 * @returns {string|null}
 */
function firstIssuanceFailureHintFromE2eResults(results) {
  const failed = [];
  for (const row of results || []) {
    const ci = row.datasourceTestRun && row.datasourceTestRun.certificateIssuance;
    if (ci && ci.status === 'failed') {
      failed.push({ key: row.key, ci });
    }
  }
  if (failed.length === 0) return null;
  const firstRc = failed[0].ci.reasonCode;
  const sameAll = failed.every(f => f.ci.reasonCode === firstRc);
  if (sameAll && failed.length > 1) {
    const parts = [firstRc, failed[0].ci.message].filter(Boolean);
    return `${parts.join(': ')} (${failed.length} datasource scopes; first: ${failed[0].key})`;
  }
  const parts = [failed[0].ci.reasonCode, failed[0].ci.message].filter(Boolean);
  return `[${failed[0].key}] ${parts.join(': ')}`.trim();
}

/**
 * External integration E2E: run, display, exit on aggregate, optional cert sync.
 * @param {string} appName
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function runExternalIntegrationE2EAndCertSync(appName, options) {
  const { runTestE2EForExternalSystem } = require('../commands/test-e2e-external');
  const { success, results } = await runTestE2EForExternalSystem(appName, {
    env: options.env,
    debug: options.debug,
    verbose: options.verbose,
    async: options.async !== false,
    sync: options.sync === true
  });
  const { displayIntegrationTestResults } = require('../utils/external-system-display');
  const datasourceResults = results.map(r => ({
    key: r.key,
    success: r.success,
    error: r.error,
    skipped: false,
    datasourceTestRun: r.datasourceTestRun
  }));
  displayIntegrationTestResults(
    { systemKey: appName, success, datasourceResults },
    options.verbose,
    { debug: options.debug, runType: 'e2e' }
  );
  const { computeSystemExitCodeFromDatasourceRows } = require('../utils/datasource-test-run-exit');
  const exitCode = computeSystemExitCodeFromDatasourceRows(datasourceResults, {
    warningsAsErrors: options.warningsAsErrors === true,
    requireCert: options.requireCert === true
  });
  if (exitCode !== 0) process.exit(exitCode);
  if (cliOptsSkipCertSync(options)) return;
  const { trySyncCertificationFromDataplaneForExternalApp } = require('../certification/sync-after-external-command');
  const issuanceFailureHint = firstIssuanceFailureHintFromE2eResults(results);
  await trySyncCertificationFromDataplaneForExternalApp(appName, 'test-e2e', { issuanceFailureHint });
}

async function runTestE2ECommand(appName, options) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(appName).catch(() => null);
  if (options.sync === true && appType && appType.baseDir === 'builder') {
    throw new Error(
      'Option --sync applies only to external integration E2E (integration/<systemKey>/). ' +
        'Remove --sync for builder app E2E, or use aifabrix upload from the integration folder first.'
    );
  }
  if (appType && appType.baseDir === 'integration') {
    await runExternalIntegrationE2EAndCertSync(appName, options);
    return;
  }
  const { runAppTestE2e } = require('../commands/app-test');
  await runAppTestE2e(appName, { env: options.env });
}

function setupInstallCommand(program) {
  program.command('install <app>')
    .description('Install deps in container (builder apps only)')
    .option('--env <env>', 'dev (running container) or tst (ephemeral with .env)', 'dev')
    .action(async(appName, options) => {
      try {
        const pathsUtil = require('../utils/paths');
        const appType = await pathsUtil.detectAppType(appName).catch(() => null);
        if (appType && appType.baseDir === 'integration') {
          logger.log(
            chalk.gray('Install is for builder applications only. Use aifabrix shell <app> to run commands in external setups.')
          );
          return;
        }
        const { runAppInstall } = require('../commands/app-install');
        await runAppInstall(appName, { env: options.env });
      } catch (error) {
        handleCommandError(error, 'install');
        process.exit(1);
      }
    });
}

function setupTestE2eCommand(program) {
  program.command('test-e2e <app>')
    .description('E2E: builder in container; external = all datasources via dataplane')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro (builder: dev/tst for container)', 'dev')
    .option('-v, --verbose', 'Show detailed step output and poll progress')
    .option('-d, --debug', 'Include debug output and write log to integration/<systemKey>/logs/')
    .option(
      '--sync',
      'Publish local system and datasource files to the dataplane before running E2E (same as aifabrix upload <systemKey>; external integration only)'
    )
    .option('--warnings-as-errors', 'Treat aggregate warn as failure (exit 1)')
    .option('--require-cert', 'Require certification passed on every datasource (exit 2 if not)')
    .option(
      '--no-cert-sync',
      'Skip updating the system file certification block from the dataplane after a successful run'
    )
    .addHelpText('after', TEST_E2E_HELP_AFTER)
    .action(async(appName, options, cmd) => {
      try {
        const rawArgs = Array.isArray(cmd?.rawArgs) ? cmd.rawArgs : [];
        const envExplicit = rawArgs.includes('-e') || rawArgs.includes('--env');
        const externalOpts = {
          ...options,
          env: envExplicit ? options.env : undefined,
          async: true // system-level command surface omits --no-async; always poll for completeness
        };
        await runTestE2ECommand(appName, externalOpts);
      } catch (error) {
        handleCommandError(error, 'test-e2e');
        process.exit(1);
      }
    });
}

function setupLintCommand(program) {
  program.command('lint <app>')
    .description('Lint in container (builder apps only)')
    .option('--env <env>', 'dev (running container) or tst (ephemeral with .env)', 'dev')
    .action(async(appName, options) => {
      try {
        const pathsUtil = require('../utils/paths');
        const appType = await pathsUtil.detectAppType(appName).catch(() => null);
        if (appType && appType.baseDir === 'integration') {
          logger.log(chalk.gray('lint is for builder applications only. Use aifabrix shell <app> then make lint or pnpm lint.'));
          return;
        }
        const { runAppLint } = require('../commands/app-test');
        await runAppLint(appName, { env: options.env });
      } catch (error) {
        handleCommandError(error, 'lint');
        process.exit(1);
      }
    });
}

function setupInstallTestE2eLintCommands(program) {
  setupInstallCommand(program);
  setupTestCommand(program);
  setupTestE2eCommand(program);
  setupLintCommand(program);
}

module.exports = {
  setupInstallTestE2eLintCommands,
  firstIssuanceFailureHintFromE2eResults
};

