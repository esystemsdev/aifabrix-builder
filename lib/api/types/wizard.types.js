/**
 * @fileoverview Wizard API type definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Wizard session request
 * @typedef {Object} WizardSessionRequest
 * @property {string} mode - Wizard mode ('create-system' | 'add-datasource')
 * @property {string} [systemIdOrKey] - Existing system ID or key (required when mode='add-datasource')
 */

/**
 * Wizard session response
 * @typedef {Object} WizardSessionResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Session data
 * @property {Object} data.sessionId - Session identifier object
 * @property {string} data.sessionId.id - Session ID
 * @property {string} data.sessionId.key - Session key
 * @property {string} data.sessionId.name - Session name
 * @property {string} data.sessionId.type - Session type ('WizardSession')
 * @property {string} data.expiresAt - Session expiration timestamp (ISO 8601)
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard session delete response
 * @typedef {Object} WizardDeleteSessionResponse
 * @property {boolean} success - Request success flag
 * @property {Object} [data] - Delete response data
 * @property {string} [data.message] - Confirmation message
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard session progress response
 * @typedef {Object} WizardProgressResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Progress data
 * @property {number} data.currentStep - Current step number
 * @property {number} data.totalSteps - Total number of steps
 * @property {string[]} data.completedSteps - Array of completed step names
 * @property {boolean} data.canProceed - Whether user can proceed to next step
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Credential selection request
 * @typedef {Object} CredentialSelectionRequest
 * @property {string} action - Action type ('create' | 'select' | 'skip')
 * @property {Object} [credentialConfig] - Credential config (required when action='create')
 * @property {string} [credentialConfig.key] - Credential key
 * @property {string} [credentialConfig.displayName] - Credential display name
 * @property {string} [credentialConfig.type] - Credential type (e.g., 'OAUTH2', 'API_KEY')
 * @property {Object} [credentialConfig.config] - Credential configuration
 * @property {string} [credentialIdOrKey] - Credential ID or key (required when action='select')
 */

/**
 * Credential selection response
 * @typedef {Object} CredentialSelectionResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Credential selection data
 * @property {string} data.action - Selected action
 * @property {string} [data.credentialIdOrKey] - Selected or created credential ID/key
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard parse OpenAPI response
 * @typedef {Object} WizardParseOpenApiResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Parsed OpenAPI data
 * @property {Object} data.spec - Parsed OpenAPI specification
 * @property {string} data.validationStatus - Validation status ('valid' | 'invalid')
 * @property {string[]} [data.validationErrors] - Validation errors (if any)
 * @property {Object} data.specInfo - Specification info
 * @property {string} data.specInfo.title - API title
 * @property {string} data.specInfo.version - API version
 * @property {string[]} data.specInfo.servers - Server URLs
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard detect type request
 * @typedef {Object} WizardDetectTypeRequest
 * @property {Object} openapiSpec - OpenAPI specification object
 */

/**
 * Wizard detect type response
 * @typedef {Object} WizardDetectTypeResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Type detection data
 * @property {Object[]} data.detectedTypes - Array of detected types with confidence
 * @property {string} data.detectedTypes[].type - Detected type
 * @property {number} data.detectedTypes[].confidence - Confidence score (0-1)
 * @property {string} data.detectedTypes[].reasoning - Reasoning for detection
 * @property {string} data.recommendedType - Recommended type
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard generate config request
 * @typedef {Object} WizardGenerateConfigRequest
 * @property {Object} openapiSpec - OpenAPI specification object (required)
 * @property {string} detectedType - Detected API type (required, e.g., 'record-based')
 * @property {string} intent - User intent (required, any descriptive text)
 * @property {string} mode - Wizard mode (required, 'create-system' | 'add-datasource')
 * @property {string} [systemIdOrKey] - Existing system ID/key (required for add-datasource)
 * @property {string} [credentialIdOrKey] - Credential ID or key
 * @property {string} [fieldOnboardingLevel] - Field onboarding level ('full' | 'standard' | 'minimal')
 * @property {boolean} [enableOpenAPIGeneration] - Enable OpenAPI operation generation
 * @property {Object} [userPreferences] - User preferences
 * @property {boolean} [userPreferences.enableMCP] - Enable MCP
 * @property {boolean} [userPreferences.enableABAC] - Enable ABAC
 * @property {boolean} [userPreferences.enableRBAC] - Enable RBAC
 */

/**
 * Wizard generate config stream request
 * @typedef {WizardGenerateConfigRequest} WizardGenerateConfigStreamRequest
 */

/**
 * Wizard generate config response
 * @typedef {Object} WizardGenerateConfigResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Generated configuration data
 * @property {Object} data.systemConfig - External system configuration
 * @property {Object} data.datasourceConfig - Datasource configuration
 * @property {string} [data.systemKey] - Generated system key
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard generate config stream response
 * @typedef {Object} WizardGenerateConfigStreamResponse
 * @property {boolean} success - Request success flag
 * @property {Object} [data] - Stream response metadata
 * @property {string} [data.streamId] - Stream identifier
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard validate request
 * @typedef {Object} WizardValidateRequest
 * @property {Object} systemConfig - System configuration to validate
 * @property {Object|Object[]} datasourceConfig - Datasource configuration(s) to validate
 */

