/**
 * @fileoverview Wizard API type definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Wizard mode selection request
 * @typedef {Object} WizardModeSelectionRequest
 * @property {string} mode - Wizard mode ('create-system' | 'add-datasource')
 */

/**
 * Wizard mode selection response
 * @typedef {Object} WizardModeSelectionResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Mode selection data
 * @property {string} data.mode - Selected mode
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard source selection request
 * @typedef {Object} WizardSourceSelectionRequest
 * @property {string} sourceType - Source type ('openapi-file' | 'openapi-url' | 'mcp-server' | 'known-platform')
 * @property {string} [sourceData] - Source data (file path, URL, etc.)
 */

/**
 * Wizard source selection response
 * @typedef {Object} WizardSourceSelectionResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Source selection data
 * @property {string} data.sourceType - Selected source type
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard parse OpenAPI response
 * @typedef {Object} WizardParseOpenApiResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Parsed OpenAPI data
 * @property {Object} data.spec - Parsed OpenAPI specification
 * @property {string} data.version - OpenAPI version
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard detect type request
 * @typedef {Object} WizardDetectTypeRequest
 * @property {Object} openApiSpec - OpenAPI specification object
 */

/**
 * Wizard detect type response
 * @typedef {Object} WizardDetectTypeResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Type detection data
 * @property {string} data.apiType - Detected API type (e.g., 'rest', 'graphql', 'rpc')
 * @property {string} data.category - API category (e.g., 'crm', 'support', 'sales')
 * @property {Object} data.confidence - Confidence scores for detection
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard generate config request
 * @typedef {Object} WizardGenerateConfigRequest
 * @property {string} mode - Wizard mode
 * @property {string} sourceType - Source type
 * @property {Object} [openApiSpec] - OpenAPI specification (if applicable)
 * @property {string} [userIntent] - User intent (e.g., 'sales-focused', 'support-focused')
 * @property {Object} [preferences] - User preferences
 * @property {boolean} [preferences.mcp] - Enable MCP
 * @property {boolean} [preferences.abac] - Enable ABAC
 * @property {boolean} [preferences.rbac] - Enable RBAC
 */

/**
 * Wizard generate config response
 * @typedef {Object} WizardGenerateConfigResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Generated configuration data
 * @property {Object} data.systemConfig - External system configuration
 * @property {Object[]} data.datasourceConfigs - Array of datasource configurations
 * @property {string} data.systemKey - Generated system key
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard validate request
 * @typedef {Object} WizardValidateRequest
 * @property {Object} systemConfig - System configuration to validate
 * @property {Object[]} datasourceConfigs - Array of datasource configurations to validate
 */

/**
 * Wizard validate response
 * @typedef {Object} WizardValidateResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Validation data
 * @property {boolean} data.valid - Whether configuration is valid
 * @property {Object[]} [data.errors] - Array of validation errors (if invalid)
 * @property {Object[]} [data.warnings] - Array of validation warnings
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard test MCP connection request
 * @typedef {Object} WizardTestMcpConnectionRequest
 * @property {string} serverUrl - MCP server URL
 * @property {string} token - MCP server authentication token
 */

/**
 * Wizard test MCP connection response
 * @typedef {Object} WizardTestMcpConnectionResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Connection test data
 * @property {boolean} data.connected - Whether connection was successful
 * @property {string} [data.error] - Error message (if connection failed)
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

module.exports = {};

