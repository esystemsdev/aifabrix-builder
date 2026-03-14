/**
 * @fileoverview Service users API functions (create, list, rotate-secret, delete, update)
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

/**
 * List service users with optional pagination and search
 * GET /api/v1/service-users
 * @requiresPermission {Controller} service-user:read
 * @async
 * @function listServiceUsers
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration (bearer or client-credentials)
 * @param {Object} [options] - Query options
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Items per page
 * @param {string} [options.sort] - Sort field/direction
 * @param {string} [options.filter] - Filter expression
 * @param {string} [options.search] - Search term
 * @returns {Promise<Object>} Response with data (array), meta, links
 * @throws {Error} If request fails (401/403 or network)
 */
async function listServiceUsers(controllerUrl, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  const params = {};
  if (options.page !== undefined && options.page !== null) params.page = options.page;
  if (options.pageSize !== undefined && options.pageSize !== null) params.pageSize = options.pageSize;
  if (options.sort) params.sort = options.sort;
  if (options.filter) params.filter = options.filter;
  if (options.search) params.search = options.search;
  return await client.get('/api/v1/service-users', { params });
}

/**
 * Regenerate (rotate) secret for a service user. New secret is returned once only.
 * POST /api/v1/service-users/{id}/regenerate-secret
 * @requiresPermission {Controller} service-user:update
 * @async
 * @function regenerateSecretServiceUser
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Service user ID (UUID)
 * @returns {Promise<Object>} Response with data.clientSecret
 * @throws {Error} If request fails (401/403/404 or network)
 */
async function regenerateSecretServiceUser(controllerUrl, authConfig, id) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`/api/v1/service-users/${encodeURIComponent(id)}/regenerate-secret`);
}

/**
 * Delete (deactivate) a service user
 * DELETE /api/v1/service-users/{id}
 * @requiresPermission {Controller} service-user:delete
 * @async
 * @function deleteServiceUser
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Service user ID (UUID)
 * @returns {Promise<Object>} Response (data may be null)
 * @throws {Error} If request fails (401/403/404 or network)
 */
async function deleteServiceUser(controllerUrl, authConfig, id) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.delete(`/api/v1/service-users/${encodeURIComponent(id)}`);
}

/**
 * Update group assignments for a service user
 * PUT /api/v1/service-users/{id}/groups
 * @requiresPermission {Controller} service-user:update
 * @async
 * @function updateGroupsServiceUser
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Service user ID (UUID)
 * @param {Object} body - Request body
 * @param {string[]} body.groupNames - Group names to set
 * @returns {Promise<Object>} Response with data.id, data.groupNames
 * @throws {Error} If request fails (400/401/403/404 or network)
 */
async function updateGroupsServiceUser(controllerUrl, authConfig, id, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.put(`/api/v1/service-users/${encodeURIComponent(id)}/groups`, {
    body: { groupNames: body.groupNames }
  });
}

/**
 * Update redirect URIs for a service user (min 1). Controller merges in its callback URL.
 * PUT /api/v1/service-users/{id}/redirect-uris
 * @requiresPermission {Controller} service-user:update
 * @async
 * @function updateRedirectUrisServiceUser
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Service user ID (UUID)
 * @param {Object} body - Request body
 * @param {string[]} body.redirectUris - Redirect URIs (min 1)
 * @returns {Promise<Object>} Response with data.id, data.redirectUris
 * @throws {Error} If request fails (400/401/403/404 or network)
 */
async function updateRedirectUrisServiceUser(controllerUrl, authConfig, id, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.put(`/api/v1/service-users/${encodeURIComponent(id)}/redirect-uris`, {
    body: { redirectUris: body.redirectUris }
  });
}

module.exports = {
  createServiceUser,
  listServiceUsers,
  regenerateSecretServiceUser,
  deleteServiceUser,
  updateGroupsServiceUser,
  updateRedirectUrisServiceUser
};
