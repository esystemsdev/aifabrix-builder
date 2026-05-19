/**
 * @fileoverview test-trust <systemKey> — semantic agent metadata validation for all datasources.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { cliOptsSkipSync } = require('../utils/cli-sync-options');
const { getConfig } = require('../core/config');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { runDatasourceAgentTrust } = require('../datasource/agent-trust-run');
const { resolveExternalIntegrationContext } = require('./test-e2e-external');

async function syncLocalIfRequested(systemKey, options) {
  if (cliOptsSkipSync(options)) return;
  const { uploadExternalSystem } = require('./upload');
  logger.log(chalk.cyan('Syncing local config to dataplane…'));
  await uploadExternalSystem(systemKey, { minimal: true, verbose: !!options.verbose });
  logger.log(chalk.green('✔ Sync complete'));
}

function pushTrustResult(results, key, trustRun, apiError) {
  const failed =
    apiError ||
    !trustRun ||
    trustRun.trustDecision === 'notTrusted' ||
    trustRun.validationStatus === 'failed';
  results.push({
    key,
    success: !failed,
    error: failed
      ? apiError
        ? apiError.message || String(apiError)
        : trustRun.summary || 'Trust validation failed'
      : undefined,
    trustRun
  });
}

/**
 * @async
 * @param {string} externalSystem
 * @param {Object} options
 * @returns {Promise<{ success: boolean, results: Array<Object>, systemKey: string }>}
 */
async function runTestTrustForExternalSystem(externalSystem, options = {}) {
  const { systemKey, keys } = resolveExternalIntegrationContext(externalSystem);
  if (keys.length === 0) {
    logger.log(chalk.yellow(`No datasources found for ${externalSystem}.`));
    return { success: true, results: [], systemKey };
  }

  await syncLocalIfRequested(systemKey, options);

  if (options.revalidate === true) {
    logger.log(chalk.cyan('Forcing revalidation (cache bypass) for each datasource…'));
  }

  const configObj = await getConfig();
  const { authConfig, dataplaneUrl } = await setupIntegrationTestAuth(
    externalSystem,
    { environment: options.env },
    configObj
  );

  const results = [];
  const runOpts = {
    app: externalSystem,
    environment: options.env,
    noSync: true,
    revalidate: options.revalidate === true,
    summary: options.summary === true,
    timeout: options.timeout,
    authConfig,
    dataplaneUrl
  };
  for (const key of keys) {
    try {
      const { trustRun, apiError } = await runDatasourceAgentTrust(key, runOpts);
      pushTrustResult(results, key, trustRun, apiError);
    } catch (err) {
      results.push({ key, success: false, error: err.message, trustRun: null });
    }
  }
  return { success: results.every(r => r.success), results, systemKey };
}

module.exports = {
  runTestTrustForExternalSystem
};
