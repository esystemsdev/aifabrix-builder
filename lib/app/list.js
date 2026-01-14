/**
 * AI Fabrix Builder - App List Command
 *
 * Handles listing applications in an environment
 *
 * @fileoverview App list command implementation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { getConfig, normalizeControllerUrl } = require('../core/config');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { listEnvironmentApplications } = require('../api/environments.api');
const { formatApiError } = require('../utils/api-error-handler');
const { formatAuthenticationError } = require('../utils/error-formatters/http-status-errors');
const logger = require('../utils/logger');

/**
 * Extract wrapped array format: { success: true, data: { success: true, data: [...] } }
 * @param {Object} apiResponse - API response data
 * @returns {Array|null} Applications array or null if not this format
 */
function extractWrappedArray(apiResponse) {
  if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data)) {
    return apiResponse.data;
  }
  return null;
}

/**
 * Extract direct array format: { success: true, data: [...] }
 * @param {Object} apiResponse - API response data
 * @returns {Array|null} Applications array or null if not this format
 */
function extractDirectArray(apiResponse) {
  if (Array.isArray(apiResponse)) {
    return apiResponse;
  }
  return null;
}

/**
 * Extract paginated items format: { success: true, data: { items: [...] } }
 * @param {Object} apiResponse - API response data
 * @returns {Array|null} Applications array or null if not this format
 */
function extractPaginatedItems(apiResponse) {
  if (apiResponse && Array.isArray(apiResponse.items)) {
    return apiResponse.items;
  }
  return null;
}

/**
 * Extract wrapped paginated items format: { success: true, data: { success: true, data: { items: [...] } } }
 * @param {Object} apiResponse - API response data
 * @returns {Array|null} Applications array or null if not this format
 */
function extractWrappedPaginatedItems(apiResponse) {
  if (apiResponse && apiResponse.data && apiResponse.data.items && Array.isArray(apiResponse.data.items)) {
    return apiResponse.data.items;
  }
  return null;
}

/**
 * Extract applications array from API response
 * Handles multiple response formats:
 * 1. Wrapped format: { success: true, data: { success: true, data: [...] } }
 * 2. Direct array: { success: true, data: [...] }
 * 3. Paginated format: { success: true, data: { items: [...] } }
 * 4. Wrapped paginated: { success: true, data: { success: true, data: { items: [...] } } }
 * @param {Object} response - API response from centralized API client
 * @returns {Array} Array of applications
 * @throws {Error} If response format is invalid
 */
function extractApplications(response) {
  const apiResponse = response.data;

  // Try each format in sequence
  const applications = extractWrappedArray(apiResponse) ||
    extractDirectArray(apiResponse) ||
    extractPaginatedItems(apiResponse) ||
    extractWrappedPaginatedItems(apiResponse);

  if (!applications) {
    logger.error(chalk.red('❌ Invalid response: expected data array or items array'));
    logger.error(chalk.gray('\nAPI response type:'), typeof apiResponse);
    logger.error(chalk.gray('API response:'), JSON.stringify(apiResponse, null, 2));
    logger.error(chalk.gray('\nFull response for debugging:'));
    logger.error(chalk.gray(JSON.stringify(response, null, 2)));
    throw new Error('Invalid response format');
  }

  return applications;
}

/**
 * Find device token from config by trying each stored URL
 * @async
 * @param {Object} deviceConfig - Device configuration object
 * @returns {Promise<Object|null>} Token result with token and controllerUrl, or null if not found
 */
async function findDeviceTokenFromConfig(deviceConfig) {
  const deviceUrls = Object.keys(deviceConfig);
  if (deviceUrls.length === 0) {
    return null;
  }

  for (const storedUrl of deviceUrls) {
    try {
      const normalizedStoredUrl = normalizeControllerUrl(storedUrl);
      const deviceToken = await getOrRefreshDeviceToken(normalizedStoredUrl);
      if (deviceToken && deviceToken.token) {
        return {
          token: deviceToken.token,
          controllerUrl: deviceToken.controller || normalizedStoredUrl
        };
      }
    } catch (error) {
      // Continue to next URL
    }
  }

  return null;
}

/**
 * Display applications list
 * @param {Array} applications - Array of application objects
 * @param {string} environment - Environment name or key
 */
