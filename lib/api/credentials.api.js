/**
 * @fileoverview Credentials API functions (controller/dataplane credential list)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * List credentials from controller or dataplane
 * GET /api/v1/credential
 * Used by `aifabrix credential list`. Call with controller or dataplane base URL per deployment.
 *
 * @async
 * @function listCredentials
 * @param {string} baseUrl - Controller or dataplane base URL
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
