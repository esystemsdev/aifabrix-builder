/**
 * @fileoverview Pipeline API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * @param {Object} opts
 * @param {'externalSystem'|'externalDataSource'} opts.validationScope
 * @param {string} opts.systemKey
 * @param {string} [opts.datasourceKey]
 * @param {Object} [opts.testData]
 * @returns {Object}
 */
function buildValidationRunPayloadTestBody({ validationScope, systemKey, datasourceKey, testData = {} }) {
  const body = {
    validationScope,
    runType: 'test',
    systemIdOrKey: systemKey
  };
  if (testData.payloadTemplate !== undefined && testData.payloadTemplate !== null) {
    body.payloadTemplate = testData.payloadTemplate;
  }
  if (testData.includeDebug === true) {
    body.includeDebug = true;
  }
  if (validationScope === 'externalDataSource') {
    body.datasourceKeys = [datasourceKey];
  }
  return body;
}

/**
 * Validate deployment configuration
 * POST /api/v1/pipeline/{envKey}/validate
 * @requiresPermission {Controller} applications:deploy
 * @async
 * @function validatePipeline
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration (Bearer token only for app endpoints)
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
 * @requiresPermission {Controller} applications:deploy
 * @async
 * @function deployPipeline
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration (Bearer token only for app endpoints)
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
 * @requiresPermission {Controller} applications:deploy
 * @async
 * @function getPipelineDeployment
 * @param {string} controllerUrl - Controller base URL
 * @param {string} envKey - Environment key
 * @param {string} deploymentId - Deployment ID
 * @param {Object} authConfig - Authentication configuration (Bearer token only for app endpoints)
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
 * @requiresPermission {Controller} Public (no auth required)
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
 * Publish datasource via dataplane pipeline endpoint
 * POST /api/v1/pipeline/{systemKey}/upload (Dataplane: renamed from /publish)
 * No generateMcpContract for this endpoint; dataplane always uses default (MCP generated).
 * @requiresPermission {Dataplane} external-system:publish. Auth: OAuth2 (Bearer) or API_KEY only; client id/secret are not accepted.
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
  return await client.post(`/api/v1/pipeline/${systemKey}/upload`, {
    body: datasourceConfig
  });
}

/**
 * Validate pipeline config against Dataplane (dry-run; no publish).
 * POST /api/v1/pipeline/validate
 * @requiresPermission {Dataplane} external-system:read or external-system:publish
 * @async
 * @function validatePipelineConfig
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} params - Request params
 * @param {Object} params.config - Full config: { version, application, dataSources }
 * @returns {Promise<Object>} { isValid, errors, warnings }
 * @throws {Error} If request fails
 */
async function validatePipelineConfig(dataplaneUrl, authConfig, { config }) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/pipeline/validate', {
    body: { config }
  });
}

/**
 * Test external system (all datasources) via unified validation API
 * POST /api/v1/validation/run (validationScope=externalSystem, runType=test).
 * Omits **payloadTemplate** unless `testData.payloadTemplate` is set so the dataplane runs the
 * validation-engine path (not payload-template-only). Pass `payloadTemplate` explicitly for template tests.
 * @requiresPermission {Dataplane} external-system:publish. Auth: Bearer or x-client-token only.
 * @async
 * @function testSystemViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration (Bearer token)
 * @param {Object} testData - Test data
 * @param {Object} [testData.payloadTemplate] - Optional payload template
 * @param {boolean} [testData.includeDebug] - Include debug output in response
 * @param {Object} [options] - Request options
 * @param {number} [options.timeout] - Request timeout in milliseconds
 * @returns {Promise<Object>} Test response
 * @throws {Error} If test fails
 */
async function testSystemViaPipeline(dataplaneUrl, systemKey, authConfig, testData = {}, options = {}) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  const body = buildValidationRunPayloadTestBody({
    validationScope: 'externalSystem',
    systemKey,
    testData
  });
  const requestOptions = { body };
  if (options.timeout) {
    requestOptions.timeout = options.timeout;
  }
  return await client.post('/api/v1/validation/run', requestOptions);
}

/**
 * Test datasource via unified validation API
 * POST /api/v1/validation/run (validationScope=externalDataSource, datasourceKeys, payloadTemplate)
 * Supports client credentials for CI/CD.
 * @requiresPermission {Dataplane} external-system:publish or external-data-source:read. Auth: Bearer or x-client-token only.
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
  const body = buildValidationRunPayloadTestBody({
    validationScope: 'externalDataSource',
    systemKey,
    datasourceKey,
    testData
  });
  const requestOptions = { body };
  if (options.timeout) {
    requestOptions.timeout = options.timeout;
  }
  return await client.post('/api/v1/validation/run', requestOptions);
}

/**
 * Upload application configuration via dataplane pipeline endpoint (single call: upload → validate → publish → controller register).
 * POST /api/v1/pipeline/upload
 * Body: { version, application, dataSources, status }. status "draft" (default) or "published".
 * Include application.generateMcpContract and/or application.generateOpenApiContract to control contract generation.
 * @requiresPermission {Dataplane} external-system:publish. Auth: OAuth2 (Bearer) or API_KEY only; client id/secret are not accepted.
 * @async
 * @function uploadApplicationViaPipeline
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration (must include token for Bearer; client id/secret rejected)
 * @param {Object} payload - { version, application, dataSources }; optional status (default "draft")
 * @param {string} [payload.status="draft"] - "draft" or "published"; Builder uses "draft"
 * @returns {Promise<Object>} API envelope `{ success, data }` where `data` is PublicationResult (uploadId, system, datasources, generateMcpContract, …)
 * @throws {Error} If upload fails
 */
async function uploadApplicationViaPipeline(dataplaneUrl, authConfig, payload) {
  const body = { ...payload, status: payload.status ?? 'draft' };
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/pipeline/upload', {
    body
  });
}

module.exports = {
  validatePipeline,
  deployPipeline,
  getPipelineDeployment,
  getPipelineHealth,
  publishDatasourceViaPipeline,
  validatePipelineConfig,
  testSystemViaPipeline,
  testDatasourceViaPipeline,
  uploadApplicationViaPipeline
};

