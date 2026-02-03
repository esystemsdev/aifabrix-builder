/**
 * @fileoverview Wizard API functions for external system creation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');
const { uploadFile } = require('../utils/file-upload');

/**
 * Create wizard session
 * POST /api/v1/wizard/sessions
 * @async
 * @function createWizardSession
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} mode - Wizard mode ('create-system' | 'add-datasource')
 * @param {string} [systemIdOrKey] - Existing system ID or key (required when mode='add-datasource')
 * @returns {Promise<Object>} Session creation response with sessionId
 * @throws {Error} If request fails
 */
async function createWizardSession(dataplaneUrl, authConfig, mode, systemIdOrKey = null) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  const body = { mode };
  if (systemIdOrKey) {
    body.systemIdOrKey = systemIdOrKey;
  }
  return await client.post('/api/v1/wizard/sessions', {
    body
  });
}

/**
 * Get wizard session
 * GET /api/v1/wizard/sessions/{sessionId}
 * @async
 * @function getWizardSession
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sessionId - Session ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Session state response
 * @throws {Error} If request fails
 */
async function getWizardSession(dataplaneUrl, sessionId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/wizard/sessions/${sessionId}`);
}

/**
 * Update wizard session
 * PUT /api/v1/wizard/sessions/{sessionId}
 * @async
 * @function updateWizardSession
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sessionId - Session ID
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} updateData - Session update data
 * @param {number} [updateData.currentStep] - Current wizard step (0-6)
 * @param {string} [updateData.credentialIdOrKey] - Selected credential ID or key
 * @param {Object} [updateData.openapiSpec] - Parsed OpenAPI specification
 * @param {string} [updateData.mcpServerUrl] - MCP server URL
 * @param {Array} [updateData.detectedTypes] - Detected API types
 * @param {string} [updateData.selectedType] - Selected API type
 * @param {string} [updateData.intent] - User intent
 * @param {string} [updateData.fieldOnboardingLevel] - Field onboarding level
 * @param {boolean} [updateData.enableOpenAPIGeneration] - Enable OpenAPI generation
 * @param {Object} [updateData.systemConfig] - Generated system configuration
 * @param {Object} [updateData.datasourceConfig] - Generated datasource configuration
 * @param {Object} [updateData.validationResults] - Validation results
 * @returns {Promise<Object>} Updated session state response
 * @throws {Error} If request fails
 */
async function updateWizardSession(dataplaneUrl, sessionId, authConfig, updateData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.put(`/api/v1/wizard/sessions/${sessionId}`, {
    body: updateData
  });
}

/**
 * Delete wizard session
 * DELETE /api/v1/wizard/sessions/{sessionId}
 * @async
 * @function deleteWizardSession
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sessionId - Session ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Delete response
 * @throws {Error} If request fails
 */
async function deleteWizardSession(dataplaneUrl, sessionId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.delete(`/api/v1/wizard/sessions/${sessionId}`);
}

/**
 * Get wizard session progress
 * GET /api/v1/wizard/sessions/{sessionId}/progress
 * @async
 * @function getWizardProgress
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sessionId - Session ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Session progress response
 * @throws {Error} If request fails
 */
async function getWizardProgress(dataplaneUrl, sessionId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/wizard/sessions/${sessionId}/progress`);
}

/**
 * Parse OpenAPI file or URL
 * POST /api/v1/wizard/parse-openapi
 * @async
 * @function parseOpenApi
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} openApiFilePathOrUrl - Path to OpenAPI file or URL
 * @param {boolean} [isUrl=false] - Whether the input is a URL
 * @returns {Promise<Object>} Parsed OpenAPI response
 * @throws {Error} If request fails
 */
async function parseOpenApi(dataplaneUrl, authConfig, openApiFilePathOrUrl, isUrl = false) {
  if (isUrl) {
    const client = new ApiClient(dataplaneUrl, authConfig);
    return await client.post(`/api/v1/wizard/parse-openapi?url=${encodeURIComponent(openApiFilePathOrUrl)}`);
  }
  const url = `${dataplaneUrl.replace(/\/$/, '')}/api/v1/wizard/parse-openapi`;
  return await uploadFile(url, openApiFilePathOrUrl, 'file', authConfig);
}

