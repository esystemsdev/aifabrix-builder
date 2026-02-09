/**
 * @fileoverview Service users API functions (create service user with one-time secret)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * Create a service user (username, email, redirectUris, groupIds); return one-time secret
 * POST /api/v1/service-users
 * @requiresPermission {Controller} service-user:create
 * @async
 * @function createServiceUser
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration (bearer or client-credentials)
 * @param {Object} body - Request body
 * @param {string} body.username - Username (required)
 * @param {string} body.email - Email (required)
 * @param {string[]} body.redirectUris - Redirect URIs for OAuth2 (required, min 1)
 * @param {string[]} body.groupNames - Group names (required, e.g. AI-Fabrix-Developers)
 * @param {string} [body.description] - Optional description
 * @returns {Promise<Object>} Response with clientId and one-time clientSecret
 * @throws {Error} If request fails (400/401/403 or network)
 */
async function createServiceUser(controllerUrl, authConfig, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post('/api/v1/service-users', {
    body: {
      username: body.username,
      email: body.email,
      redirectUris: body.redirectUris,
      groupNames: body.groupNames,
      description: body.description
    }
  });
}

module.exports = {
  createServiceUser
};