function displayApplications(applications, environment) {
  const environmentName = environment || 'miso';
  const header = `Applications in ${environmentName} environment`;

  if (applications.length === 0) {
    logger.log(chalk.bold(`\n📱 ${header}:\n`));
    logger.log(chalk.gray('  No applications found in this environment.\n'));
    return;
  }

  logger.log(chalk.bold(`\n📱 ${header}:\n`));
  applications.forEach((app) => {
    const hasPipeline = app.configuration?.pipeline?.isActive ? '✓' : '✗';
    logger.log(`${hasPipeline} ${chalk.cyan(app.key)} - ${app.displayName} (${app.status || 'unknown'})`);
  });
  logger.log('');
}

/**
 * Try to get device token from controller URL
 * @async
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<Object|null>} Object with token and controllerUrl, or null
 */
async function tryGetTokenFromController(controllerUrl) {
  try {
    const normalizedUrl = normalizeControllerUrl(controllerUrl);
    const deviceToken = await getOrRefreshDeviceToken(normalizedUrl);
    if (deviceToken && deviceToken.token) {
      return {
        token: deviceToken.token,
        actualControllerUrl: deviceToken.controller || normalizedUrl
      };
    }
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to authenticate with controller: ${controllerUrl}`));
    logger.error(chalk.gray(`Error: ${error.message}`));
    process.exit(1);
  }
  return null;
}

/**
 * Try to find device token from config
 * @async
 * @param {Object} deviceConfig - Device configuration
 * @returns {Promise<Object|null>} Object with token and controllerUrl, or null
 */
async function tryGetTokenFromConfig(deviceConfig) {
  if (!deviceConfig) {
    return null;
  }
  const tokenResult = await findDeviceTokenFromConfig(deviceConfig);
  if (tokenResult) {
    return {
      token: tokenResult.token,
      actualControllerUrl: tokenResult.controllerUrl
    };
  }
  return null;
}

/**
 * Validate and return authentication token or exit
 * @param {string|null} token - Authentication token
 * @param {string|null} actualControllerUrl - Controller URL
 * @param {string} controllerUrl - Original controller URL (for error message)
 * @returns {Object} Object with token and actualControllerUrl
 */
function validateAuthToken(token, actualControllerUrl, controllerUrl) {
  if (!token || !actualControllerUrl) {
    const formattedError = formatAuthenticationError({
      controllerUrl: controllerUrl || undefined,
      message: 'No valid authentication found'
    });
    logger.error(formattedError);
    process.exit(1);
  }
  return { token, actualControllerUrl };
}

/**
 * Get authentication token for listing applications
 * @async
 * @param {string} [controllerUrl] - Optional controller URL
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Object with token and actualControllerUrl
 * @throws {Error} If authentication fails
 */
async function getListAuthToken(controllerUrl, config) {
  // Try to get token from controller URL first
  let authResult = null;
  if (controllerUrl) {
    authResult = await tryGetTokenFromController(controllerUrl);
  }

  // If no token yet, try to find device token from config
  if (!authResult && config.device) {
    authResult = await tryGetTokenFromConfig(config.device);
  }

  // Validate and return token or exit
  return validateAuthToken(authResult?.token || null, authResult?.actualControllerUrl || null, controllerUrl);
}

/**
 * Handle API response and extract applications
 * @param {Object} response - API response
 * @param {string} actualControllerUrl - Controller URL
 * @returns {Array} Extracted applications
 * @throws {Error} If response is invalid
 */
function handleListResponse(response, actualControllerUrl) {
  if (!response.success || !response.data) {
    const formattedError = response.formattedError || formatApiError(response, actualControllerUrl);
    logger.error(formattedError);
    logger.error(chalk.gray(`\nController URL: ${actualControllerUrl}`));
    logger.error(chalk.gray('\nFull response for debugging:'));
    logger.error(chalk.gray(JSON.stringify(response, null, 2)));
    process.exit(1);
  }

  return extractApplications(response);
}

/**
 * List applications in an environment
 * @async
 * @param {Object} options - Command options
 * @param {string} options.environment - Environment ID or key
 * @param {string} [options.controller] - Controller URL (optional, uses configured controller if not provided)
 * @throws {Error} If listing fails
 */
async function listApplications(options) {
  const config = await getConfig();

  // Get authentication token
  const controllerUrl = options.controller || null;
  const { token, actualControllerUrl } = await getListAuthToken(controllerUrl, config);

  // Use centralized API client
  const authConfig = { type: 'bearer', token: token };
  try {
    const response = await listEnvironmentApplications(actualControllerUrl, options.environment, authConfig);
    const applications = handleListResponse(response, actualControllerUrl);
    displayApplications(applications, options.environment);
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to list applications from controller: ${actualControllerUrl}`));
    logger.error(chalk.gray(`Error: ${error.message}`));
    process.exit(1);
  }
}

module.exports = { listApplications };

