/**
 * @fileoverview Pipeline API type definitions
 * @author AI Fabrix Team
 * @version 2.0.0
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
 * Validation request
 * @typedef {Object} ValidationRequest
 * @property {string} clientId - Client ID for application authentication
 * @property {string} repositoryUrl - Full repository URL for pipeline validation (GitHub, Azure DevOps, GitLab)
 * @property {Object} applicationConfig - Application configuration
 * @property {string} applicationConfig.key - Application key
 */

/**
 * Validation response
 * @typedef {Object} ValidationResponse
 * @property {boolean} valid - Validation success flag
 * @property {string|null} validateToken - One-time deployment token for /deploy endpoint (64 bytes, 512 bits entropy)
 * @property {string|null} imageServer - Azure Container Registry server URL
 * @property {string|null} imageUsername - ACR username for image push/pull
 * @property {string|null} imagePassword - ACR password/token for image push/pull
 * @property {string|null} expiresAt - Token expiration timestamp (ISO 8601)
 * @property {string|null} draftDeploymentId - Draft deployment ID created during validation
 * @property {string[]} errors - Array of validation errors (empty on success)
 */

/**
 * Validate pipeline request
 * @typedef {Object} ValidatePipelineRequest
 * @property {string} clientId - Client ID (via x-client-id header or body)
 * @property {string} repositoryUrl - Repository URL for validation
 * @property {ApplicationConfig} applicationConfig - Application configuration to validate
 */

/**
 * Validate pipeline response
 * @typedef {Object} ValidatePipelineResponse
 * @property {boolean} valid - Validation success flag
 * @property {string|null} validateToken - One-time deployment token
 * @property {string|null} imageServer - ACR server URL
 * @property {string|null} imageUsername - ACR username
 * @property {string|null} imagePassword - ACR password/token
 * @property {string|null} expiresAt - Token expiration timestamp
 * @property {string|null} draftDeploymentId - Draft deployment ID
 * @property {string[]} errors - Validation errors array
 */

/**
 * Deploy request
 * @typedef {Object} DeployRequest
 * @property {string} validateToken - One-time deployment token obtained from /validate endpoint (required)
 * @property {string} imageTag - Container image tag to deploy (e.g., "latest", "v1.0.0", "main-abc123")
 */

/**
 * Deploy pipeline request
 * @typedef {Object} DeployPipelineRequest
 * @property {string} validateToken - One-time deployment token (required)
 * @property {string} imageTag - Container image tag to deploy
 */

/**
 * Deploy pipeline response
 * @typedef {Object} DeployPipelineResponse
 * @property {boolean} success - Request success flag
 * @property {string} deploymentId - Deployment ID
 * @property {string} status - Deployment status (e.g., 'pending', 'deploying')
 * @property {string|null} deploymentUrl - Deployment URL if available
 * @property {string|null} healthCheckUrl - Health check URL if available
 * @property {string} message - Deployment message
 * @property {string} timestamp - Timestamp when deployment was initiated (ISO 8601)
 */

/**
 * Pipeline deployment status
 * @typedef {Object} PipelineDeploymentStatus
 * @property {string} id - Deployment ID
 * @property {string} status - Deployment status ('pending' | 'deploying' | 'completed' | 'failed')
 * @property {number} progress - Deployment progress percentage (0-100)
 * @property {string|null} message - Deployment message if available
 * @property {string|null} error - Error message if deployment failed
 * @property {string|null} startedAt - Deployment start timestamp (ISO 8601)
 * @property {string|null} completedAt - Deployment completion timestamp (ISO 8601)
 * @property {string|null} deploymentUrl - Deployment URL if available
 * @property {string|null} healthCheckUrl - Health check URL if available
 */

/**
 * Get pipeline deployment request
 * @typedef {Object} GetPipelineDeploymentRequest
 * @property {string} deploymentId - Deployment ID
 */

/**
 * Get pipeline deployment response
 * @typedef {Object} GetPipelineDeploymentResponse
 * @property {boolean} success - Request success flag
 * @property {PipelineDeploymentStatus} data - Minimal deployment status
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Pipeline health check response
 * @typedef {Object} GetPipelineHealthResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Health check data
 * @property {boolean} data.healthy - Health status
 * @property {string} data.environment - Environment key
 */

module.exports = {};

