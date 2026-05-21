/**
 * @fileoverview Dataplane fetch paths for agent trust runs (POST validate / GET latest).
 */

'use strict';

const {
  runAgentMetadataValidation,
  getLatestAgentMetadataValidation
} = require('../api/agent-metadata-validation.api');
const { parseTrustTimeoutMs } = require('./agent-trust-timeout');
const { isAgentTrustMockEnabled, buildMockTrustRun } = require('./agent-trust-mock');
const { mapRunResponseToTrustRun, mapLatestResultToTrustRun } = require('./agent-trust-map');
const {
  runWithAgentTrustWaitSpinner,
  logAgentTrustWaitHintOnce
} = require('../utils/agent-trust-wait-ui');

function unwrapApiData(response) {
  if (response && response.data !== undefined) return response.data;
  return response;
}

/**
 * @param {Object} options
 * @returns {boolean}
 */
function shouldPreferLatestRead(options = {}) {
  if (options.revalidate === true) return false;
  return options.summary === true;
}

/**
 * @param {Error} err
 * @returns {boolean}
 */
function isLatestNotFoundError(err) {
  const code = err && (err.statusCode || err.status);
  if (code === 404) return true;
  const msg = err && err.message ? String(err.message) : '';
  return /no agent metadata validation/i.test(msg);
}

/**
 * @async
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function postValidateTrustRun(params) {
  const { dataplaneUrl, datasourceKey, systemKey, authConfig, body, options } = params;
  const timeoutMs = parseTrustTimeoutMs(options);
  logAgentTrustWaitHintOnce(datasourceKey, timeoutMs);
  const raw = await runWithAgentTrustWaitSpinner(
    () =>
      runAgentMetadataValidation(dataplaneUrl, datasourceKey, authConfig, body, { timeoutMs }),
    { datasourceKey, timeoutMs }
  );
  return mapRunResponseToTrustRun({
    datasourceKey,
    systemKey,
    runResponse: unwrapApiData(raw)
  });
}

/**
 * @async
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function getLatestTrustRun(params) {
  const { dataplaneUrl, datasourceKey, systemKey, authConfig, options } = params;
  const timeoutMs = parseTrustTimeoutMs(options);
  const raw = await getLatestAgentMetadataValidation(dataplaneUrl, datasourceKey, authConfig, {
    timeoutMs
  });
  return mapLatestResultToTrustRun({
    datasourceKey,
    systemKey,
    latestResult: unwrapApiData(raw)
  });
}

/**
 * @async
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function fetchTrustRunFromDataplane(params) {
  const { datasourceKey, systemKey, dataplaneUrl, authConfig, options } = params;
  if (isAgentTrustMockEnabled()) {
    return buildMockTrustRun(datasourceKey, systemKey);
  }

  const body = { forceRevalidate: options.revalidate === true };
  if (options.peerDatasourceConfigs && typeof options.peerDatasourceConfigs === 'object') {
    body.peerDatasourceConfigs = options.peerDatasourceConfigs;
  }

  if (!shouldPreferLatestRead(options)) {
    return postValidateTrustRun({ dataplaneUrl, datasourceKey, systemKey, authConfig, body, options });
  }

  try {
    return await getLatestTrustRun({ dataplaneUrl, datasourceKey, systemKey, authConfig, options });
  } catch (err) {
    if (!isLatestNotFoundError(err)) throw err;
    return postValidateTrustRun({ dataplaneUrl, datasourceKey, systemKey, authConfig, body, options });
  }
}

module.exports = {
  shouldPreferLatestRead,
  fetchTrustRunFromDataplane,
  isLatestNotFoundError
};
