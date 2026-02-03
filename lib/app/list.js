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
 * Format URL and port for display
 * @param {Object} app - Application object
 * @returns {string} Formatted URL and port string
 */
function formatUrlAndPort(app) {
  const url = app.url || app.dataplaneUrl || app.dataplane?.url || app.configuration?.dataplaneUrl || null;
  const port = app.port || app.configuration?.port || null;

  const parts = [];
  if (url) {
    parts.push(`URL: ${chalk.blue(url)}`);
  }
  if (port) {
    parts.push(`Port: ${chalk.blue(port)}`);
  }

  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

/**
 * Display applications list
 * @param {Array} applications - Array of application objects
 * @param {string} environment - Environment name or key
 * @param {string} controllerUrl - Controller URL
 */
function displayApplications(applications, environment, controllerUrl) {
  const environmentName = environment || 'miso';
  const header = `Applications in ${environmentName} environment (${controllerUrl})`;

  if (applications.length === 0) {
    logger.log(chalk.bold(`\n📱 ${header}:\n`));
    logger.log(chalk.gray('  No applications found in this environment.\n'));
    return;
  }

  logger.log(chalk.bold(`\n📱 ${header}:\n`));
  applications.forEach((app) => {
    const isExternal = app.configuration?.type === 'external';
    const externalIcon = isExternal ? '🔗 ' : '';
    const hasPipeline = app.configuration?.pipeline?.isActive ? '✓' : '✗';
    const urlAndPort = formatUrlAndPort(app);
    logger.log(`${externalIcon}${hasPipeline} ${chalk.cyan(app.key)} - ${app.displayName} (${app.status || 'unknown'})${urlAndPort}`);
  });
  logger.log(chalk.gray('  To show details for an app: aifabrix app show <appKey>\n'));
}

/**
 * Try to get device token from controller URL
 * @async
 * @param {string} controllerUrl - Controller URL (explicitly provided by user)
 * @returns {Promise<Object|null>} Object with token and controllerUrl, or null if token not found
 * @throws {Error} If authentication/refresh fails
 */
async function tryGetTokenFromController(controllerUrl) {
  const normalizedUrl = normalizeControllerUrl(controllerUrl);
  const deviceToken = await getOrRefreshDeviceToken(normalizedUrl);
  if (deviceToken && deviceToken.token) {
    // Always use the provided controller URL (normalized) to ensure we use the exact URL the user specified
    return {
      token: deviceToken.token,
      actualControllerUrl: normalizedUrl
    };
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
 * @param {string} [controllerUrl] - Optional controller URL (if provided, must use this specific URL)
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Object with token and actualControllerUrl
 * @throws {Error} If authentication fails
 */
async function getListAuthToken(controllerUrl, config) {
  // If controller URL is explicitly provided, use only that URL (no fallback)
  if (controllerUrl) {
    const authResult = await tryGetTokenFromController(controllerUrl);
    if (!authResult || !authResult.token) {
      // No token found for explicitly provided controller URL
      logger.error(chalk.red(`❌ No authentication token found for controller: ${controllerUrl}`));
      logger.error(chalk.gray('Please login to this controller using: aifabrix login'));
      process.exit(1);
      // Return to prevent further execution in tests where process.exit is mocked
      return { token: null, actualControllerUrl: null };
    }
    return validateAuthToken(authResult.token, authResult.actualControllerUrl, controllerUrl);
  }

  // If no controller URL provided, try to find device token from config
  if (config.device) {
    const authResult = await tryGetTokenFromConfig(config.device);
    if (authResult && authResult.token) {
      return validateAuthToken(authResult.token, authResult.actualControllerUrl, null);
    }
  }

  // No token found anywhere
  return validateAuthToken(null, null, null);
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
 * List applications in an environment.
 * Controller and environment come from config.yaml (set via aifabrix login or aifabrix auth config).
 * @async
 * @param {Object} [_options] - Command options (reserved)
 * @throws {Error} If listing fails
 */
async function listApplications(options = {}) {
  const { resolveControllerUrl } = require('../utils/controller-url');
  const { resolveEnvironment } = require('../core/config');

  const controllerUrl = options.controller || (await resolveControllerUrl());
  if (!controllerUrl) {
    logger.error(chalk.red('❌ Controller URL is required. Run "aifabrix login" to set the controller URL in config.yaml'));
    process.exit(1);
    return;
  }

  const environment = options.environment || (await resolveEnvironment());
  const config = await getConfig();
  const { token, actualControllerUrl } = await getListAuthToken(controllerUrl, config);

  // Check if authentication succeeded (may be null after process.exit in tests)
  if (!token || !actualControllerUrl) {
    return;
  }

  // Use centralized API client
  const authConfig = { type: 'bearer', token: token };
  try {
    const response = await listEnvironmentApplications(actualControllerUrl, environment, authConfig);
    const applications = handleListResponse(response, actualControllerUrl);
    displayApplications(applications, environment, actualControllerUrl);
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to list applications from controller: ${actualControllerUrl}`));
    logger.error(chalk.gray(`Error: ${error.message}`));
    process.exit(1);
  }
}

module.exports = { listApplications };

