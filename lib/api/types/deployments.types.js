/**
 * @fileoverview Deployments API type definitions
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
 * @property {string} type - Azure application type
 * @property {string} [deploymentKey] - SHA256 hash of deployment manifest (Controller adds internally)
 * @property {*} [additionalProperties] - Additional configuration properties
 */

/**
 * Deploy application request
 * @typedef {Object} DeployApplicationRequest
 * @property {string} applicationKey - Application key to deploy
 * @property {string} image - Container image path
 * @property {ApplicationConfig} [configuration] - Additional deployment configuration
 * @property {boolean} [dryRun] - If true, perform a dry run without actually deploying
 */

/**
 * Deploy application response
 * @typedef {Object} DeployApplicationResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Deployment data
 * @property {string} data.deploymentId - Deployment ID
 * @property {string} data.jobId - Job ID
 * @property {string} data.status - Deployment status
 * @property {string} data.message - Deployment message
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Deploy environment request
 * @typedef {Object} DeployEnvironmentRequest
 * @property {Object} environmentConfig - Environment configuration
 * @property {string} environmentConfig.key - Environment key
 * @property {string} environmentConfig.environment - Environment type ('dev' | 'tst' | 'pro')
 * @property {string} environmentConfig.preset - Deployment preset size ('eval' | 's' | 'm' | 'l' | 'xl')
 * @property {string} environmentConfig.serviceName - Service name for resource naming
 * @property {string} environmentConfig.location - Azure region location
 * @property {string} [environmentConfig.resourceGroupName] - Optional resource group name override
 * @property {string} [environmentConfig.subscriptionId] - Optional Azure subscription ID override
 * @property {Object} [environmentConfig.customDomain] - Custom domain configuration
 * @property {Object} [environmentConfig.frontDoor] - Front Door configuration
 * @property {Object} [environmentConfig.networking] - Networking configuration
 * @property {string[]} [environmentConfig.allowedIPs] - Allowed IP addresses
 * @property {Object[]} [environmentConfig.infrastructureAccess] - Infrastructure access configuration
 * @property {boolean} [dryRun] - If true, perform a dry run without actually deploying
 */

/**
 * Deploy environment response
 * @typedef {Object} DeployEnvironmentResponse
 * @property {Object} data - Deployment data
 * @property {string} data.deploymentId - Deployment ID
 * @property {string} data.jobId - Job ID
 * @property {string} data.status - Deployment status
 * @property {string} data.message - Deployment message
 */

/**
 * List deployments request options
 * @typedef {Object} ListDeploymentsRequest
 * @property {number} [page] - Page number (default: 1)
 * @property {number} [pageSize] - Items per page (default: 10)
 * @property {string} [sort] - Sort parameter
 * @property {string} [filter] - Filter parameter
 * @property {string} [search] - Search term to match across deployment fields
 * @property {string} [status] - Filter by deployment status (legacy parameter)
 * @property {string} [deploymentType] - Filter by deployment type (legacy parameter)
 */

/**
 * Deployment entity
 * @typedef {Object} Deployment
 * @property {string} id - Deployment ID
 * @property {string} deploymentType - Deployment type ('application' | 'infrastructure')
 * @property {string} targetId - Target ID (application key or environment key)
 * @property {string} environment - Environment key
 * @property {string} status - Deployment status
 * @property {ApplicationConfig} [configuration] - Deployment configuration
 * @property {boolean} dryRun - Whether this was a dry run
 * @property {string} createdAt - Creation timestamp (ISO 8601)
 * @property {string} updatedAt - Update timestamp (ISO 8601)
 */

/**
 * List deployments response
 * @typedef {Object} ListDeploymentsResponse
 * @property {PaginationMeta} meta - Pagination metadata
 * @property {Deployment[]} data - Array of deployments
 * @property {PaginationLinks} links - Pagination links
 */

/**
 * Job log entry
 * @typedef {Object} JobLog
 * @property {string} id - Log entry ID
 * @property {string} jobId - Job ID
 * @property {string} level - Log level ('debug' | 'info' | 'warn' | 'error')
 * @property {string} message - Log message
 * @property {string} timestamp - Log timestamp (ISO 8601)
 * @property {Object} [details] - Additional log details
 * @property {string|null} [correlationId] - Correlation ID
 */

/**
 * Deployment job
 * @typedef {Object} DeploymentJob
 * @property {string} id - Job ID
 * @property {string} jobId - Job identifier
 * @property {string} jobType - Job type
 * @property {string} status - Job status
 * @property {number} progress - Job progress (0-100)
 * @property {string|null} message - Job message
 * @property {string|null} error - Job error message
 * @property {string|null} startedAt - Job start timestamp (ISO 8601)
 * @property {string|null} completedAt - Job completion timestamp (ISO 8601)
 * @property {JobLog[]} logs - Job logs
 */

/**
 * Deployment with jobs
 * @typedef {Object} DeploymentWithJobs
 * @property {string} id - Deployment ID
 * @property {string} deploymentType - Deployment type
 * @property {string} targetId - Target ID
 * @property {string} environment - Environment key
 * @property {string} status - Deployment status
 * @property {ApplicationConfig} [configuration] - Deployment configuration
 * @property {boolean} dryRun - Whether this was a dry run
 * @property {string} createdAt - Creation timestamp (ISO 8601)
 * @property {string} updatedAt - Update timestamp (ISO 8601)
 * @property {DeploymentJob[]} jobs - Array of deployment jobs
 */

/**
 * Get deployment response
 * @typedef {Object} GetDeploymentResponse
 * @property {DeploymentWithJobs} data - Full deployment record with jobs and logs
 */

/**
 * Get deployment logs request options
 * @typedef {Object} GetDeploymentLogsRequest
 * @property {string} [jobId] - Filter logs for specific job ID
 * @property {string} [level] - Filter by log level ('debug' | 'info' | 'warn' | 'error')
 * @property {string} [since] - Get logs since timestamp (ISO 8601) for incremental updates
 */

/**
 * Get deployment logs response
 * @typedef {Object} GetDeploymentLogsResponse
 * @property {JobLog[]} data - Array of job logs
 */

module.exports = {};

