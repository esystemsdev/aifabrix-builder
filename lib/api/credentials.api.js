/**
 * @fileoverview Credentials API functions (Dataplane credential list)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * List credentials from Dataplane
 * GET /api/v1/credential
 * Used by `aifabrix credential list`. The Controller does not expose this endpoint; call with Dataplane base URL.
 * @requiresPermission {Dataplane} credential:read
 * @async
 * @function listCredentials
 * @param {string} baseUrl - Dataplane base URL (GET /api/v1/credential is a Dataplane endpoint)
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @param {boolean} [options.activeOnly] - If true, return only active credentials
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Items per page
 * @returns {Promise<Object>} Response with credentials (e.g. data.credentials or data.items)
 * @throws {Error} If request fails
 */
async function listCredentials(baseUrl, authConfig, options = {}) {
  const client = new ApiClient(baseUrl, authConfig);
  return await client.get('/api/v1/credential', {
    params: options
  });
}

module.exports = {
  listCredentials
};
