/**
 * AI Fabrix Builder Environment Deployment Module
 *
 * Handles environment deployment/setup in Miso Controller.
 * Sets up environment infrastructure before applications can be deployed.
 *
 * @fileoverview Environment deployment for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const { validateControllerUrl, validateEnvironmentKey } = require('../utils/deployment-validation');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { getEnvironmentStatus } = require('../api/environments.api');
const { deployEnvironment: deployEnvironmentInfra } = require('../api/deployments.api');
const { handleDeploymentErrors } = require('../utils/deployment-errors');
const auditLogger = require('../core/audit-logger');

/**
 * Validates environment deployment prerequisites
 * @param {string} envKey - Environment key
 * @param {string} controllerUrl - Controller URL
 * @throws {Error} If prerequisites are not met
 */
function validateEnvironmentPrerequisites(envKey, controllerUrl) {
  if (!envKey || typeof envKey !== 'string') {
    throw new Error('Environment key is required');
  }

  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('Controller URL is required');
  }

  // Validate environment key format
  validateEnvironmentKey(envKey);

  // Validate controller URL
  validateControllerUrl(controllerUrl);
}

/**
 * Gets authentication for environment deployment
 * Uses device token (not app-specific client credentials)
 * @async
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<Object>} Authentication configuration
 * @throws {Error} If authentication is not available
 */
async function getEnvironmentAuth(controllerUrl) {
  const validatedUrl = validateControllerUrl(controllerUrl);

  // Get or refresh device token
  const deviceToken = await getOrRefreshDeviceToken(validatedUrl);

  if (!deviceToken || !deviceToken.token) {
    throw new Error('Device token is required for environment deployment. Run "aifabrix login" first to authenticate.');
  }

  return {
    type: 'device',
    token: deviceToken.token,
    controller: deviceToken.controller || validatedUrl
  };
}

/**
 * Sends environment deployment request to controller
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 */
/**
 * Builds environment deployment request
 * @function buildEnvironmentDeploymentRequest
 * @param {string} validatedEnvKey - Validated environment key
 * @param {Object} options - Deployment options
 * @returns {Object} Deployment request object
 */
function buildEnvironmentDeploymentRequest(validatedEnvKey, options) {
  const capitalized = validatedEnvKey.charAt(0).toUpperCase() + validatedEnvKey.slice(1);
  const request = {
    key: validatedEnvKey,
    displayName: `${capitalized} Environment`,
    description: `${capitalized} environment for application deployments`
  };

  if (options.config) {
    request.description += ` (config: ${options.config})`;
  }

  return request;
}

/**
 * Handles deployment API error response
 * @function handleDeploymentApiError
 * @param {Object} response - API response
 * @throws {Error} Deployment error
 */
function handleDeploymentApiError(response) {
  const error = new Error(response.formattedError || response.error || 'Environment deployment failed');
  error.status = response.status;
  error.data = response.errorData || response.data;
  throw error;
}

/**
 * Builds deployment result from API response
 * @function buildDeploymentResult
 * @param {Object} response - API response
 * @param {string} validatedEnvKey - Validated environment key
 * @param {string} validatedUrl - Validated controller URL
 * @returns {Object} Deployment result
 */
function buildDeploymentResult(response, validatedEnvKey, validatedUrl) {
  const responseData = response.data.data || response.data || {};
  return {
    success: true,
    environment: validatedEnvKey,
    deploymentId: responseData.deploymentId || responseData.id,
    status: responseData.status || 'initiated',
    url: responseData.url || `${validatedUrl}/environments/${validatedEnvKey}`,
    message: responseData.message
  };
}

