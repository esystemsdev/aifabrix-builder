/**
 * AI Fabrix Builder Deployment Module
 *
 * Handles deployment to Miso Controller API with ISO 27001 security measures.
 * Manages authentication, validation, and API communication for deployments.
 *
 * @fileoverview Deployment orchestration and API communication
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const axios = require('axios');
const chalk = require('chalk');
const auditLogger = require('./audit-logger');
const logger = require('./utils/logger');
const { createAuthHeaders } = require('./utils/auth-headers');
const { validateControllerUrl, validateEnvironmentKey } = require('./utils/deployment-validation');
const { handleDeploymentError, handleDeploymentErrors } = require('./utils/deployment-errors');

/**
 * Handles deployment request retry logic
 * @async
 * @function handleDeploymentRetry
 * @param {string} endpoint - API endpoint
 * @param {Object} manifest - Deployment manifest
 * @param {Object} requestConfig - Request configuration
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails after retries
 */
async function handleDeploymentRetry(endpoint, manifest, requestConfig, maxRetries) {
  let lastError;

  // Validate manifest before sending
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Deployment manifest is required and must be an object');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Axios automatically serializes objects to JSON when Content-Type is application/json
      const response = await axios.post(endpoint, manifest, requestConfig);

      if (response.status >= 400) {
        const error = new Error(`Controller returned error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        };
        error.data = response.data;
        throw error;
      }

      // OpenAPI spec: Response 202 structure { success: boolean, deploymentId: string, status: string, deploymentUrl?: string, healthCheckUrl?: string, message?: string }
      // Handle both OpenAPI format and legacy format for backward compatibility
      const responseData = response.data;
      if (responseData && typeof responseData === 'object') {
        // OpenAPI format: { success, deploymentId, status, deploymentUrl, healthCheckUrl, message }
        return responseData;
      }

      return response.data;
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.log(chalk.yellow(`⚠️  Deployment attempt ${attempt} failed, retrying in ${delay}ms...`));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Preserve formatted error if available
  const errorMessage = lastError.formatted || lastError.message;
  const error = new Error(`Deployment failed after ${maxRetries} attempts: ${errorMessage}`);
  if (lastError.formatted) {
    error.formatted = lastError.formatted;
  }
  if (lastError.status) {
    error.status = lastError.status;
  }
  if (lastError.data) {
    error.data = lastError.data;
  }
  throw error;
}

/**
 * Validates deployment configuration via validate endpoint
 * This is the first step in the deployment process
 *
 * @async
 * @param {string} url - Controller URL
 * @param {string} envKey - Environment key (miso, dev, tst, pro)
 * @param {Object} manifest - Deployment manifest (applicationConfig)
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Validation options (repositoryUrl, timeout, retries, etc.)
 * @returns {Promise<Object>} Validation result with validateToken
 * @throws {Error} If validation fails
 */
async function validateDeployment(url, envKey, manifest, authConfig, options = {}) {
  const validatedEnvKey = validateEnvironmentKey(envKey);
  const endpoint = `${url}/api/v1/pipeline/${validatedEnvKey}/validate`;
  const timeout = options.timeout || 30000;
  const maxRetries = options.maxRetries || 3;

  // Extract clientId and clientSecret
  const tokenManager = require('./utils/token-manager');
  const { clientId, clientSecret } = await tokenManager.extractClientCredentials(
    authConfig,
    manifest.key,
    validatedEnvKey,
    options
  );

  // Build validation request
  const repositoryUrl = options.repositoryUrl || `https://github.com/aifabrix/${manifest.key}`;
  const validationRequest = {
    clientId: clientId,
    clientSecret: clientSecret,
    repositoryUrl: repositoryUrl,
    applicationConfig: manifest
  };

  // Create request config with client credentials headers
  const requestConfig = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aifabrix-builder/2.0.0',
      'x-client-id': clientId,
      'x-client-secret': clientSecret
    },
    timeout,
    validateStatus: (status) => status < 600 // Don't throw on any status
  };

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(endpoint, validationRequest, requestConfig);

      // Handle successful validation (200 OK with valid: true)
      if (response.status === 200 && response.data.valid === true) {
        return {
          success: true,
          validateToken: response.data.validateToken,
          draftDeploymentId: response.data.draftDeploymentId,
          imageServer: response.data.imageServer,
          imageUsername: response.data.imageUsername,
          imagePassword: response.data.imagePassword,
          expiresAt: response.data.expiresAt
        };
      }

      // Handle validation errors
      if (response.status >= 400) {
        const error = new Error(`Validation request failed: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        };
        error.data = response.data;
        throw error;
      }
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < maxRetries && error.response && error.response.status >= 500;
      if (shouldRetry) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.log(chalk.yellow(`⚠️  Validation attempt ${attempt} failed, retrying in ${delay}ms...`));
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Sends deployment request using validateToken from validation step
 * This is the second step in the deployment process
 *
 * @async
 * @param {string} url - Controller URL
 * @param {string} envKey - Environment key (miso, dev, tst, pro)
 * @param {string} validateToken - Validation token from validate endpoint
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options (imageTag, timeout, retries, etc.)
 * @returns {Promise<Object>} Deployment result from controller
 * @throws {Error} If deployment fails
 */
async function sendDeploymentRequest(url, envKey, validateToken, authConfig, options = {}) {
  const validatedEnvKey = validateEnvironmentKey(envKey);
  const endpoint = `${url}/api/v1/pipeline/${validatedEnvKey}/deploy`;
  const timeout = options.timeout || 30000;
  const maxRetries = options.maxRetries || 3;

  // Extract clientId and clientSecret for deploy endpoint
  // These should have been loaded during validation and stored in authConfig
  if (!authConfig.clientId || !authConfig.clientSecret) {
    throw new Error('Client ID and Client Secret are required for deployment. These should have been loaded during validation.');
  }
  const clientId = authConfig.clientId;
  const clientSecret = authConfig.clientSecret;

  // Build deployment request
  const imageTag = options.imageTag || 'latest';
  const deployRequest = {
    validateToken: validateToken,
    imageTag: imageTag
  };

  // Create request config with client credentials headers
  const requestConfig = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aifabrix-builder/2.0.0',
      'x-client-id': clientId,
      'x-client-secret': clientSecret
    },
    timeout,
    validateStatus: (status) => status < 500
  };

  return handleDeploymentRetry(endpoint, deployRequest, requestConfig, maxRetries);
}

/**
 * Checks if deployment status is terminal
 * @function isTerminalStatus
 * @param {string} status - Deployment status
 * @returns {boolean} True if status is terminal
 */
function isTerminalStatus(status) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Polls deployment status from controller
 * Uses pipeline endpoint for CI/CD monitoring with minimal deployment info
 *
 * @async
 * @param {string} deploymentId - Deployment ID to poll
 * @param {string} controllerUrl - Controller URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Polling options (interval, maxAttempts, etc.)
 * @returns {Promise<Object>} Deployment status
 */
async function pollDeploymentStatus(deploymentId, controllerUrl, envKey, authConfig, options = {}) {
  const interval = options.interval || 5000;
  const maxAttempts = options.maxAttempts || 60;

  const validatedEnvKey = validateEnvironmentKey(envKey);
  const statusEndpoint = `${controllerUrl}/api/v1/pipeline/${validatedEnvKey}/deployments/${deploymentId}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get(statusEndpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...createAuthHeaders(authConfig)
        },
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      if (response.status === 200) {
        // OpenAPI spec: Response structure { success: boolean, data: { status, progress, ... }, timestamp: string }
        const responseData = response.data;
        const deploymentData = responseData.data || responseData;
        const status = deploymentData.status;

        if (isTerminalStatus(status)) {
          return deploymentData;
        }

        const progress = deploymentData.progress || 0;
        logger.log(chalk.blue(`   Status: ${status} (${progress}%) (attempt ${attempt + 1}/${maxAttempts})`));

        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } else {
        throw new Error(`Status check failed: ${response.status}`);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }
      throw error;
    }
  }

  throw new Error('Deployment timeout: Maximum polling attempts reached');
}

