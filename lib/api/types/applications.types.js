/**
 * @fileoverview Applications API type definitions
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
 * Application configuration (references application-config.schema.yaml)
 * @typedef {Object} ApplicationConfig
 * @property {string} key - Unique application identifier
 * @property {string} displayName - Human-readable application name
 * @property {string} description - Application description
 * @property {string} type - Azure application type ('webapp' | 'functionapp' | 'api' | 'service' | 'external')
 * @property {string} [deploymentKey] - SHA256 hash of deployment manifest (Controller adds internally)
 * @property {string} [image] - Container image reference
 * @property {string} [registryMode] - Registry mode ('acr' | 'external' | 'public')
 * @property {number} [port] - Application port number
 * @property {Object} [externalIntegration] - External systems & data sources configuration
 * @property {Object} [system] - Inline external system configuration
 * @property {Object[]} [dataSources] - Inline external data source configurations
 * @property {boolean} [requiresDatabase] - Whether application requires database
 * @property {Object[]} [databases] - Database configurations
 * @property {boolean} [requiresRedis] - Whether application requires Redis
 * @property {boolean} [requiresStorage] - Whether application requires storage
 * @property {Object[]} [configuration] - Core application configuration
 * @property {Object[]} [conditionalConfiguration] - Conditional configuration
 * @property {Object} [healthCheck] - Health check configuration
 * @property {Object} [frontDoorRouting] - Front Door routing configuration
 * @property {Object} [authentication] - Authentication configuration
 * @property {Object[]} [roles] - Application roles
 * @property {Object[]} [permissions] - Application permissions
 * @property {Object} [repository] - Repository deployment configuration
 * @property {string} [startupCommand] - Application startup command
 * @property {Object} [runtimeVersion] - Runtime version configuration
 * @property {Object} [scaling] - Application scaling configuration
 * @property {Object} [build] - Build and local development configuration
 * @property {Object} [deployment] - Deployment configuration for pipeline API
 */

/**
 * Application entity
 * @typedef {Object} Application
 * @property {string} id - Application ID
 * @property {string} key - Application key (unique identifier)
 * @property {string} displayName - Display name
 * @property {string|null} description - Application description
 * @property {string|null} url - Application URL
 * @property {ApplicationConfig} configuration - Application configuration
 * @property {string} status - Application status ('healthy' | 'degraded' | 'deploying' | 'error' | 'maintenance')
 * @property {string} createdAt - Creation timestamp (ISO 8601)
 * @property {string} updatedAt - Update timestamp (ISO 8601)
 */

/**
 * List applications request options
 * @typedef {Object} ListApplicationsRequest
 * @property {number} [page] - Page number (default: 1)
 * @property {number} [pageSize] - Items per page (default: 10)
 * @property {string} [sort] - Sort parameter
 * @property {string} [filter] - Filter parameter
 * @property {string} [search] - Search term to match across key, displayName, name, and description fields
 */

/**
 * List applications response
 * @typedef {Object} ListApplicationsResponse
 * @property {Application[]} data - Array of template applications
 * @property {PaginationMeta} meta - Pagination metadata
 * @property {PaginationLinks} links - Pagination links
 */

/**
 * Create application request
 * @typedef {Object} CreateApplicationRequest
 * @property {string} key - Application key (lowercase, numbers, hyphens only)
 * @property {string} displayName - Display name
 * @property {string} [description] - Application description
 * @property {string} [url] - Application URL
 * @property {ApplicationConfig} configuration - Application configuration
 */

/**
 * Create application response
 * @typedef {Object} CreateApplicationResponse
 * @property {Application} data - Created template application
 */

/**
 * Get application response
 * @typedef {Object} GetApplicationResponse
 * @property {Application} data - Template application details
 */

/**
 * Update application request
 * @typedef {Object} UpdateApplicationRequest
 * @property {string} [displayName] - Display name
 * @property {string} [description] - Application description
 * @property {string} [url] - Application URL
 * @property {ApplicationConfig} [configuration] - Application configuration
 * @property {string} [status] - Application status ('healthy' | 'degraded' | 'deploying' | 'error' | 'maintenance')
 */

/**
 * Update application response
 * @typedef {Object} UpdateApplicationResponse
 * @property {Application} data - Updated template application
 */

/**
 * Delete application response
 * @typedef {Object} DeleteApplicationResponse
 * @property {null} data - Always null for DELETE operations
 */

module.exports = {};

