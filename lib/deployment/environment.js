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

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Ajv = require('ajv');
const logger = require('../utils/logger');
const config = require('../core/config');
const { resolveControllerUrl } = require('../utils/controller-url');
const { validateControllerUrl, validateEnvironmentKey } = require('../utils/deployment-validation');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { getPipelineDeployment } = require('../api/pipeline.api');
const { deployEnvironment: deployEnvironmentInfra, getDeployment } = require('../api/deployments.api');
const { handleDeploymentErrors } = require('../utils/deployment-errors');
const { formatValidationErrors } = require('../utils/error-formatter');
const auditLogger = require('../core/audit-logger');
const environmentDeployRequestSchema = require('../schema/environment-deploy-request.schema.json');

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
/** Reads and parses config file; throws if missing, unreadable, or invalid structure. */
function parseEnvironmentConfigFile(resolvedPath) {
  let raw;
  try {
    raw = fs.readFileSync(resolvedPath, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read config file: ${resolvedPath}. ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Invalid JSON in config file: ${resolvedPath}\n${e.message}\n` +
      'Expected format: { "environmentConfig": { "key", "environment", "preset", "serviceName", "location" }, "dryRun": false }'
    );
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(
      `Config file must be a JSON object with "environmentConfig". File: ${resolvedPath}\n` +
      'Example: { "environmentConfig": { "key": "dev", "environment": "dev", "preset": "s", "serviceName": "aifabrix", "location": "swedencentral" }, "dryRun": false }'
    );
  }
  if (parsed.environmentConfig === undefined) {
    throw new Error(
      `Config file must contain "environmentConfig" (object). File: ${resolvedPath}\n` +
      'Example: { "environmentConfig": { "key": "dev", "environment": "dev", "preset": "s", "serviceName": "aifabrix", "location": "swedencentral" } }'
    );
  }
  if (typeof parsed.environmentConfig !== 'object' || parsed.environmentConfig === null) {
    throw new Error(`"environmentConfig" must be an object. File: ${resolvedPath}`);
  }
  return parsed;
}

/**
 * Validates parsed config against schema and returns deploy request.
 * @param {Object} parsed - Parsed config object
 * @param {string} resolvedPath - Path for error messages
 * @returns {Object} { environmentConfig, dryRun? }
 */
function validateEnvironmentDeployParsed(parsed, resolvedPath) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(environmentDeployRequestSchema);
  if (!validate(parsed)) {
    const messages = formatValidationErrors(validate.errors);
    throw new Error(
      `Environment config validation failed (${resolvedPath}):\n  • ${messages.join('\n  • ')}\n` +
      'Fix the config file and run the command again. See templates/infra/environment-dev.json for a valid example.'
    );
  }
  return {
    environmentConfig: parsed.environmentConfig,
    dryRun: Boolean(parsed.dryRun)
  };
}

/**
 * Loads and validates environment deploy config from a JSON file
 * @param {string} configPath - Absolute or relative path to config JSON
 * @returns {Object} Valid deploy request { environmentConfig, dryRun? }
 * @throws {Error} If file missing, invalid JSON, or validation fails
 */
function loadAndValidateEnvironmentDeployConfig(configPath) {
  const resolvedPath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Environment config file not found: ${resolvedPath}\n` +
      'Use --config <file> with a JSON file containing "environmentConfig" (e.g. templates/infra/environment-dev.json).'
    );
  }
  const parsed = parseEnvironmentConfigFile(resolvedPath);
  return validateEnvironmentDeployParsed(parsed, resolvedPath);
}

/**
 * Builds environment deployment request from options (config file required)
 * @function buildEnvironmentDeploymentRequest
 * @param {string} validatedEnvKey - Validated environment key
 * @param {Object} options - Deployment options (must include options.config)
 * @returns {Object} Deployment request object for API
 */
