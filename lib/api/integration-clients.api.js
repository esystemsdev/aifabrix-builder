/**
 * @fileoverview Integration clients API (Controller /api/v1/integration-clients)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

const BASE = '/api/v1/integration-clients';

/**
 * Create integration client; returns one-time clientSecret
 * @requiresPermission {Controller} integration-client:create
 * @async
 * @function createIntegrationClient
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration (bearer or client-credentials)
 * @param {Object} body - Request body
 * @param {string} body.key - Key (required)
 * @param {string} body.displayName - Display name (required)
 * @param {string[]} body.redirectUris - Redirect URIs (required, min 1)
 * @param {string[]} [body.groupNames] - Group names (optional)
 * @param {string} [body.description] - Optional description
 * @param {string} [body.keycloakClientId] - Optional Keycloak client id
 * @returns {Promise<Object>} API response
 * @throws {Error} If request fails
 */
async function createIntegrationClient(controllerUrl, authConfig, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  const payload = {
    key: body.key,
    displayName: body.displayName,
    redirectUris: body.redirectUris,
    groupNames: Array.isArray(body.groupNames) ? body.groupNames : []
  };
  if (body.description !== undefined && body.description !== null && body.description !== '') {
    payload.description = body.description;
  }
  if (body.keycloakClientId) {
    payload.keycloakClientId = body.keycloakClientId;
  }
  return await client.post(BASE, { body: payload });
}

/**
 * List integration clients
 * @requiresPermission {Controller} integration-client:read
 * @async
 * @function listIntegrationClients
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - Query options
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Page size
 * @param {string} [options.sort] - Sort
 * @param {string} [options.filter] - Filter
 * @param {string} [options.search] - Search
 * @returns {Promise<Object>} API response
 * @throws {Error} If request fails
 */
async function listIntegrationClients(controllerUrl, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  const params = {};
  if (options.page !== undefined && options.page !== null) params.page = options.page;
  if (options.pageSize !== undefined && options.pageSize !== null) params.pageSize = options.pageSize;
  if (options.sort) params.sort = options.sort;
  if (options.filter) params.filter = options.filter;
  if (options.search) params.search = options.search;
  return await client.get(BASE, { params });
}

/**
 * Get integration client by id
 * @requiresPermission {Controller} integration-client:read
 * @async
 * @function getIntegrationClient
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Integration client id
 * @returns {Promise<Object>} API response
 * @throws {Error} If request fails
 */
async function getIntegrationClient(controllerUrl, authConfig, id) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`${BASE}/${encodeURIComponent(id)}`);
}

/**
 * Regenerate client secret (shown once)
 * @requiresPermission {Controller} integration-client:update
 * @async
 * @function regenerateIntegrationClientSecret
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Integration client id
 * @returns {Promise<Object>} API response
 * @throws {Error} If request fails
 */
async function regenerateIntegrationClientSecret(controllerUrl, authConfig, id) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`${BASE}/${encodeURIComponent(id)}/regenerate-secret`);
}

/**
 * Deactivate integration client
 * @requiresPermission {Controller} integration-client:delete
 * @async
 * @function deleteIntegrationClient
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Integration client id
 * @returns {Promise<Object>} API response
 * @throws {Error} If request fails
 */
async function deleteIntegrationClient(controllerUrl, authConfig, id) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.delete(`${BASE}/${encodeURIComponent(id)}`);
}

/**
 * Replace group memberships
 * @requiresPermission {Controller} integration-client:update
 * @async
 * @function updateIntegrationClientGroups
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Integration client id
 * @param {Object} body - Body with groupNames
 * @param {string[]} body.groupNames - Group names
 * @returns {Promise<Object>} API response
 * @throws {Error} If request fails
 */
async function updateIntegrationClientGroups(controllerUrl, authConfig, id, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.put(`${BASE}/${encodeURIComponent(id)}/groups`, {
    body: { groupNames: body.groupNames }
  });
}

/**
 * Replace redirect URIs
 * @requiresPermission {Controller} integration-client:update
 * @async
 * @function updateIntegrationClientRedirectUris
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} id - Integration client id
 * @param {Object} body - Body with redirectUris
 * @param {string[]} body.redirectUris - Redirect URIs (min 1)
 * @returns {Promise<Object>} API response
 * @throws {Error} If request fails
 */
async function updateIntegrationClientRedirectUris(controllerUrl, authConfig, id, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.put(`${BASE}/${encodeURIComponent(id)}/redirect-uris`, {
    body: { redirectUris: body.redirectUris }
  });
}

module.exports = {
  createIntegrationClient,
  listIntegrationClients,
  getIntegrationClient,
  regenerateIntegrationClientSecret,
  deleteIntegrationClient,
  updateIntegrationClientGroups,
  updateIntegrationClientRedirectUris
};
