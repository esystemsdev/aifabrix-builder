/**
 * @fileoverview Run dataplane agent metadata validation for one datasource (404.5 / plan 143).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');
const { getConfig } = require('../core/config');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const { getSystemKeyFromAppKey } = require('./integration-context');
const { requireBearerForDataplanePipeline } = require('../utils/token-manager');
const { buildMinimalUploadSyncOptions } = require('../utils/upload-sync-options');
const { fetchTrustRunFromDataplane } = require('./agent-trust-fetch');

async function maybeSyncBeforeTrust({ noSync, authConfig, systemKey, options = {} }) {
  if (noSync === true) return;
  requireBearerForDataplanePipeline(authConfig);
  logger.log(chalk.cyan('Syncing local config to dataplane…'));
  const { uploadExternalSystem } = require('../commands/upload');
  await uploadExternalSystem(systemKey, buildMinimalUploadSyncOptions(options));
  logger.log(formatSuccessLine('Sync complete'));
}

function buildTransportFailureTrustRun(datasourceKey, systemKey, err) {
  return {
    datasourceKey,
    systemKey,
    status: 'fail',
    trustDecision: 'notTrusted',
    validationStatus: 'failed',
    confidence: 0,
    summary: err && err.message ? String(err.message) : 'Request failed',
    transportError: true
  };
}

/**
 * @async
 * @param {string} datasourceKey
 * @param {Object} options
 * @returns {Promise<{ trustRun: Object, apiError: Object|null }>}
 */
async function runDatasourceAgentTrust(datasourceKey, options = {}) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  const systemKey = await getSystemKeyFromAppKey(appKey);

  let authConfig = options.authConfig;
  let dataplaneUrl = options.dataplaneUrl || options.dataplane;
  if (!authConfig || !dataplaneUrl) {
    const configObj = await getConfig();
    const auth = await setupIntegrationTestAuth(
      appKey,
      { environment: options.environment, dataplane: options.dataplane },
      configObj
    );
    authConfig = auth.authConfig;
    dataplaneUrl = auth.dataplaneUrl;
  }

  await maybeSyncBeforeTrust({
    noSync: options.noSync === true,
    authConfig,
    systemKey,
    options
  });

  try {
    const trustRun = await fetchTrustRunFromDataplane({
      datasourceKey,
      systemKey,
      dataplaneUrl,
      authConfig,
      options
    });
    return { trustRun, apiError: null };
  } catch (err) {
    return {
      trustRun: buildTransportFailureTrustRun(datasourceKey, systemKey, err),
      apiError: err
    };
  }
}

module.exports = {
  runDatasourceAgentTrust,
  maybeSyncBeforeTrust
};
