/**
 * @fileoverview CLI wiring for `datasource verify-trust` (404.5 / plan 143).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
const { runDatasourceAgentTrust } = require('../datasource/agent-trust-run');
const { writeTrustDebugLogAndPrint } = require('../datasource/agent-trust-debug-log');
const { displayAgentTrustRunTTY } = require('../utils/agent-trust-run-display');
const { computeExitCodeFromTrustRun } = require('../utils/agent-trust-run-exit');
const { attachDatasourceTestCommonOptions } = require('./datasource-unified-test-cli.options');
const { cliOptsSkipSync } = require('../utils/cli-sync-options');

function datasourceVerifyTrustHelpAfter() {
  return `
Examples:
  $ aifabrix datasource verify-trust hubspot-companies
  $ aifabrix datasource verify-trust hubspot-companies --app test-e2e-hubspot -v
  $ aifabrix datasource verify-trust hubspot-companies --revalidate --strict
  $ aifabrix verify-trust test-e2e-hubspot

Notes:
  - Semantic trust only (agent metadata validation). For live API proof use test-e2e.
  - Local files are published before run unless --no-sync.
  - With --debug, JSON is saved under integration/<app>/logs/ (verify-trust-<key>-*.json). View with: aifabrix datasource log-trust <key>
`;
}

async function runDatasourceVerifyTrustOnce(datasourceKey, options) {
  const { trustRun, apiError } = await runDatasourceAgentTrust(datasourceKey, {
    app: options.app,
    environment: options.env,
    noSync: options.noSync === true,
    force: options.force === true,
    revalidate: options.revalidate === true,
    summary: options.summary === true,
    timeout: options.timeout
  });
  return { trustRun, apiError };
}

async function finalizeDatasourceVerifyTrust(datasourceKey, options, result) {
  const displayOpts = {
    json: options.json,
    verbose: options.verbose,
    environment: options.env,
    noSync: options.noSync === true,
    strict: options.strict === true
  };
  if (options.json) {
    logger.log(JSON.stringify(result.trustRun, null, 2));
  } else if (options.summary) {
    const tr = result.trustRun;
    logger.log(
      `${tr.datasourceKey}: ${tr.trustDecision} (${tr.validationStatus}, ${Math.round((tr.confidence || 0) * 100)}%)`
    );
  } else {
    displayAgentTrustRunTTY(result.trustRun, displayOpts);
  }
  const exitOpts = {
    warningsAsErrors: options.warningsAsErrors === true,
    strict: options.strict === true
  };
  return computeExitCodeFromTrustRun(result.trustRun, exitOpts);
}

async function datasourceVerifyTrustAction(datasourceKey, options, cmd) {
  try {
    const merged = { ...options, noSync: cliOptsSkipSync(options, cmd) };
    const result = await runDatasourceVerifyTrustOnce(datasourceKey, merged);
    const { resolveAppKeyForDatasource } = require('../datasource/resolve-app');
    const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
    if (options.debug) {
      await writeTrustDebugLogAndPrint(appKey, datasourceKey, {
        request: { datasourceKey, revalidate: options.revalidate === true },
        response: result.trustRun,
        error: result.apiError ? result.apiError.message : null
      });
    }
    const exitCode = await finalizeDatasourceVerifyTrust(datasourceKey, merged, result);
    process.exit(exitCode);
  } catch (err) {
    logger.error(formatBlockingError('Agent trust validation failed:'), err.message);
    process.exit(3);
  }
}

function attachDatasourceTrustOptions(cmd) {
  attachDatasourceTestCommonOptions(cmd, {
    includeNoAsync: false,
    includePayload: false,
    timeoutHelp: 'HTTP timeout for validate request (ms)',
    timeoutDefault: '120000'
  });
  cmd
    .option('--no-sync', 'Skip publishing local integration files before validate')
    .option('--revalidate', 'Force new validation (ignore inputHash cache)')
    .option('--strict', 'Exit 1 unless trustDecision is trusted');
}

function setupDatasourceVerifyTrustCommand(datasource) {
  const cmd = datasource
    .command('verify-trust <datasourceKey>')
    .description('Semantic agent metadata validation for one datasource');
  attachDatasourceTrustOptions(cmd);
  cmd.addHelpText('after', datasourceVerifyTrustHelpAfter()).action(datasourceVerifyTrustAction);
}

module.exports = {
  setupDatasourceVerifyTrustCommand,
  runDatasourceVerifyTrustOnce,
  finalizeDatasourceVerifyTrust,
  datasourceVerifyTrustAction
};