/**
 * Validates and sends deployment request to controller
 * Implements two-step process: validate then deploy
 * @async
 * @param {string} url - Controller URL
 * @param {string} validatedEnvKey - Validated environment key
 * @param {Object} manifest - Deployment manifest
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment result
 */
async function sendDeployment(url, validatedEnvKey, manifest, authConfig, options) {
  // Step 1: Validate deployment
  logger.log(chalk.blue('🔍 Validating deployment configuration...'));
  const validateResult = await validateDeployment(url, validatedEnvKey, manifest, authConfig, {
    repositoryUrl: options.repositoryUrl,
    controllerId: options.controllerId,
    timeout: options.timeout || 30000,
    maxRetries: options.maxRetries || 3
  });

  if (!validateResult.success || !validateResult.validateToken) {
    throw new Error('Validation failed: validateToken not received');
  }

  logger.log(chalk.green('✓ Validation successful'));
  if (validateResult.draftDeploymentId) {
    logger.log(chalk.gray(`   Draft Deployment ID: ${validateResult.draftDeploymentId}`));
  }

  // Step 2: Deploy using validateToken
  logger.log(chalk.blue('\n🚀 Deploying application...'));
  const result = await sendDeploymentRequest(url, validatedEnvKey, validateResult.validateToken, authConfig, {
    imageTag: options.imageTag || 'latest',
    timeout: options.timeout || 30000,
    maxRetries: options.maxRetries || 3
  });

  if (result.deploymentId) {
    await auditLogger.logDeploymentSuccess(manifest.key, result.deploymentId, url);
  }

  return result;
}

