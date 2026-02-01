/**
 * @fileoverview Pipeline API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * Validate deployment configuration
 * POST /api/v1/pipeline/{envKey}/validate
 * @async
 * @function validatePipeline
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration (supports client credentials)
 * @param {Object} validationData - Validation data
 * @param {string} validationData.clientId - Client ID for application authentication
 * @param {string} validationData.repositoryUrl - Repository URL for validation
 * @param {Object} validationData.applicationConfig - Application configuration
 * @returns {Promise<Object>} Validation response with validateToken and ACR credentials
 * @throws {Error} If validation fails
 */
async function validatePipeline(controllerUrl, envKey, authConfig, validationData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`/api/v1/pipeline/${envKey}/validate`, {
    body: validationData
  });
}

/**
 * Deploy application using validateToken
 * POST /api/v1/pipeline/{envKey}/deploy
 * @async
 * @function deployPipeline
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration (supports client credentials)
 * @param {Object} deployData - Deployment data
 * @param {string} deployData.validateToken - One-time deployment token from /validate endpoint
 * @param {string} deployData.imageTag - Container image tag to deploy
 * @returns {Promise<Object>} Deployment response
 * @throws {Error} If deployment fails
 */
async function deployPipeline(controllerUrl, envKey, authConfig, deployData) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`/api/v1/pipeline/${envKey}/deploy`, {
    body: deployData
  });
}

/**
 * Get deployment status for CI/CD
 * GET /api/v1/pipeline/{envKey}/deployments/{deploymentId}
 * @async
 * @function getPipelineDeployment
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {string} deploymentId - Deployment ID
 * @param {Object} authConfig - Authentication configuration (supports client credentials)
 * @returns {Promise<Object>} Minimal deployment status response
 * @throws {Error} If request fails
 */
async function getPipelineDeployment(controllerUrl, envKey, deploymentId, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/pipeline/${envKey}/deployments/${deploymentId}`);
}

/**
 * Pipeline health check
 * GET /api/v1/pipeline/{envKey}/health
 * @async
 * @function getPipelineHealth
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @returns {Promise<Object>} Health check response (public endpoint, no auth required)
 * @throws {Error} If request fails
 */
async function getPipelineHealth(controllerUrl, envKey) {
  const client = new ApiClient(controllerUrl);
  return await client.get(`/api/v1/pipeline/${envKey}/health`);
}

/**
 * Publish one external system via dataplane pipeline endpoint
 * POST /api/v1/pipeline/publish
 * Request body: external system JSON (external-system.schema.json). Optional field in body:
 * generateMcpContract (boolean, default true). Optional: generateOpenApiContract (boolean).
 * Do not use query parameters for MCP; use the field in the body only.
 *
 * @async
 * @function publishSystemViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} systemConfig - External system configuration (conforms to external-system.schema.json)
 * @returns {Promise<Object>} Published external system response
 * @throws {Error} If publish fails
 */
async function publishSystemViaPipeline(dataplaneUrl, authConfig, systemConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/pipeline/publish', {
    body: systemConfig
  });
}

/**
 * Publish datasource via dataplane pipeline endpoint
 * POST /api/v1/pipeline/{systemKey}/publish
 * No generateMcpContract for this endpoint; dataplane always uses default (MCP generated).
 *
 * @async
 * @function publishDatasourceViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} datasourceConfig - Datasource configuration to publish
 * @returns {Promise<Object>} Publish response
 * @throws {Error} If publish fails
 */
async function publishDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/pipeline/${systemKey}/publish`, {
    body: datasourceConfig
  });
}

