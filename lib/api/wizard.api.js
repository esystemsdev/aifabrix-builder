/**
 * @fileoverview Wizard API functions
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
 * @param {string} [systemId] - Existing system ID (required when mode='add-datasource')
 * @returns {Promise<Object>} Session creation response with sessionId
 * @throws {Error} If request fails
 */
async function createWizardSession(dataplaneUrl, authConfig, mode, systemId = null) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  const body = { mode };
  if (systemId) {
    body.systemId = systemId;
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
 * PATCH /api/v1/wizard/sessions/{sessionId}
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
  return await client.patch(`/api/v1/wizard/sessions/${sessionId}`, {
    body: updateData
  });
}

/**
 * Parse OpenAPI file
 * POST /api/v1/wizard/parse-openapi
 * @async
 * @function parseOpenApi
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} openApiFilePath - Path to OpenAPI file
 * @returns {Promise<Object>} Parsed OpenAPI response
 * @throws {Error} If request fails
 */
async function parseOpenApi(dataplaneUrl, authConfig, openApiFilePath) {
  const url = `${dataplaneUrl.replace(/\/$/, '')}/api/v1/wizard/parse-openapi`;
  return await uploadFile(url, openApiFilePath, 'file', authConfig);
}

/**
 * Detect API type from OpenAPI spec
 * POST /api/v1/wizard/detect-type
 * @async
 * @function detectType
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} openApiSpec - OpenAPI specification object
 * @returns {Promise<Object>} Type detection response
 * @throws {Error} If request fails
 */
async function detectType(dataplaneUrl, authConfig, openApiSpec) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/detect-type', {
    body: { openApiSpec }
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
 * @param {string} config.mode - Wizard mode
 * @param {string} config.sourceType - Source type
 * @param {Object} [config.openApiSpec] - OpenAPI specification (if applicable)
 * @param {string} [config.userIntent] - User intent (e.g., 'sales-focused', 'support-focused')
 * @param {Object} [config.preferences] - User preferences
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
 * Validate wizard configuration
 * POST /api/v1/wizard/validate
 * @async
 * @function validateWizardConfig
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} systemConfig - System configuration to validate
 * @param {Object[]} datasourceConfigs - Array of datasource configurations to validate
 * @returns {Promise<Object>} Validation response
 * @throws {Error} If request fails
 */
async function validateWizardConfig(dataplaneUrl, authConfig, systemConfig, datasourceConfigs) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/validate', {
    body: {
      systemConfig,
      datasourceConfigs
    }
  });
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
 * Get deployment documentation for a system
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

module.exports = {
  createWizardSession,
  getWizardSession,
  updateWizardSession,
  parseOpenApi,
  detectType,
  generateConfig,
  validateWizardConfig,
  testMcpConnection,
  getDeploymentDocs
};

