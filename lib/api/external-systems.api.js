/**
 * @fileoverview External Systems API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * List external systems
 * GET /api/v1/external/systems
 * @async
 * @function listExternalSystems
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @param {number} [options.page] - Page number
 * @param {number} [options.pageSize] - Items per page
 * @param {string} [options.sort] - Sort parameter
 * @param {string} [options.filter] - Filter parameter
 * @param {string} [options.search] - Search term
 * @returns {Promise<Object>} Paginated list of external systems
 * @throws {Error} If request fails
 */
async function listExternalSystems(dataplaneUrl, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get('/api/v1/external/systems', {
    params: options
  });
}

/**
 * Create external system
 * POST /api/v1/external/systems
 * @async
 * @function createExternalSystem
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} systemData - External system data
 * @returns {Promise<Object>} Created external system response
 * @throws {Error} If creation fails
 */
async function createExternalSystem(dataplaneUrl, authConfig, systemData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/external/systems', {
    body: systemData
  });
}

/**
 * Get external system details
 * GET /api/v1/external/systems/{systemIdOrKey}
 * @async
 * @function getExternalSystem
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} External system details response
 * @throws {Error} If request fails
 */
async function getExternalSystem(dataplaneUrl, systemIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/systems/${systemIdOrKey}`);
}

/**
 * Update external system
 * PUT /api/v1/external/systems/{systemIdOrKey}
 * @async
 * @function updateExternalSystem
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated external system response
 * @throws {Error} If update fails
 */
async function updateExternalSystem(dataplaneUrl, systemIdOrKey, authConfig, updateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.put(`/api/v1/external/systems/${systemIdOrKey}`, {
    body: updateData
  });
}

/**
 * Delete external system (soft delete)
 * DELETE /api/v1/external/systems/{systemIdOrKey}
 * @async
 * @function deleteExternalSystem
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Delete response
 * @throws {Error} If deletion fails
 */
async function deleteExternalSystem(dataplaneUrl, systemIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.delete(`/api/v1/external/systems/${systemIdOrKey}`);
}

/**
 * Get full config with application schema and dataSources
 * GET /api/v1/external/systems/{systemIdOrKey}/config
 * @async
 * @function getExternalSystemConfig
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Config response with application schema and dataSources
 * @throws {Error} If request fails
 */
async function getExternalSystemConfig(dataplaneUrl, systemIdOrKey, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/systems/${systemIdOrKey}/config`);
}

/**
 * Create external system from integration template
 * POST /api/v1/external/systems/from-template
 * @async
 * @function createFromTemplate
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} templateData - Template data
 * @param {string} templateData.templateIdOrKey - Template ID or key
 * @param {string} templateData.key - System key
 * @param {string} templateData.displayName - Display name
 * @returns {Promise<Object>} Created external system response (status='draft')
 * @throws {Error} If creation fails
 */
async function createFromTemplate(dataplaneUrl, authConfig, templateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/external/systems/from-template', {
    body: templateData
  });
}

/**
 * List OpenAPI files for system
 * GET /api/v1/external/systems/{systemIdOrKey}/openapi-files
 * @async
 * @function listOpenAPIFiles
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @returns {Promise<Object>} Paginated list of OpenAPI files
 * @throws {Error} If request fails
 */
async function listOpenAPIFiles(dataplaneUrl, systemIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/systems/${systemIdOrKey}/openapi-files`, {
    params: options
  });
}

/**
 * List OpenAPI endpoints for system
 * GET /api/v1/external/systems/{systemIdOrKey}/openapi-endpoints
 * @async
 * @function listOpenAPIEndpoints
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @returns {Promise<Object>} Paginated list of OpenAPI endpoints
 * @throws {Error} If request fails
 */
async function listOpenAPIEndpoints(dataplaneUrl, systemIdOrKey, authConfig, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/external/systems/${systemIdOrKey}/openapi-endpoints`, {
    params: options
  });
}

/**
 * Publish external system
 * POST /api/v1/external/systems/{systemIdOrKey}/publish
 * @async
 * @function publishExternalSystem
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [publishData] - Publish options
 * @param {boolean} [publishData.generateMcpContract] - Generate MCP contract
 * @returns {Promise<Object>} Published external system response
 * @throws {Error} If publish fails
 */
async function publishExternalSystem(dataplaneUrl, systemIdOrKey, authConfig, publishData = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/systems/${systemIdOrKey}/publish`, {
    body: publishData
  });
}

/**
 * Rollback external system to version
 * POST /api/v1/external/systems/{systemIdOrKey}/rollback
 * @async
 * @function rollbackExternalSystem
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} rollbackData - Rollback data
 * @param {number} rollbackData.version - Version to rollback to
 * @returns {Promise<Object>} Rolled back external system response
 * @throws {Error} If rollback fails
 */
async function rollbackExternalSystem(dataplaneUrl, systemIdOrKey, authConfig, rollbackData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/systems/${systemIdOrKey}/rollback`, {
    body: rollbackData
  });
}

/**
 * Save external system as integration template
 * POST /api/v1/external/systems/{systemIdOrKey}/save-template
 * @async
 * @function saveAsTemplate
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemIdOrKey - System ID or key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} templateData - Template data
 * @param {string} templateData.templateKey - Template key
 * @param {string} templateData.templateName - Template name
 * @returns {Promise<Object>} Saved template response
 * @throws {Error} If save fails
 */
async function saveAsTemplate(dataplaneUrl, systemIdOrKey, authConfig, templateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/external/systems/${systemIdOrKey}/save-template`, {
    body: templateData
  });
}

module.exports = {
  listExternalSystems,
  createExternalSystem,
  getExternalSystem,
  updateExternalSystem,
  deleteExternalSystem,
  getExternalSystemConfig,
  createFromTemplate,
  listOpenAPIFiles,
  listOpenAPIEndpoints,
  publishExternalSystem,
  rollbackExternalSystem,
  saveAsTemplate
};