/**
 * Wizard validate response
 * @typedef {Object} WizardValidateResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Validation data
 * @property {boolean} data.isValid - Whether configuration is valid
 * @property {Object[]} [data.errors] - Array of validation errors (if invalid)
 * @property {string} data.errors[].severity - Error severity
 * @property {string} data.errors[].field - Field with error
 * @property {string} data.errors[].message - Error message
 * @property {Object[]} [data.warnings] - Array of validation warnings
 * @property {string} data.warnings[].severity - Warning severity
 * @property {string} data.warnings[].field - Field with warning
 * @property {string} data.warnings[].message - Warning message
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard validate all steps response
 * @typedef {Object} WizardValidateAllStepsResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Validation data
 * @property {boolean} data.isValid - Whether all steps are valid
 * @property {Object[]} [data.errors] - Array of validation errors (if invalid)
 * @property {Object[]} [data.warnings] - Array of validation warnings
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard step validation response
 * @typedef {Object} WizardStepValidationResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Step validation data
 * @property {number} data.step - Step number
 * @property {boolean} data.isValid - Whether step is valid
 * @property {Object[]} [data.errors] - Array of validation errors
 * @property {Object[]} [data.warnings] - Array of validation warnings
 * @property {string[]} [data.suggestions] - Array of suggestions
 * @property {boolean} data.canProceed - Whether user can proceed
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard preview response
 * @typedef {Object} WizardPreviewResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Preview data
 * @property {Object} data.sessionId - Session identifier
 * @property {Object} data.systemConfig - System configuration
 * @property {Object} data.datasourceConfig - Datasource configuration
 * @property {Object} data.systemSummary - System summary
 * @property {string} data.systemSummary.key - System key
 * @property {string} data.systemSummary.displayName - Display name
 * @property {string} data.systemSummary.type - System type
 * @property {string} data.systemSummary.baseUrl - Base URL
 * @property {string} data.systemSummary.authenticationType - Authentication type
 * @property {number} data.systemSummary.endpointCount - Number of endpoints
 * @property {Object} data.datasourceSummary - Datasource summary
 * @property {string} data.datasourceSummary.key - Datasource key
 * @property {string} data.datasourceSummary.entity - Entity name
 * @property {string} data.datasourceSummary.resourceType - Resource type
 * @property {number} data.datasourceSummary.cipStepCount - Number of CIP steps
 * @property {number} data.datasourceSummary.fieldMappingCount - Number of field mappings
 * @property {number} data.datasourceSummary.exposedProfileCount - Number of exposed profiles
 * @property {number} data.datasourceSummary.indexingFieldCount - Number of indexing fields
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

/**
 * Deployment docs response
 * @typedef {Object} DeploymentDocsResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Deployment documentation data
 * @property {string} data.systemKey - System key identifier
 * @property {string} data.content - README.md content (markdown)
 * @property {string} data.contentType - Content type (e.g., 'text/markdown')
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Wizard config YAML structure
 * @typedef {Object} WizardConfigYaml
 * @property {string} appName - Application name (pattern: ^[a-z0-9-_]+$)
 * @property {string} mode - Wizard mode ('create-system' | 'add-datasource')
 * @property {string} [systemIdOrKey] - Existing system ID/key (required when mode='add-datasource')
 * @property {Object} source - Source configuration
 * @property {string} source.type - Source type ('openapi-file' | 'openapi-url' | 'mcp-server' | 'known-platform')
 * @property {string} [source.filePath] - OpenAPI file path (for openapi-file)
 * @property {string} [source.url] - OpenAPI URL (for openapi-url)
 * @property {string} [source.serverUrl] - MCP server URL (for mcp-server)
 * @property {string} [source.token] - MCP token (for mcp-server, supports ${ENV_VAR})
 * @property {string} [source.platform] - Known platform (for known-platform)
 * @property {Object} [credential] - Credential configuration
 * @property {string} credential.action - Action ('create' | 'select' | 'skip')
 * @property {string} [credential.credentialIdOrKey] - Credential ID/key (for select)
 * @property {Object} [credential.config] - Credential config (for create)
 * @property {Object} [preferences] - Generation preferences
 * @property {string} [preferences.intent] - User intent (any descriptive text)
 * @property {string} [preferences.fieldOnboardingLevel] - Field level ('full' | 'standard' | 'minimal')
 * @property {boolean} [preferences.enableOpenAPIGeneration] - Enable OpenAPI generation
 * @property {boolean} [preferences.enableMCP] - Enable MCP
 * @property {boolean} [preferences.enableABAC] - Enable ABAC
 * @property {boolean} [preferences.enableRBAC] - Enable RBAC
 * @property {Object} [deployment] - Deployment settings
 * @property {string} [deployment.controller] - Controller URL
 * @property {string} [deployment.environment] - Environment key
 * @property {string} [deployment.dataplane] - Dataplane URL override
 */

module.exports = {};