/**
 * Credential selection for wizard
 * POST /api/v1/wizard/credential-selection
 * @async
 * @function credentialSelection
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} selectionData - Credential selection data
 * @param {string} selectionData.action - Action type ('create' | 'select' | 'skip')
 * @param {Object} [selectionData.credentialConfig] - Credential config (required when action='create')
 * @param {string} [selectionData.credentialIdOrKey] - Credential ID or key (required when action='select')
 * @returns {Promise<Object>} Credential selection response
 * @throws {Error} If request fails
 */
async function credentialSelection(dataplaneUrl, authConfig, selectionData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/credential-selection', {
    body: selectionData
  });
}

/**
 * Detect API type from OpenAPI spec
 * POST /api/v1/wizard/detect-type
 * @async
 * @function detectType
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} openapiSpec - OpenAPI specification object
 * @returns {Promise<Object>} Type detection response
 * @throws {Error} If request fails
 */
async function detectType(dataplaneUrl, authConfig, openapiSpec) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/detect-type', {
    body: { openapiSpec }
  });
}

/**
 * Generate configuration via AI
 * POST /api/v1/wizard/generate-config
 * @async
 * @function generateConfig
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} config - Generation configuration
 * @param {Object} config.openapiSpec - OpenAPI specification object (required)
 * @param {string} config.detectedType - Detected API type (required, e.g., 'record-based')
 * @param {string} config.intent - User intent (required, any descriptive text)
 * @param {string} config.mode - Wizard mode (required, 'create-system' | 'add-datasource')
 * @param {string} [config.systemIdOrKey] - Existing system ID/key (required for add-datasource)
 * @param {string} [config.credentialIdOrKey] - Credential ID or key
 * @param {string} [config.fieldOnboardingLevel] - Field onboarding level ('full' | 'standard' | 'minimal')
 * @param {boolean} [config.enableOpenAPIGeneration] - Enable OpenAPI operation generation
 * @param {Object} [config.userPreferences] - User preferences
 * @param {boolean} [config.userPreferences.enableMCP] - Enable MCP
 * @param {boolean} [config.userPreferences.enableABAC] - Enable ABAC
 * @param {boolean} [config.userPreferences.enableRBAC] - Enable RBAC
 * @returns {Promise<Object>} Generated configuration response
 * @throws {Error} If request fails
 */
async function generateConfig(dataplaneUrl, authConfig, config) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/generate-config', {
    body: config
  });
}

/**
 * Generate configuration via AI (streaming)
 * POST /api/v1/wizard/generate-config-stream
 * @async
 * @function generateConfigStream
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} config - Generation configuration payload
 * @returns {Promise<Object>} Streaming generation response
 * @throws {Error} If request fails
 */
async function generateConfigStream(dataplaneUrl, authConfig, config) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/generate-config-stream', {
    body: config
  });
}

/**
 * Validate wizard configuration
 * POST /api/v1/wizard/validate
 * @async
 * @function validateWizardConfig
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} systemConfig - System configuration to validate
 * @param {Object|Object[]} datasourceConfig - Datasource configuration(s) to validate
 * @returns {Promise<Object>} Validation response
 * @throws {Error} If request fails
 */
async function validateWizardConfig(dataplaneUrl, authConfig, systemConfig, datasourceConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/validate', {
    body: {
      systemConfig,
      datasourceConfig
    }
  });
}

/**
 * Validate all completed wizard steps
 * GET /api/v1/wizard/sessions/{sessionId}/validate
 * @async
 * @function validateAllSteps
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sessionId - Session ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Validation response for all steps
 * @throws {Error} If request fails
 */
