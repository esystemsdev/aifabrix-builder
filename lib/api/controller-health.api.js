/**
 * Controller health (public) — deployment mode for Builder polling tuning.
 *
 * GET /api/v1/health returns `{ data: { deploymentType, ... } }` (miso-controller).
 *
 * @fileoverview Read controller deployment type without authentication
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * Extract deploymentType from harmonized API JSON body.
 * @param {Object} response - Result from ApiClient.get / makeApiCall shape `{ success, data }`
 * @returns {string|undefined} Normalized lowercase deployment type or undefined
 */
function extractDeploymentTypeFromHealthResponse(response) {
  if (!response || response.success === false || response.data === null) {
    return undefined;
  }
  const body = response.data;
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const payload = body.data !== undefined ? body.data : body;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const dt = payload.deploymentType;
  return typeof dt === 'string' ? dt.trim().toLowerCase() : undefined;
}

/**
 * Fetch controller DEPLOYMENT mode label (public endpoint, no auth).
 * @async
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<string|undefined>} e.g. 'database', 'local', 'azure', 'azure-mock'
 */
async function getControllerDeploymentType(controllerUrl) {
  const client = new ApiClient(controllerUrl);
  const response = await client.get('/api/v1/health');
  return extractDeploymentTypeFromHealthResponse(response);
}

module.exports = {
  getControllerDeploymentType,
  extractDeploymentTypeFromHealthResponse
};
