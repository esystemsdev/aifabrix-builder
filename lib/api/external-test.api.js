/**
 * @fileoverview External test API - dataplane external endpoints (test, test-e2e)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * Run E2E test for one datasource (config, credential, sync, data, CIP) via dataplane external API.
 * Requires Bearer token or API key; client credentials are not accepted.
 *
 * @requiresPermission {Dataplane} external-data-source:read
 * @async
 * @function testDatasourceE2E
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sourceIdOrKey - Source ID or datasource key (e.g. hubspot-test-v4-contacts)
 * @param {Object} authConfig - Authentication configuration (must have token or apiKey; client creds rejected)
 * @param {Object} [body] - Optional request body (e.g. includeDebug)
 * @returns {Promise<Object>} E2E test response with steps (config, credential, sync, data, cip)
 * @throws {Error} If auth lacks Bearer/API_KEY or if test fails
 */
async function testDatasourceE2E(dataplaneUrl, sourceIdOrKey, authConfig, body = {}) {
  if (!authConfig.token && !authConfig.apiKey) {
    throw new Error(
      'E2E tests require Bearer token or API key. Run \'aifabrix login\' or configure API key. ' +
      'Client credentials are not supported for external test endpoints.'
    );
  }
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/${encodeURIComponent(sourceIdOrKey)}/test-e2e`, {
    body
  });
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
  testDatasourceConfig
};