/**
 * Polls deployment status if enabled
 * @async
 * @param {Object} result - Deployment result
 * @param {string} url - Controller URL
 * @param {string} validatedEnvKey - Validated environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment result with status
 */
async function pollDeployment(result, url, validatedEnvKey, authConfig, options) {
  if (!options.poll || !result.deploymentId) {
    return result;
  }

  logger.log(chalk.blue(`\n⏳ Polling deployment status (${options.pollInterval || 5000}ms intervals)...`));
  const status = await pollDeploymentStatus(
    result.deploymentId,
    url,
    validatedEnvKey,
    authConfig,
    {
      interval: options.pollInterval || 5000,
      maxAttempts: options.pollMaxAttempts || 60
    }
  );

  result.status = status;
  return result;
}

/**
 * Deploys application to Miso Controller with authentication
 * Supports both Bearer token and client credentials authentication
 * Main orchestrator for the deployment process
 *
 * @async
 * @param {Object} manifest - Deployment manifest
 * @param {string} controllerUrl - Controller URL
 * @param {string} envKey - Environment key (miso, dev, tst, pro)
 * @param {Object} authConfig - Authentication configuration
 * @param {string} authConfig.type - Auth type: 'bearer' or 'credentials'
 * @param {string} [authConfig.token] - Bearer token (for type 'bearer')
 * @param {string} [authConfig.clientId] - Client ID (for type 'credentials')
 * @param {string} [authConfig.clientSecret] - Client secret (for type 'credentials')
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 */
async function deployToController(manifest, controllerUrl, envKey, authConfig, options = {}) {
  // Validate inputs
  if (!envKey) {
    throw new Error('Environment key is required');
  }
  if (!authConfig || !authConfig.type) {
    throw new Error('Authentication configuration is required');
  }

  // Validate and sanitize controller URL
  const url = validateControllerUrl(controllerUrl);
  const validatedEnvKey = validateEnvironmentKey(envKey);

  // Log deployment attempt for audit
  await auditLogger.logDeploymentAttempt(manifest.key, url, options);

  try {
    // Send deployment request
    const result = await sendDeployment(url, validatedEnvKey, manifest, authConfig, options);

    // Poll for deployment status if enabled
    return await pollDeployment(result, url, validatedEnvKey, authConfig, options);

  } catch (error) {
    // Use unified error handler (already logged in deployToController, so pass alreadyLogged=true)
    await handleDeploymentErrors(error, manifest.key, url, false);
  }
}

module.exports = {
  deployToController,
  sendDeploymentRequest,
  validateDeployment,
  handleDeploymentErrors,
  pollDeploymentStatus,
  validateControllerUrl,
  handleDeploymentError,
  validateEnvironmentKey
};