async function sendEnvironmentDeployment(controllerUrl, envKey, authConfig, options = {}) {
  const validatedUrl = validateControllerUrl(controllerUrl);
  const validatedEnvKey = validateEnvironmentKey(envKey);
  const deploymentRequest = buildEnvironmentDeploymentRequest(validatedEnvKey, options);

  await auditLogger.logDeploymentAttempt(validatedEnvKey, validatedUrl, options);

  try {
    const apiAuthConfig = { type: 'bearer', token: authConfig.token };
    const response = await deployEnvironmentInfra(validatedUrl, validatedEnvKey, apiAuthConfig, deploymentRequest);

    if (!response.success) {
      handleDeploymentApiError(response);
    }

    return buildDeploymentResult(response, validatedEnvKey, validatedUrl);
  } catch (error) {
    await handleDeploymentErrors(error, validatedEnvKey, validatedUrl, false);
    throw error;
  }
}

/**
 * Process environment status response
 * @param {Object} response - API response
 * @param {string} validatedEnvKey - Validated environment key
 * @returns {Object|null} Status result if ready, null if needs to continue polling
 * @throws {Error} If deployment failed
 */
function processEnvironmentStatusResponse(response, validatedEnvKey) {
  if (!response.success || !response.data) {
    return null;
  }

  const responseData = response.data.data || response.data;
  const status = responseData.status || responseData.ready;
  const isReady = status === 'ready' || status === 'completed' || responseData.ready === true;

  if (isReady) {
    return {
      success: true,
      environment: validatedEnvKey,
      status: 'ready',
      message: 'Environment is ready for application deployments'
    };
  }

  // Check for terminal failure states
  if (status === 'failed' || status === 'error') {
    throw new Error(`Environment deployment failed: ${responseData.message || 'Unknown error'}`);
  }

  return null;
}

/**
 * Polls environment deployment status
 * @async
 * @param {string} deploymentId - Deployment ID
 * @param {string} controllerUrl - Controller URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Polling options
 * @returns {Promise<Object>} Final deployment status
 */
async function pollEnvironmentStatus(deploymentId, controllerUrl, envKey, authConfig, options = {}) {
  const validatedUrl = validateControllerUrl(controllerUrl);
  const validatedEnvKey = validateEnvironmentKey(envKey);

  const pollInterval = options.pollInterval || 5000;
  const maxAttempts = options.maxAttempts || 60;

  logger.log(chalk.blue(`⏳ Polling environment status (${pollInterval}ms intervals)...`));

  // Use centralized API client
  const apiAuthConfig = { type: 'bearer', token: authConfig.token };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const response = await getEnvironmentStatus(validatedUrl, validatedEnvKey, apiAuthConfig);
      const statusResult = processEnvironmentStatusResponse(response, validatedEnvKey);
      if (statusResult) {
        return statusResult;
      }
    } catch (error) {
      // If it's a terminal error (not a timeout), throw it
      if (error.message && error.message.includes('failed')) {
        throw error;
      }
      // Otherwise, continue polling
    }

    if (attempt < maxAttempts) {
      logger.log(chalk.gray(`   Attempt ${attempt}/${maxAttempts}...`));
    }
  }

  // Timeout
  throw new Error(`Environment deployment timeout after ${maxAttempts} attempts. Check controller logs for status.`);
}

/**
 * Displays environment deployment results
 * @param {Object} result - Deployment result
 */
function displayDeploymentResults(result) {
  logger.log(chalk.green('\n✅ Environment deployed successfully'));
  logger.log(chalk.blue(`   Environment: ${result.environment}`));
  logger.log(chalk.blue(`   Status: ${result.status === 'ready' ? '✅ ready' : result.status}`));
  if (result.url) {
    logger.log(chalk.blue(`   URL: ${result.url}`));
  }
  if (result.deploymentId) {
    logger.log(chalk.blue(`   Deployment ID: ${result.deploymentId}`));
  }
  logger.log(chalk.green('\n✓ Environment is ready for application deployments'));
}

/**
 * Deploys/setups an environment in the controller
 * @async
 * @function deployEnvironment
 * @param {string} envKey - Environment key (miso, dev, tst, pro)
 * @param {Object} options - Deployment options
 * @param {string} options.controller - Controller URL (required)
 * @param {string} [options.config] - Environment configuration file (optional)
 * @param {boolean} [options.skipValidation] - Skip validation checks
 * @param {boolean} [options.poll] - Poll for deployment status (default: true)
 * @param {boolean} [options.noPoll] - Do not poll for status
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 *
 * @example
 * await deployEnvironment('dev', { controller: 'https://controller.aifabrix.ai' });
 */
