/**
 * @fileoverview Deployments API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * Deploy an application to an environment
 * POST /api/v1/environments/{envKey}/applications/deploy
 * @async
 * @function deployApplication
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} deployData - Deployment data
 * @param {string} deployData.applicationKey - Application key to deploy
 * @param {string} deployData.image - Container image path
 * @param {Object} [deployData.configuration] - Additional deployment configuration
 * @param {boolean} [deployData.dryRun] - If true, perform a dry run
 * @returns {Promise<Object>} Deployment response
 * @throws {Error} If deployment fails
 */
async function deployApplication(controllerUrl, envKey, authConfig, deployData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`/api/v1/environments/${envKey}/applications/deploy`, {
    body: deployData
  });
}

/**
 * Deploy environment infrastructure
 * POST /api/v1/environments/{envKey}/deploy
 * @async
 * @function deployEnvironment
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} deployData - Deployment data
 * @param {Object} deployData.environmentConfig - Environment configuration
 * @param {boolean} [deployData.dryRun] - If true, perform a dry run
 * @returns {Promise<Object>} Deployment response
 * @throws {Error} If deployment fails
 */
async function deployEnvironment(controllerUrl, envKey, authConfig, deployData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`/api/v1/environments/${envKey}/deploy`, {
    body: deployData
  });
}

/**
 * List deployments for an environment
 * GET /api/v1/environments/{envKey}/deployments
 * @async
 * @function listDeployments
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - List options
 * @param {number} [options.page] - Page number
 * @property {number} [options.pageSize] - Items per page
 * @param {string} [options.sort] - Sort parameter
 * @param {string} [options.filter] - Filter parameter
 * @param {string} [options.search] - Search term
 * @param {string} [options.status] - Filter by status (legacy)
 * @param {string} [options.deploymentType] - Filter by deployment type (legacy)
 * @returns {Promise<Object>} Paginated list of deployments
 * @throws {Error} If request fails
 */
async function listDeployments(controllerUrl, envKey, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/deployments`, {
    params: options
  });
}

/**
 * Get deployment with jobs and logs
 * GET /api/v1/environments/{envKey}/deployments/{deploymentId}
 * @async
 * @function getDeployment
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {string} deploymentId - Deployment ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Full deployment record with jobs and logs
 * @throws {Error} If request fails
 */
async function getDeployment(controllerUrl, envKey, deploymentId, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/deployments/${deploymentId}`);
}

/**
 * Get deployment job logs
 * GET /api/v1/environments/{envKey}/deployments/{deploymentId}/logs
 * @async
 * @function getDeploymentLogs
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {string} deploymentId - Deployment ID
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [options] - Log options
 * @param {string} [options.jobId] - Filter logs for specific job ID
 * @param {string} [options.level] - Filter by log level
 * @param {string} [options.since] - Get logs since timestamp (ISO 8601)
 * @returns {Promise<Object>} Array of job logs
 * @throws {Error} If request fails
 */
async function getDeploymentLogs(controllerUrl, envKey, deploymentId, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/environments/${envKey}/deployments/${deploymentId}/logs`, {
    params: options
  });
}

module.exports = {
  deployApplication,
  deployEnvironment,
  listDeployments,
  getDeployment,
  getDeploymentLogs
};

