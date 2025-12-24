/**
 * @fileoverview Environments API type definitions
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
 * Environment configuration (references environment-config.schema.yaml)
 * @typedef {Object} EnvironmentConfig
 * @property {string} key - Environment key
 * @property {string} environment - Environment type ('dev' | 'tst' | 'pro' | 'miso')
 * @property {string} preset - Deployment preset size
 * @property {string} serviceName - Service name
 * @property {string} location - Azure region location
 * @property {*} [additionalProperties] - Additional configuration properties
 */

/**
 * Environment entity
 * @typedef {Object} Environment
 * @property {string} id - Environment ID
 * @property {string} key - Environment key
 * @property {string} environment - Environment type ('dev' | 'tst' | 'pro' | 'miso')
 * @property {EnvironmentConfig} configuration - Environment configuration
 * @property {string} status - Environment status
 * @property {string} createdAt - Creation timestamp (ISO 8601)
 * @property {string} updatedAt - Update timestamp (ISO 8601)
 */

/**
 * List environments request options
 * @typedef {Object} ListEnvironmentsRequest
 * @property {number} [page] - Page number (default: 1)
 * @property {number} [pageSize] - Items per page (default: 10)
 * @property {string} [sort] - Sort parameter
 * @property {string} [filter] - Filter parameter
 * @property {string} [search] - Search term to match across key field
 * @property {string} [environment] - Filter by environment type (legacy parameter)
 * @property {string} [status] - Filter by status (legacy parameter)
 */

/**
 * List environments response
 * @typedef {Object} ListEnvironmentsResponse
 * @property {PaginationMeta} meta - Pagination metadata
 * @property {Environment[]} data - Array of environments
 * @property {PaginationLinks} links - Pagination links
 */

/**
 * Create environment request
 * @typedef {Object} CreateEnvironmentRequest
 * @property {string} key - Environment key (lowercase, numbers, hyphens only)
 * @property {string} environment - Environment type ('dev' | 'tst' | 'pro')
 * @property {EnvironmentConfig} configuration - Environment configuration
 */

/**
 * Create environment response
 * @typedef {Object} CreateEnvironmentResponse
 * @property {Environment} data - Created environment
 */

/**
 * Get environment response
 * @typedef {Object} GetEnvironmentResponse
 * @property {Environment} data - Environment details
 */

/**
 * Update environment request
 * @typedef {Object} UpdateEnvironmentRequest
 * @property {EnvironmentConfig} [configuration] - Environment configuration
 */

/**
 * Update environment response
 * @typedef {Object} UpdateEnvironmentResponse
 * @property {Environment} data - Updated environment
 */

/**
 * Environment status
 * @typedef {Object} EnvironmentStatus
 * @property {number} id - Status ID
 * @property {string} environmentId - Environment ID
 * @property {string} status - Environment status ('healthy' | 'degraded' | 'deploying' | 'error' | 'maintenance')
 * @property {Object} services - Services status object
 * @property {number} resourceCount - Number of resources
 * @property {number} costMonthly - Monthly cost
 * @property {string} costCurrency - Cost currency
 * @property {string|null} lastDeployment - Last deployment timestamp (ISO 8601)
 * @property {string} healthCheckAt - Health check timestamp (ISO 8601)
 */

/**
 * Get environment status response
 * @typedef {Object} GetEnvironmentStatusResponse
 * @property {EnvironmentStatus} data - Environment status
 */

/**
 * List environment deployments request options
 * @typedef {Object} ListEnvironmentDeploymentsRequest
 * @property {number} [page] - Page number (default: 1)
 * @property {number} [pageSize] - Items per page (default: 10)
 * @property {string} [sort] - Sort parameter
 * @property {string} [filter] - Filter parameter
 * @property {string} [status] - Filter by deployment status (legacy parameter)
 * @property {string} [deploymentType] - Filter by deployment type (legacy parameter)
 */

/**
 * Deployment entity (for environment deployments list)
 * @typedef {Object} Deployment
 * @property {string} id - Deployment ID
 * @property {string} deploymentType - Deployment type
 * @property {string} status - Deployment status
 * @property {number} progress - Deployment progress (0-100)
 * @property {string} createdAt - Creation timestamp (ISO 8601)
 */

/**
 * List environment deployments response
 * @typedef {Object} ListEnvironmentDeploymentsResponse
 * @property {PaginationMeta} meta - Pagination metadata
 * @property {Deployment[]} data - Array of deployments
 */

/**
 * Role mapping
 * @typedef {Object} RoleMapping
 * @property {string} id - Mapping ID
 * @property {string} groupName - Group name
 * @property {string|null} groupId - Group ID
 * @property {boolean} isActive - Whether mapping is active
 */

/**
 * Environment role
 * @typedef {Object} EnvironmentRole
 * @property {string} id - Role ID
 * @property {string} name - Role name
 * @property {string} value - Role value
 * @property {string|null} description - Role description
 * @property {RoleMapping[]} mappings - Role mappings
 */

/**
 * List environment roles response
 * @typedef {Object} ListEnvironmentRolesResponse
 * @property {EnvironmentRole[]} data - Array of environment roles with mappings
 */

/**
 * Role group mapping
 * @typedef {Object} RoleGroupMapping
 * @property {string} id - Mapping ID
 * @property {string} roleId - Role ID
 * @property {string} environmentId - Environment ID
 * @property {string} groupName - Group name
 * @property {boolean} isActive - Whether mapping is active
 */

/**
 * Update role groups request
 * @typedef {Object} UpdateRoleGroupsRequest
 * @property {string[]} groups - Array of group names (minItems: 1)
 */

/**
 * Update role groups response
 * @typedef {Object} UpdateRoleGroupsResponse
 * @property {RoleGroupMapping[]} data - Array of role group mappings
 */

module.exports = {};

