/**
 * @fileoverview verify-trust <systemKey> — semantic agent metadata validation for all datasources.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { getConfig } = require('../core/config');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { runDatasourceAgentTrust } = require('../datasource/agent-trust-run');
const {
  resolveExternalIntegrationContext,
  syncLocalIfRequested
} = require('./test-e2e-external');

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
 * @param {Object|null} uploadCtx
 * @param {string} externalSystem
 * @param {Object} options
 * @returns {Promise<{ authConfig: Object, dataplaneUrl: string }>}
 */
async function resolveTrustAuthContext(uploadCtx, externalSystem, options) {
  if (uploadCtx) {
    return { authConfig: uploadCtx.authConfig, dataplaneUrl: uploadCtx.dataplaneUrl };
  }
  const configObj = await getConfig();
  return setupIntegrationTestAuth(
    externalSystem,
    {
      environment: options.env,
      authConfig: options.authConfig,
      dataplaneUrl: options.dataplaneUrl,
      silentResolve: options.silentResolve === true
    },
    configObj
  );
}

/**
 * @async
 * @param {string[]} keys
 * @param {Object} runOpts
 * @param {Array<Object>} results
 */
async function runTrustForDatasourceKeys(keys, runOpts, results) {
  for (const key of keys) {
    try {
      const { trustRun, apiError } = await runDatasourceAgentTrust(key, runOpts);
      pushTrustResult(results, key, trustRun, apiError);
    } catch (err) {
      results.push({ key, success: false, error: err.message, trustRun: null });
    }
  }
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

  const uploadCtx = await syncLocalIfRequested(systemKey, options);
  if (uploadCtx?.authConfig && uploadCtx?.dataplaneUrl) {
    options.authConfig = uploadCtx.authConfig;
    options.dataplaneUrl = uploadCtx.dataplaneUrl;
    options.silentResolve = true;
  }
  if (options.revalidate === true) {
    logger.log(chalk.cyan('Forcing revalidation (cache bypass) for each datasource…'));
  }

  const { authConfig, dataplaneUrl } = await resolveTrustAuthContext(
    uploadCtx,
    externalSystem,
    options
  );
  const results = [];
  await runTrustForDatasourceKeys(
    keys,
    {
      app: externalSystem,
      environment: options.env,
      noSync: true,
      revalidate: options.revalidate === true,
      summary: options.summary === true,
      timeout: options.timeout,
      authConfig,
      dataplaneUrl
    },
    results
  );
  return { success: results.every(r => r.success), results, systemKey };
}

module.exports = {
  runTestTrustForExternalSystem
};
