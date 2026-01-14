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

const chalk = require('chalk');
const auditLogger = require('../core/audit-logger');
const logger = require('../utils/logger');
const { validateControllerUrl, validateEnvironmentKey } = require('../utils/deployment-validation');
const { handleDeploymentError, handleDeploymentErrors } = require('../utils/deployment-errors');
const { validatePipeline, deployPipeline, getPipelineDeployment } = require('../api/pipeline.api');
const { handleValidationResponse } = require('../utils/deployment-validation-helpers');

/**
 * Build validation data for deployment
 * @async
 * @param {Object} manifest - Application manifest/config
 * @param {string} validatedEnvKey - Validated environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Object with validationData and pipelineAuthConfig
 */
async function buildValidationData(manifest, validatedEnvKey, authConfig, options) {
  const tokenManager = require('../utils/token-manager');
  const { clientId, clientSecret } = await tokenManager.extractClientCredentials(
    authConfig,
    manifest.key,
    validatedEnvKey,
    options
  );

  const repositoryUrl = options.repositoryUrl || `https://github.com/aifabrix/${manifest.key}`;
  const validationData = {
    clientId: clientId,
    clientSecret: clientSecret,
    repositoryUrl: repositoryUrl,
    applicationConfig: manifest
  };

  const pipelineAuthConfig = {
    type: 'client-credentials',
    clientId: clientId,
    clientSecret: clientSecret
  };

  return { validationData, pipelineAuthConfig };
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
  const maxRetries = options.maxRetries || 3;

  // Build validation data
  const { validationData, pipelineAuthConfig } = await buildValidationData(manifest, validatedEnvKey, authConfig, options);

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await validatePipeline(url, validatedEnvKey, pipelineAuthConfig, validationData);
      return handleValidationResponse(response);
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < maxRetries && error.status && error.status >= 500;
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
 * Validate client credentials for deployment
 * @param {Object} authConfig - Authentication configuration
 * @throws {Error} If credentials are missing
 */
function validateDeploymentCredentials(authConfig) {
  if (!authConfig.clientId || !authConfig.clientSecret) {
    throw new Error('Client ID and Client Secret are required for deployment. These should have been loaded during validation.');
  }
}

/**
 * Build deployment data and auth config
 * @param {string} validateToken - Validation token
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options
 * @returns {Object} Object with deployData and pipelineAuthConfig
 */
function buildDeploymentData(validateToken, authConfig, options) {
  const imageTag = options.imageTag || 'latest';
  const deployData = {
    validateToken: validateToken,
    imageTag: imageTag
  };

  const pipelineAuthConfig = {
    type: 'client-credentials',
    clientId: authConfig.clientId,
    clientSecret: authConfig.clientSecret
  };

  return { deployData, pipelineAuthConfig };
}

/**
 * Handle deployment response
 * @param {Object} response - API response
 * @returns {Object} Deployment result
 * @throws {Error} If deployment failed
 */
function handleDeploymentResponse(response) {
  if (response.success) {
    return response.data.data || response.data;
  }

  // Handle deployment errors
  if (response.status >= 400) {
    const error = new Error(`Deployment request failed: ${response.formattedError || response.error || 'Unknown error'}`);
    error.status = response.status;
    error.data = response.data;
    throw error;
  }

  throw new Error('Deployment request failed: Unknown error');
}

/**
 * Preserve error information from last error
 * @param {Error} lastError - Last error encountered
 * @param {number} maxRetries - Maximum retry attempts
 * @throws {Error} Formatted error with preserved information
 */
function throwDeploymentError(lastError, maxRetries) {
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
  const maxRetries = options.maxRetries || 3;

  // Validate credentials
  validateDeploymentCredentials(authConfig);

  // Build deployment data
  const { deployData, pipelineAuthConfig } = buildDeploymentData(validateToken, authConfig, options);

  // Wrap API call with retry logic
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await deployPipeline(url, validatedEnvKey, pipelineAuthConfig, deployData);
      return handleDeploymentResponse(response);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.log(chalk.yellow(`⚠️  Deployment attempt ${attempt} failed, retrying in ${delay}ms...`));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throwDeploymentError(lastError, maxRetries);
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
 * Convert authConfig to pipeline auth config format
 * @param {Object} authConfig - Authentication configuration
 * @returns {Object} Pipeline auth config
 */
function convertToPipelineAuthConfig(authConfig) {
  return authConfig.type === 'bearer'
    ? { type: 'bearer', token: authConfig.token }
    : { type: 'client-credentials', clientId: authConfig.clientId, clientSecret: authConfig.clientSecret };
}

/**
 * Process deployment status response
 * @param {Object} response - API response
 * @param {number} attempt - Current attempt number
 * @param {number} maxAttempts - Maximum attempts
 * @param {number} interval - Polling interval
 * @param {string} deploymentId - Deployment ID for error messages
 * @returns {Object|null} Deployment data if terminal, null if needs to continue polling
 */
/**
 * Handles error response from deployment status check
 * @function handleDeploymentStatusError
 * @param {Object} response - API response
 * @param {string} deploymentId - Deployment ID
 * @throws {Error} Appropriate error message
 */
function handleDeploymentStatusError(response, deploymentId) {
  if (response.status === 404) {
    throw new Error(`Deployment ${deploymentId || response.deploymentId || 'unknown'} not found`);
  }
  throw new Error(`Status check failed: ${response.formattedError || response.error || 'Unknown error'}`);
}

/**
 * Extracts deployment data from response
 * @function extractDeploymentData
 * @param {Object} response - API response
 * @returns {Object} Deployment data
 */
function extractDeploymentData(response) {
  const responseData = response.data;
  return responseData.data || responseData;
}

/**
 * Logs deployment progress
 * @function logDeploymentProgress
 * @param {Object} deploymentData - Deployment data
 * @param {number} attempt - Current attempt
 * @param {number} maxAttempts - Maximum attempts
 */
function logDeploymentProgress(deploymentData, attempt, maxAttempts) {
  const status = deploymentData.status;
  const progress = deploymentData.progress || 0;
  logger.log(chalk.blue(`   Status: ${status} (${progress}%) (attempt ${attempt + 1}/${maxAttempts})`));
}

async function processDeploymentStatusResponse(response, attempt, maxAttempts, interval, deploymentId) {
  if (!response.success || !response.data) {
    handleDeploymentStatusError(response, deploymentId);
  }

  const deploymentData = extractDeploymentData(response);
  if (isTerminalStatus(deploymentData.status)) {
    return deploymentData;
  }

  logDeploymentProgress(deploymentData, attempt, maxAttempts);
  if (attempt < maxAttempts - 1) {
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return null;
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
  const pipelineAuthConfig = convertToPipelineAuthConfig(authConfig);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await getPipelineDeployment(controllerUrl, validatedEnvKey, deploymentId, pipelineAuthConfig);
      const deploymentData = await processDeploymentStatusResponse(response, attempt, maxAttempts, interval, deploymentId);
      if (deploymentData) {
        return deploymentData;
      }
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        throw error;
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

