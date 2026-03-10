/**
 * @fileoverview External test API - dataplane external endpoints (test, test-e2e)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * Run E2E test for one datasource (config, credential, sync, data, CIP) via dataplane external API.
 * Requires Bearer token or API key; client credentials are not accepted.
 * When asyncRun is true, POST returns 202 with { testRunId, status, startedAt }; caller must poll
 * getE2ETestRun until status is 'completed' or 'failed'. When asyncRun is false, POST returns 200
 * with sync body { steps, success, error?, ... }.
 *
 * @requiresPermission {Dataplane} external-data-source:read
 * @async
 * @function testDatasourceE2E
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sourceIdOrKey - Source ID or datasource key (e.g. hubspot-test-v4-contacts)
 * @param {Object} authConfig - Authentication configuration (must have token or apiKey; client creds rejected)
 * @param {Object} [body] - Optional request body (e.g. includeDebug, testCrud, recordId, cleanup, primaryKeyValue)
 * @param {Object} [options] - Optional options
 * @param {boolean} [options.asyncRun] - If true, request async run (query param asyncRun=true); response may be 202 with testRunId
 * @returns {Promise<Object>} Response with success, data (sync: steps/success/error; async start: testRunId/status/startedAt), status
 * @throws {Error} If auth lacks Bearer/API_KEY or if test fails
 */
async function testDatasourceE2E(dataplaneUrl, sourceIdOrKey, authConfig, body = {}, options = {}) {
  if (!authConfig.token && !authConfig.apiKey) {
    throw new Error(
      'E2E tests require Bearer token or API key. Run \'aifabrix login\' or configure API key. ' +
      'Client credentials are not supported for external test endpoints.'
    );
  }
  const client = new ApiClient(dataplaneUrl, authConfig);
  const postOptions = { body };
  if (options.asyncRun === true) {
    postOptions.params = { asyncRun: 'true' };
  }
  return await client.post(`/api/v1/external/${encodeURIComponent(sourceIdOrKey)}/test-e2e`, postOptions);
}

/**
 * Poll E2E test run status. Call after testDatasourceE2E with asyncRun true when response has testRunId.
 * Same auth as E2E (Bearer or API key).
 *
 * @requiresPermission {Dataplane} external-data-source:read
 * @async
 * @function getE2ETestRun
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sourceIdOrKey - Source ID or datasource key
 * @param {string} testRunId - Test run ID from async start response
 * @param {Object} authConfig - Authentication configuration (must have token or apiKey)
 * @returns {Promise<Object>} Poll response: { status, completedActions?, steps?, success?, error?, durationSeconds?, debug? }
 * @throws {Error} If auth lacks Bearer/API_KEY, or if run not found/expired (404)
 */
async function getE2ETestRun(dataplaneUrl, sourceIdOrKey, testRunId, authConfig) {
  if (!authConfig.token && !authConfig.apiKey) {
    throw new Error(
      'E2E poll requires Bearer token or API key. Run \'aifabrix login\' or configure API key.'
    );
  }
  if (!testRunId || typeof testRunId !== 'string') {
    throw new Error('testRunId is required for E2E poll');
  }
  const client = new ApiClient(dataplaneUrl, authConfig);
  const response = await client.get(
    `/api/v1/external/${encodeURIComponent(sourceIdOrKey)}/test-e2e/${encodeURIComponent(testRunId)}`
  );
  if (!response.success) {
    if (response.status === 404) {
      throw new Error(
        `E2E test run not found or expired (run ID: ${testRunId}). The run may have been purged or the ID is invalid.`
      );
    }
    throw new Error(response.formattedError || response.error || 'E2E poll failed');
  }
  return response.data || response;
}

/**
 * Run config test for one datasource via dataplane external API.
 * Requires Bearer token or API key; client credentials are not accepted.
 *
 * @requiresPermission {Dataplane} external-data-source:read
 * @async
 * @function testDatasourceConfig
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sourceIdOrKey - Source ID or datasource key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [body] - Optional request body
 * @returns {Promise<Object>} Config test response
 * @throws {Error} If auth lacks Bearer/API_KEY or if test fails
 */
async function testDatasourceConfig(dataplaneUrl, sourceIdOrKey, authConfig, body = {}) {
  if (!authConfig.token && !authConfig.apiKey) {
    throw new Error(
      'External config tests require Bearer token or API key. Run \'aifabrix login\' or configure API key.'
    );
  }
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${encodeURIComponent(sourceIdOrKey)}/test`, {
    body
  });
}

module.exports = {
  testDatasourceE2E,
  getE2ETestRun,
  testDatasourceConfig
};
