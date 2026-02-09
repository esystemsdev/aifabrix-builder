/**
 * @fileoverview Environments API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * List all environments
 * GET /api/v1/environments
 * @requiresPermission {Controller} environments:read
 * @async
 * @function listEnvironments
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Items per page
 * @param {string} [options.sort] - Sort parameter
 * @param {string} [options.filter] - Filter parameter
 * @param {string} [options.search] - Search term
 * @param {string} [options.environment] - Filter by environment type (legacy)
 * @param {string} [options.status] - Filter by status (legacy)
 * @returns {Promise<Object>} Paginated list of environments
 * @throws {Error} If request fails
 */
async function listEnvironments(controllerUrl, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get('/api/v1/environments', {
    params: options
  });
}

/**
 * Create new environment
 * POST /api/v1/environments
 * @requiresPermission {Controller} environments:create
 * @async
 * @function createEnvironment
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} environmentData - Environment data
 * @param {string} environmentData.key - Environment key
 * @param {string} environmentData.environment - Environment type
 * @param {Object} environmentData.configuration - Environment configuration
 * @returns {Promise<Object>} Created environment response
 * @throws {Error} If creation fails
 */
async function createEnvironment(controllerUrl, authConfig, environmentData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post('/api/v1/environments', {
    body: environmentData
  });
}

/**
 * Get environment by key
 * GET /api/v1/environments/{envKey}
 * @requiresPermission {Controller} environments:read
 * @async
 * @function getEnvironment
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Environment details response
 * @throws {Error} If request fails
 */
async function getEnvironment(controllerUrl, envKey, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}`);
}

/**
 * Update environment by key
 * PATCH /api/v1/environments/{envKey}
 * @requiresPermission {Controller} environments:update
 * @async
 * @function updateEnvironment
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} updateData - Update data
 * @param {Object} [updateData.configuration] - Environment configuration
 * @returns {Promise<Object>} Updated environment response
 * @throws {Error} If update fails
 */
async function updateEnvironment(controllerUrl, envKey, authConfig, updateData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.patch(`/api/v1/environments/${envKey}`, {
    body: updateData
  });
}

/**
 * Get environment status
 * GET /api/v1/environments/{envKey}/status
 * @requiresPermission {Controller} environments:read
 * @async
 * @function getEnvironmentStatus
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Environment status response
 * @throws {Error} If request fails
 */
async function getEnvironmentStatus(controllerUrl, envKey, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/status`);
}

/**
 * List applications in an environment
 * GET /api/v1/environments/{envKey}/applications
 * @requiresPermission {Controller} environments-applications:read
 * @async
 * @function listEnvironmentApplications
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Items per page
 * @param {string} [options.sort] - Sort parameter
 * @param {string} [options.filter] - Filter parameter
 * @param {string} [options.status] - Filter by status
 * @returns {Promise<Object>} List of applications in the environment
 * @throws {Error} If request fails
 */
async function listEnvironmentApplications(controllerUrl, envKey, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/applications`, {
    params: options
  });
}

/**
 * List deployments for environment
 * GET /api/v1/environments/{envKey}/deployments
 * @requiresPermission {Controller} deployments:read
 * @async
 * @function listEnvironmentDeployments
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Items per page
 * @param {string} [options.sort] - Sort parameter
 * @param {string} [options.filter] - Filter parameter
 * @param {string} [options.status] - Filter by status (legacy)
 * @param {string} [options.deploymentType] - Filter by deployment type (legacy)
 * @returns {Promise<Object>} Paginated list of deployments
 * @throws {Error} If request fails
 */
async function listEnvironmentDeployments(controllerUrl, envKey, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/deployments`, {
    params: options
  });
}

/**
 * List roles for environment
 * GET /api/v1/environments/{envKey}/roles
 * @requiresPermission {Controller} environments:read
 * @async
 * @function listEnvironmentRoles
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} List of roles with mappings
 * @throws {Error} If request fails
 */
async function listEnvironmentRoles(controllerUrl, envKey, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/roles`);
}

/**
 * Map role to groups for environment
 * PATCH /api/v1/environments/{envKey}/roles/{value}/groups
 * @requiresPermission {Controller} environments:update
 * @async
 * @function updateRoleGroups
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {string} roleValue - Role value
 * @param {Object} authConfig - Authentication configuration
 * @param {string[]} groups - Array of group names
 * @returns {Promise<Object>} Role group mappings response
 * @throws {Error} If update fails
 */
async function updateRoleGroups(controllerUrl, envKey, roleValue, authConfig, groups) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.patch(`/api/v1/environments/${envKey}/roles/${roleValue}/groups`, {
    body: { groups }
  });
}

/**
 * Get application details in an environment
 * GET /api/v1/environments/{envKey}/applications/{appKey}
 * @requiresPermission {Controller} environments-applications:read
 * @async
 * @function getEnvironmentApplication
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {string} appKey - Application key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Application details response
 * @throws {Error} If request fails
 */
async function getEnvironmentApplication(controllerUrl, envKey, appKey, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/applications/${appKey}`);
}

/**
 * List datasources in an environment
 * GET /api/v1/environments/{envKey}/datasources
 * @requiresPermission {Controller} environments:read (or datasources scope per controller spec)
 * @async
 * @function listEnvironmentDatasources
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Items per page
 * @param {string} [options.sort] - Sort parameter
 * @param {string} [options.filter] - Filter parameter
 * @returns {Promise<Object>} List of datasources in the environment
 * @throws {Error} If request fails
 */
async function listEnvironmentDatasources(controllerUrl, envKey, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/datasources`, {
    params: options
  });
}

module.exports = {
  listEnvironments,
  createEnvironment,
  getEnvironment,
  updateEnvironment,
  getEnvironmentStatus,
  listEnvironmentApplications,
  getEnvironmentApplication,
  listEnvironmentDatasources,
  listEnvironmentDeployments,
  listEnvironmentRoles,
  updateRoleGroups
};

