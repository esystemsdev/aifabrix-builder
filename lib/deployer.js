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
const auditLogger = require('./audit-logger');
const logger = require('./utils/logger');
const { validateControllerUrl, validateEnvironmentKey } = require('./utils/deployment-validation');
const { handleDeploymentError, handleDeploymentErrors } = require('./utils/deployment-errors');
const { validatePipeline, deployPipeline, getPipelineDeployment } = require('./api/pipeline.api');

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
  const validationData = {
    clientId: clientId,
    clientSecret: clientSecret,
    repositoryUrl: repositoryUrl,
    applicationConfig: manifest
  };

  // Use centralized API client with retry logic
  const pipelineAuthConfig = {
    type: 'client-credentials',
    clientId: clientId,
    clientSecret: clientSecret
  };

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await validatePipeline(url, validatedEnvKey, pipelineAuthConfig, validationData);

      // Handle successful validation (200 OK with valid: true)
      if (response.success && response.data) {
        const responseData = response.data.data || response.data;
        if (responseData.valid === true) {
          return {
            success: true,
            validateToken: responseData.validateToken,
            draftDeploymentId: responseData.draftDeploymentId,
            imageServer: responseData.imageServer,
            imageUsername: responseData.imageUsername,
            imagePassword: responseData.imagePassword,
            expiresAt: responseData.expiresAt
          };
        }
        // Handle validation failure (valid: false)
        if (responseData.valid === false) {
          const errorMessage = responseData.errors && responseData.errors.length > 0
            ? `Validation failed: ${responseData.errors.join(', ')}`
            : 'Validation failed: Invalid configuration';
          const error = new Error(errorMessage);
          error.status = 400;
          error.data = responseData;
          throw error;
        }
      }

      // Handle validation errors (non-success responses)
      if (!response.success) {
        const error = new Error(`Validation request failed: ${response.formattedError || response.error || 'Unknown error'}`);
        error.status = response.status || 400;
        error.data = response.data;
        throw error;
      }

      // If we get here, response.success is true but valid is not true and not false
      // This is an unexpected state, throw an error
      const error = new Error('Validation response is in an unexpected state');
      error.status = 400;
      error.data = response.data;
      throw error;
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

  // Extract clientId and clientSecret for deploy endpoint
  // These should have been loaded during validation and stored in authConfig
  if (!authConfig.clientId || !authConfig.clientSecret) {
    throw new Error('Client ID and Client Secret are required for deployment. These should have been loaded during validation.');
  }
  const clientId = authConfig.clientId;
  const clientSecret = authConfig.clientSecret;

  // Build deployment request
  const imageTag = options.imageTag || 'latest';
  const deployData = {
    validateToken: validateToken,
    imageTag: imageTag
  };

  // Use centralized API client with retry logic
  const pipelineAuthConfig = {
    type: 'client-credentials',
    clientId: clientId,
    clientSecret: clientSecret
  };

  // Wrap API call with retry logic
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await deployPipeline(url, validatedEnvKey, pipelineAuthConfig, deployData);

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

  // Convert authConfig to format expected by API client
  const pipelineAuthConfig = authConfig.type === 'bearer'
    ? { type: 'bearer', token: authConfig.token }
    : { type: 'client-credentials', clientId: authConfig.clientId, clientSecret: authConfig.clientSecret };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await getPipelineDeployment(controllerUrl, validatedEnvKey, deploymentId, pipelineAuthConfig);

      if (response.success && response.data) {
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
        if (response.status === 404) {
          throw new Error(`Deployment ${deploymentId} not found`);
        }
        throw new Error(`Status check failed: ${response.formattedError || response.error || 'Unknown error'}`);
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

