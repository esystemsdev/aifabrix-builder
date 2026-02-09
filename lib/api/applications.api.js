/**
 * @fileoverview Applications API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * List all template applications
 * GET /api/v1/applications
 * @requiresPermission {Controller} applications:read
 * @async
 * @function listApplications
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Items per page
 * @param {string} [options.sort] - Sort parameter
 * @param {string} [options.filter] - Filter parameter
 * @param {string} [options.search] - Search term
 * @returns {Promise<Object>} Paginated list of template applications
 * @throws {Error} If request fails
 */
async function listApplications(controllerUrl, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get('/api/v1/applications', {
    params: options
  });
}

/**
 * Create new template application
 * POST /api/v1/applications
 * @requiresPermission {Controller} applications:create
 * @async
 * @function createApplication
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} applicationData - Application data
 * @param {string} applicationData.key - Application key
 * @param {string} applicationData.displayName - Display name
 * @param {Object} applicationData.configuration - Application configuration
 * @param {string} [applicationData.description] - Application description
 * @param {string} [applicationData.url] - Application URL
 * @returns {Promise<Object>} Created application response
 * @throws {Error} If creation fails
 */
async function createApplication(controllerUrl, authConfig, applicationData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post('/api/v1/applications', {
    body: applicationData
  });
}

/**
 * Get template application details
 * GET /api/v1/applications/{appKey}
 * @requiresPermission {Controller} applications:read
 * @async
 * @function getApplication
 * @param {string} controllerUrl - Controller base URL
 * @param {string} appKey - Application key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Application details response
 * @throws {Error} If request fails
 */
async function getApplication(controllerUrl, appKey, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/applications/${appKey}`);
}

/**
 * Update template application
 * PATCH /api/v1/applications/{appKey}
 * @requiresPermission {Controller} applications:update
 * @async
 * @function updateApplication
 * @param {string} controllerUrl - Controller base URL
 * @param {string} appKey - Application key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} updateData - Update data
 * @param {string} [updateData.displayName] - Display name
 * @param {string} [updateData.description] - Description
 * @param {string} [updateData.url] - URL
 * @param {Object} [updateData.configuration] - Configuration
 * @param {string} [updateData.status] - Status
 * @returns {Promise<Object>} Updated application response
 * @throws {Error} If update fails
 */
async function updateApplication(controllerUrl, appKey, authConfig, updateData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.patch(`/api/v1/applications/${appKey}`, {
    body: updateData
  });
}

/**
 * Delete template application
 * DELETE /api/v1/applications/{appKey}
 * @requiresPermission {Controller} applications:delete
 * @async
 * @function deleteApplication
 * @param {string} controllerUrl - Controller base URL
 * @param {string} appKey - Application key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Delete response
 * @throws {Error} If deletion fails
 */
async function deleteApplication(controllerUrl, appKey, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.delete(`/api/v1/applications/${appKey}`);
}

/**
 * Register application in an environment
 * POST /api/v1/environments/{envKey}/applications/register
 * @requiresPermission {Controller} environments-applications:create
 * @async
 * @function registerApplication
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} registrationData - Registration data
 * @param {string} registrationData.key - Application key
 * @param {string} registrationData.displayName - Display name
 * @param {string} registrationData.type - Application type
 * @param {string} [registrationData.description] - Application description
 * @param {string} [registrationData.registryMode] - Registry mode
 * @param {number} [registrationData.port] - Application port
 * @param {string} [registrationData.url] - Application URL (e.g. http://localhost:3001 when controller is localhost)
 * @param {string} [registrationData.image] - Container image
 * @param {Object} [registrationData.externalIntegration] - External integration config
 * @returns {Promise<Object>} Registration response with application and credentials
 * @throws {Error} If registration fails
 */
async function registerApplication(controllerUrl, envKey, authConfig, registrationData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`/api/v1/environments/${envKey}/applications/register`, {
    body: registrationData
  });
}

/**
 * Rotate application secret
 * POST /api/v1/environments/{envKey}/applications/{appKey}/rotate-secret
 * @requiresPermission {Controller} environments-applications:update
 * @async
 * @function rotateApplicationSecret
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {string} appKey - Application key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Response with new credentials
 * @throws {Error} If rotation fails
 */
async function rotateApplicationSecret(controllerUrl, envKey, appKey, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`/api/v1/environments/${envKey}/applications/${appKey}/rotate-secret`);
}

/**
 * Get application status (metadata only, no configuration)
 * GET /api/v1/environments/{envKey}/applications/{appKey}/status
 * @requiresPermission {Controller} Bearer or app client credentials (environments-applications:read)
 * @async
 * @function getApplicationStatus
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {string} appKey - Application key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Response with data: { id, key, displayName, url, internalUrl, port, status, runtimeStatus, environmentId, createdAt, updatedAt, image, description }
 * @throws {Error} If request fails
 */
async function getApplicationStatus(controllerUrl, envKey, appKey, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(
    `/api/v1/environments/${envKey}/applications/${appKey}/status`
  );
}

module.exports = {
  listApplications,
  createApplication,
  getApplication,
  updateApplication,
  deleteApplication,
  registerApplication,
  rotateApplicationSecret,
  getApplicationStatus
};