async function validateAllSteps(dataplaneUrl, sessionId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/wizard/sessions/${sessionId}/validate`);
}

/**
 * Validate specific wizard step
 * POST /api/v1/wizard/sessions/{sessionId}/validate-step
 * @async
 * @function validateStep
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sessionId - Session ID
 * @param {Object} authConfig - Authentication configuration
 * @param {number} stepNumber - Step number to validate (1-7)
 * @returns {Promise<Object>} Validation response for the step
 * @throws {Error} If request fails
 */
async function validateStep(dataplaneUrl, sessionId, authConfig, stepNumber) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/wizard/sessions/${sessionId}/validate-step?step=${stepNumber}`);
}

/**
 * Get configuration preview with summaries
 * GET /api/v1/wizard/preview/{sessionId}
 * @async
 * @function getPreview
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sessionId - Session ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Preview response with system and datasource summaries
 * @throws {Error} If request fails
 */
async function getPreview(dataplaneUrl, sessionId, authConfig) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/wizard/preview/${sessionId}`);
}

/**
 * Test MCP server connection
 * POST /api/v1/wizard/test-mcp-connection
 * @async
 * @function testMcpConnection
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} serverUrl - MCP server URL
 * @param {string} token - MCP server authentication token
 * @returns {Promise<Object>} Connection test response
 * @throws {Error} If request fails
 */
async function testMcpConnection(dataplaneUrl, authConfig, serverUrl, token) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/test-mcp-connection', {
    body: {
      serverUrl,
      token
    }
  });
}

/**
 * Get deployment documentation for a system (from dataplane DB only)
 * GET /api/v1/wizard/deployment-docs/{systemKey}
 * @async
 * @function getDeploymentDocs
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} systemKey - System key identifier
 * @returns {Promise<Object>} Deployment documentation response
 * @throws {Error} If request fails
 */
async function getDeploymentDocs(dataplaneUrl, authConfig, systemKey) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.get(`/api/v1/wizard/deployment-docs/${systemKey}`);
}

/**
 * Generate deployment documentation with variables.yaml and deploy JSON for better quality
 * POST /api/v1/wizard/deployment-docs/{systemKey}
 * Sends deployJson and variablesYaml in the request body so the dataplane can align README with the integration folder.
 * @async
 * @function postDeploymentDocs
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} systemKey - System key identifier
 * @param {Object} [body] - Optional request body (WizardDeploymentDocsRequest)
 * @param {Object} [body.deployJson] - Deploy JSON object (e.g. *-deploy.json content)
 * @param {string} [body.variablesYaml] - variables.yaml file content as string
 * @returns {Promise<Object>} Deployment documentation response (content, contentType, systemKey)
 * @throws {Error} If request fails
 */
async function postDeploymentDocs(dataplaneUrl, authConfig, systemKey, body = null) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(`/api/v1/wizard/deployment-docs/${systemKey}`, {
    body: body || {}
  });
}

/**
 * Get known wizard platforms from dataplane.
 * GET /api/v1/wizard/platforms
 * Expected response: { platforms: [ { key: string, displayName?: string } ] } or equivalent.
 * On 404 or error, returns empty array (caller should hide "Known platform" choice).
 * @async
 * @function getWizardPlatforms
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Array<{key: string, displayName?: string}>>} List of platforms (empty on 404/error)
 */
async function getWizardPlatforms(dataplaneUrl, authConfig) {
  try {
    const client = new ApiClient(dataplaneUrl, authConfig);
    const response = await client.get('/api/v1/wizard/platforms');
    const platforms = response?.data?.platforms ?? response?.platforms ?? [];
    return Array.isArray(platforms) ? platforms : [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  createWizardSession,
  getWizardSession,
  updateWizardSession,
  deleteWizardSession,
  getWizardProgress,
  parseOpenApi,
  credentialSelection,
  detectType,
  generateConfig,
  generateConfigStream,
  validateWizardConfig,
  validateAllSteps,
  validateStep,
  getPreview,
  testMcpConnection,
  getDeploymentDocs,
  postDeploymentDocs,
  getWizardPlatforms
};
