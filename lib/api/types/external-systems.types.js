/**
 * @fileoverview External Systems API type definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Pagination metadata
 * @typedef {Object} PaginationMeta
 * @property {number} page - Current page number
 * @property {number} pageSize - Number of items per page
 * @property {number} total - Total number of items
 * @property {number} totalPages - Total number of pages
 */

/**
 * Pagination links
 * @typedef {Object} PaginationLinks
 * @property {string} self - Current page URL
 * @property {string} first - First page URL
 * @property {string} last - Last page URL
 * @property {string|null} prev - Previous page URL (null if on first page)
 * @property {string|null} next - Next page URL (null if on last page)
 */

/**
 * External system response
 * @typedef {Object} ExternalSystemResponse
 * @property {string} id - System ID
 * @property {string} key - System key (unique identifier)
 * @property {string} displayName - Display name
 * @property {string|null} description - System description
 * @property {string} type - System type ('openapi' | 'mcp' | 'custom')
 * @property {string} status - Status ('draft' | 'published' | 'archived')
 * @property {boolean} isActive - Whether system is active
 * @property {Object} configuration - System configuration
 * @property {string} createdAt - Creation timestamp (ISO 8601)
 * @property {string} updatedAt - Update timestamp (ISO 8601)
 */

/**
 * External system create request
 * @typedef {Object} ExternalSystemCreate
 * @property {string} key - System key
 * @property {string} displayName - Display name
 * @property {string} [description] - Description
 * @property {string} type - System type ('openapi' | 'mcp' | 'custom')
 * @property {Object} [configuration] - System configuration
 */

/**
 * External system update request
 * @typedef {Object} ExternalSystemUpdate
 * @property {string} [displayName] - Display name
 * @property {string} [description] - Description
 * @property {Object} [configuration] - Configuration
 * @property {boolean} [isActive] - Active status
 */

/**
 * External system config response (with dataSources)
 * @typedef {Object} ExternalSystemConfigResponse
 * @property {ExternalSystemResponse} application - External system application schema
 * @property {Object[]} dataSources - Array of datasource configurations
 */

/**
 * List external systems request options
 * @typedef {Object} ListExternalSystemsRequest
 * @property {number} [page] - Page number (default: 1)
 * @property {number} [pageSize] - Items per page (default: 20)
 * @property {string} [sort] - Sort parameter
 * @property {string} [filter] - Filter parameter
 * @property {string} [search] - Search term
 */

/**
 * List external systems response
 * @typedef {Object} ListExternalSystemsResponse
 * @property {ExternalSystemResponse[]} items - Array of external systems
 * @property {PaginationMeta} meta - Pagination metadata
 * @property {PaginationLinks} links - Pagination links
 */

/**
 * Create external system request
 * @typedef {ExternalSystemCreate} CreateExternalSystemRequest
 */

/**
 * Create external system response
 * @typedef {Object} CreateExternalSystemResponse
 * @property {ExternalSystemResponse} data - Created external system
 */

/**
 * Get external system response
 * @typedef {Object} GetExternalSystemResponse
 * @property {ExternalSystemResponse} data - External system details
 */

/**
 * Update external system request
 * @typedef {ExternalSystemUpdate} UpdateExternalSystemRequest
 */

/**
 * Update external system response
 * @typedef {Object} UpdateExternalSystemResponse
 * @property {ExternalSystemResponse} data - Updated external system
 */

/**
 * Delete external system response
 * @typedef {Object} DeleteExternalSystemResponse
 * @property {null} data - Always null for DELETE operations
 */

/**
 * Get external system config response
 * @typedef {Object} GetExternalSystemConfigResponse
 * @property {ExternalSystemConfigResponse} data - Full config with application schema and dataSources
 */

/**
 * Create from template request
 * @typedef {Object} ExternalSystemCreateFromTemplate
 * @property {string} templateIdOrKey - Integration template ID or key
 * @property {string} key - System key
 * @property {string} displayName - Display name
 * @property {string} [description] - Description
 * @property {Object} [configuration] - Override configuration
 */

/**
 * Create from template request
 * @typedef {ExternalSystemCreateFromTemplate} CreateFromTemplateRequest
 */

/**
 * Create from template response
 * @typedef {Object} CreateFromTemplateResponse
 * @property {ExternalSystemResponse} data - Created external system (status='draft')
 */

/**
 * List OpenAPI files request options
 * @typedef {Object} ListOpenAPIFilesRequest
 * @property {number} [page] - Page number
 * @property {number} [pageSize] - Items per page
 * @property {string} [sort] - Sort parameter
 * @property {string} [filter] - Filter parameter
 */

/**
 * List OpenAPI files response
 * @typedef {Object} ListOpenAPIFilesResponse
 * @property {Object[]} items - Array of OpenAPI files
 * @property {PaginationMeta} meta - Pagination metadata
 * @property {PaginationLinks} links - Pagination links
 */

/**
 * List OpenAPI endpoints request options
 * @typedef {Object} ListOpenAPIEndpointsRequest
 * @property {number} [page] - Page number
 * @property {number} [pageSize] - Items per page
 * @property {string} [sort] - Sort parameter
 * @property {string} [filter] - Filter parameter
 */

/**
 * List OpenAPI endpoints response
 * @typedef {Object} ListOpenAPIEndpointsResponse
 * @property {Object[]} items - Array of OpenAPI endpoints
 * @property {PaginationMeta} meta - Pagination metadata
 * @property {PaginationLinks} links - Pagination links
 */

/**
 * Publish external system request
 * @typedef {Object} ExternalSystemPublishRequest
 * @property {boolean} [generateMcpContract] - Whether to generate MCP contract
 */

/**
 * Publish external system request
 * @typedef {ExternalSystemPublishRequest} PublishExternalSystemRequest
 */

/**
 * Publish external system response
 * @typedef {Object} PublishExternalSystemResponse
 * @property {ExternalSystemResponse} data - Published external system
 */

/**
 * Rollback external system request
 * @typedef {Object} ExternalSystemRollbackRequest
 * @property {number} version - Version to rollback to
 */

/**
 * Rollback external system request
 * @typedef {ExternalSystemRollbackRequest} RollbackExternalSystemRequest
 */

/**
 * Rollback external system response
 * @typedef {Object} RollbackExternalSystemResponse
 * @property {ExternalSystemResponse} data - Rolled back external system
 */

/**
 * Save template request
 * @typedef {Object} ExternalSystemSaveTemplateRequest
 * @property {string} templateKey - Template key
 * @property {string} templateName - Template name
 * @property {string} [description] - Template description
 */

/**
 * Save template request
 * @typedef {ExternalSystemSaveTemplateRequest} SaveAsTemplateRequest
 */

/**
 * Integration template response
 * @typedef {Object} IntegrationTemplateResponse
 * @property {string} id - Template ID
 * @property {string} key - Template key
 * @property {string} name - Template name
 * @property {string} [description] - Template description
 * @property {Object} configuration - Template configuration
 */

/**
 * Save template response
 * @typedef {Object} SaveAsTemplateResponse
 * @property {IntegrationTemplateResponse} data - Saved integration template
 */

module.exports = {};

