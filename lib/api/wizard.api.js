/**
 * @fileoverview Wizard API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');
const { uploadFile } = require('../utils/file-upload');

/**
 * Select wizard mode
 * POST /api/v1/wizard/mode-selection
 * @async
 * @function selectMode
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} mode - Wizard mode ('create-system' | 'add-datasource')
 * @returns {Promise<Object>} Mode selection response
 * @throws {Error} If request fails
 */
async function selectMode(dataplaneUrl, authConfig, mode) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/mode-selection', {
    body: { mode }
  });
}

/**
 * Select wizard source
 * POST /api/v1/wizard/source-selection
 * @async
 * @function selectSource
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} sourceType - Source type ('openapi-file' | 'openapi-url' | 'mcp-server' | 'known-platform')
 * @param {string} [sourceData] - Source data (file path, URL, etc.)
 * @returns {Promise<Object>} Source selection response
 * @throws {Error} If request fails
 */
async function selectSource(dataplaneUrl, authConfig, sourceType, sourceData) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/wizard/source-selection', {
    body: {
      sourceType,
      sourceData
    }
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

module.exports = {
  selectMode,
  selectSource,
  parseOpenApi,
  detectType,
  generateConfig,
  validateWizardConfig,
  testMcpConnection
};