/**
 * Test datasource via dataplane pipeline endpoint
 * POST /api/v1/pipeline/{systemKey}/{datasourceKey}/test
 * @async
 * @function testDatasourceViaPipeline
 * @param {Object} params - Function parameters
 * @param {string} params.dataplaneUrl - Dataplane base URL
 * @param {string} params.systemKey - System key
 * @param {string} params.datasourceKey - Datasource key
 * @param {Object} params.authConfig - Authentication configuration
 * @param {Object} params.testData - Test data
 * @param {Object} params.testData.payloadTemplate - Test payload template
 * @param {Object} [params.options] - Request options
 * @param {number} [params.options.timeout] - Request timeout in milliseconds
 * @returns {Promise<Object>} Test response
 * @throws {Error} If test fails
 */
async function testDatasourceViaPipeline({ dataplaneUrl, systemKey, datasourceKey, authConfig, testData, options = {} }) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  const requestOptions = {
    body: testData
  };
  // Pass through timeout if provided (will be handled by underlying fetch implementation)
  if (options.timeout) {
    requestOptions.timeout = options.timeout;
  }
  return await client.post(`/api/v1/pipeline/${systemKey}/${datasourceKey}/test`, requestOptions);
}

/**
 * Deploy external system via dataplane pipeline endpoint
 * POST /api/v1/pipeline/deploy
 * @async
 * @function deployExternalSystemViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} systemConfig - External system configuration to deploy
 * @returns {Promise<Object>} Deployment response
 * @throws {Error} If deployment fails
 */
async function deployExternalSystemViaPipeline(dataplaneUrl, authConfig, systemConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/pipeline/deploy', {
    body: systemConfig
  });
}

/**
 * Deploy datasource via dataplane pipeline endpoint
 * POST /api/v1/pipeline/{systemKey}/deploy
 * @async
 * @function deployDatasourceViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} datasourceConfig - Datasource configuration to deploy
 * @returns {Promise<Object>} Deployment response
 * @throws {Error} If deployment fails
 */
async function deployDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/pipeline/${systemKey}/deploy`, {
    body: datasourceConfig
  });
}

/**
 * Upload application configuration via dataplane pipeline endpoint
 * POST /api/v1/pipeline/upload
 * Body: { version, application, dataSources }. Include application.generateMcpContract
 * and/or application.generateOpenApiContract to control contract generation when
 * publishing this upload (publish reads from stored config; no query param on publish).
 *
 * @async
 * @function uploadApplicationViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} applicationSchema - { version, application, dataSources }; application may include generateMcpContract, generateOpenApiContract
 * @returns {Promise<Object>} Upload response with uploadId
 * @throws {Error} If upload fails
 */
async function uploadApplicationViaPipeline(dataplaneUrl, authConfig, applicationSchema) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/pipeline/upload', {
    body: applicationSchema
  });
}

/**
 * Validate upload via dataplane pipeline endpoint
 * POST /api/v1/pipeline/upload/{uploadId}/validate
 * @async
 * @function validateUploadViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} uploadId - Upload ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Validation response with changes and summary
 * @throws {Error} If validation fails
 */
async function validateUploadViaPipeline(dataplaneUrl, uploadId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/pipeline/upload/${uploadId}/validate`);
}

/**
 * Publish upload via dataplane pipeline endpoint
 * POST /api/v1/pipeline/upload/{uploadId}/publish
 * No body or query parameters. MCP/OpenAPI generation is taken from the application config
 * that was uploaded (application.generateMcpContract, application.generateOpenApiContract).
 * To control MCP/OpenAPI, include those fields in the application object when calling
 * uploadApplicationViaPipeline.
 *
 * @async
 * @function publishUploadViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} uploadId - Upload ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Publish response
 * @throws {Error} If publish fails
 */
async function publishUploadViaPipeline(dataplaneUrl, uploadId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/pipeline/upload/${uploadId}/publish`);
}

module.exports = {
  validatePipeline,
  deployPipeline,
  getPipelineDeployment,
  getPipelineHealth,
  publishSystemViaPipeline,
  publishDatasourceViaPipeline,
  testDatasourceViaPipeline,
  deployExternalSystemViaPipeline,
  deployDatasourceViaPipeline,
  uploadApplicationViaPipeline,
  validateUploadViaPipeline,
  publishUploadViaPipeline
};