/**
 * Validates deployment input parameters
 * @function validateDeploymentInput
 * @param {string} envKey - Environment key
 * @param {Object} options - Deployment options
 * @returns {string} Controller URL
 * @throws {Error} If validation fails
 */
function validateDeploymentInput(envKey, options) {
  if (!envKey || typeof envKey !== 'string' || envKey.trim().length === 0) {
    throw new Error('Environment key is required');
  }

  const controllerUrl = options.controller || options['controller-url'];
  if (!controllerUrl) {
    throw new Error('Controller URL is required. Use --controller flag');
  }

  return controllerUrl;
}

/**
 * Prepares environment deployment
 * @async
 * @function prepareEnvironmentDeployment
 * @param {string} envKey - Environment key
 * @param {string} controllerUrl - Controller URL
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Authentication configuration
 */
async function prepareEnvironmentDeployment(envKey, controllerUrl, options) {
  // Validate prerequisites
  if (!options.skipValidation) {
    validateEnvironmentPrerequisites(envKey, controllerUrl);
  }

  // Update root-level environment in config.yaml
  await config.setCurrentEnvironment(envKey);

  // Get authentication (device token)
  logger.log(chalk.blue(`\n📋 Deploying environment '${envKey}' to ${controllerUrl}...`));
  const authConfig = await getEnvironmentAuth(controllerUrl);
  logger.log(chalk.green('✓ Environment validated'));
  logger.log(chalk.green('✓ Authentication successful'));

  return authConfig;
}

/**
 * Executes environment deployment
 * @async
 * @function executeEnvironmentDeployment
 * @param {string} validatedControllerUrl - Validated controller URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment result
 */
async function executeEnvironmentDeployment(validatedControllerUrl, envKey, authConfig, options) {
  logger.log(chalk.blue('\n🚀 Deploying environment infrastructure...'));
  const result = await sendEnvironmentDeployment(validatedControllerUrl, envKey, authConfig, options);
  logger.log(chalk.blue(`📤 Sending deployment request to ${validatedControllerUrl}/api/v1/environments/${envKey}/deploy...`));
  return result;
}

/**
 * Polls deployment status if enabled
 * @async
 * @function pollDeploymentStatusIfEnabled
 * @param {Object} result - Deployment result
 * @param {string} validatedControllerUrl - Validated controller URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Updated result with status
 */
async function pollDeploymentStatusIfEnabled(result, validatedControllerUrl, envKey, authConfig, options) {
  const shouldPoll = options.poll !== false && !options.noPoll;
  if (shouldPoll && result.deploymentId) {
    const pollResult = await pollEnvironmentStatus(
      result.deploymentId,
      validatedControllerUrl,
      envKey,
      authConfig,
      {
        pollInterval: 5000,
        maxAttempts: 60
      }
    );
    result.status = pollResult.status;
    result.message = pollResult.message;
  }
  return result;
}

async function deployEnvironment(envKey, options = {}) {
  try {
    const controllerUrl = validateDeploymentInput(envKey, options);
    const authConfig = await prepareEnvironmentDeployment(envKey, controllerUrl, options);

    const validatedControllerUrl = validateControllerUrl(authConfig.controller);
    const result = await executeEnvironmentDeployment(validatedControllerUrl, envKey, authConfig, options);
    const finalResult = await pollDeploymentStatusIfEnabled(result, validatedControllerUrl, envKey, authConfig, options);

    displayDeploymentResults(finalResult);
    return finalResult;
  } catch (error) {
    // Error handling is done in sendEnvironmentDeployment and pollEnvironmentStatus
    // Re-throw with context
    if (error._logged !== true) {
      logger.error(chalk.red(`\n❌ Environment deployment failed: ${error.message}`));
    }
    throw error;
  }
}

module.exports = {
  deployEnvironment
};