function buildEnvironmentDeploymentRequest(validatedEnvKey, options) {
  if (!options.config || typeof options.config !== 'string') {
    throw new Error(
      'Environment deploy requires a config file with "environmentConfig". Use --config <file>.\n' +
      'Example: aifabrix environment deploy dev --config templates/infra/environment-dev.json'
    );
  }
  const deployRequest = loadAndValidateEnvironmentDeployConfig(options.config);
  if (deployRequest.environmentConfig.key && deployRequest.environmentConfig.key !== validatedEnvKey) {
    logger.log(chalk.yellow(
      `⚠ Config key "${deployRequest.environmentConfig.key}" does not match deploy target "${validatedEnvKey}"; using target "${validatedEnvKey}".`
    ));
  }
  return deployRequest;
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
 * Fetches deployment status by ID (pipeline endpoint first, then environments)
 * Mirrors miso-controller manual test: GET pipeline/deployments/:id then GET environments/deployments/:id
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} envKey - Environment key
 * @param {string} deploymentId - Deployment ID
 * @param {Object} apiAuthConfig - Auth config { type: 'bearer', token }
 * @returns {Promise<Object|null>} Deployment record (status, progress, etc.) or null
 */
async function getDeploymentStatusById(controllerUrl, envKey, deploymentId, apiAuthConfig) {
  try {
    const pipelineRes = await getPipelineDeployment(controllerUrl, envKey, deploymentId, apiAuthConfig);
    if (pipelineRes?.data?.data) return pipelineRes.data.data;
    if (pipelineRes?.data && typeof pipelineRes.data === 'object' && pipelineRes.data.status) return pipelineRes.data;
  } catch {
    // Fallback to environments endpoint
  }
  try {
    const envRes = await getDeployment(controllerUrl, envKey, deploymentId, apiAuthConfig);
    if (envRes?.data?.data) return envRes.data.data;
    if (envRes?.data && typeof envRes.data === 'object' && envRes.data.status) return envRes.data;
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Process deployment record from GET .../deployments/:deploymentId
 * @param {Object|null} deployment - Deployment record (status, progress, message, error)
 * @param {string} validatedEnvKey - Validated environment key
 * @returns {Object|null} Status result if completed, null if still in progress
 * @throws {Error} If deployment failed
 */
function processDeploymentStatusResponse(deployment, validatedEnvKey) {
  if (!deployment || typeof deployment !== 'object') {
    return null;
  }

  const status = deployment.status;
  if (status === 'completed') {
    return {
      success: true,
      environment: validatedEnvKey,
      status: 'ready',
      message: 'Environment is ready for application deployments'
    };
  }

  if (status === 'failed' || status === 'error') {
    const msg = deployment.message || deployment.error || 'Unknown error';
    throw new Error(`Environment deployment failed: ${msg}`);
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

      const deployment = await getDeploymentStatusById(
        validatedUrl,
        validatedEnvKey,
        deploymentId,
        apiAuthConfig
      );
      const progress = deployment?.progress ?? 0;
      const statusLabel = deployment?.status ?? 'pending';
      if (attempt <= maxAttempts) {
        logger.log(chalk.gray(`   Attempt ${attempt}/${maxAttempts}... Status: ${statusLabel} (${progress}%)`));
      }
      const statusResult = processDeploymentStatusResponse(deployment, validatedEnvKey);
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
 * await deployEnvironment('dev', { controller: 'https://controller.aifabrix.dev' });
 */
/**
 * Validates deployment input parameters (environment key only).
 * Controller URL is resolved from config.yaml via resolveControllerUrl().
 * @function validateDeploymentInput
 * @param {string} envKey - Environment key
 * @throws {Error} If validation fails
 */
function validateDeploymentInput(envKey) {
  if (!envKey || typeof envKey !== 'string' || envKey.trim().length === 0) {
    throw new Error('Environment key is required');
  }
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
    validateDeploymentInput(envKey);
    const controllerUrl = await resolveControllerUrl();
    if (!controllerUrl) {
      throw new Error('Controller URL is required. Run "aifabrix login" to set the controller URL in config.yaml');
    }
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
