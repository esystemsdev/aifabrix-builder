/**
 * Datasource List Command
 *
 * Lists datasources from an environment via controller API.
 *
 * @fileoverview Datasource listing for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { getConfig, resolveEnvironment } = require('../core/config');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { listEnvironmentDatasources } = require('../api/environments.api');
const { formatApiError } = require('../utils/api-error-handler');
const logger = require('../utils/logger');

/**
 * Extracts datasources array from API response
 * Handles multiple response formats similar to applications list
 *
 * @function extractDatasources
 * @param {Object} response - API response from centralized API client
 * @returns {Array} Array of datasources
 * @throws {Error} If response format is invalid
 */
/**
 * Extracts datasources from wrapped format
 * @function extractFromWrappedFormat
 * @param {Object} apiResponse - API response object
 * @returns {Array|null} Datasources array or null
 */
function extractFromWrappedFormat(apiResponse) {
  if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data)) {
    return apiResponse.data;
  }
  return null;
}

/**
 * Extracts datasources from direct array format
 * @function extractFromDirectArray
 * @param {Object} apiResponse - API response object
 * @returns {Array|null} Datasources array or null
 */
function extractFromDirectArray(apiResponse) {
  if (Array.isArray(apiResponse)) {
    return apiResponse;
  }
  return null;
}

/**
 * Extracts datasources from paginated format
 * @function extractFromPaginatedFormat
 * @param {Object} apiResponse - API response object
 * @returns {Array|null} Datasources array or null
 */
function extractFromPaginatedFormat(apiResponse) {
  if (apiResponse && Array.isArray(apiResponse.items)) {
    return apiResponse.items;
  }
  if (apiResponse && apiResponse.data && apiResponse.data.items && Array.isArray(apiResponse.data.items)) {
    return apiResponse.data.items;
  }
  return null;
}

/**
 * Logs error for invalid response format
 * @function logInvalidResponseError
 * @param {Object} apiResponse - API response object
 */
function logInvalidResponseError(apiResponse) {
  logger.error(chalk.red('❌ Invalid response: expected data array or items array'));
  logger.error(chalk.gray('\nAPI response type:'), typeof apiResponse);
  logger.error(chalk.gray('API response:'), JSON.stringify(apiResponse, null, 2));
}

function extractDatasources(response) {
  if (!response.success || !response.data) {
    throw new Error('Invalid API response: missing success or data');
  }

  const apiResponse = response.data;

  // Try different response formats
  const datasources = extractFromWrappedFormat(apiResponse) ||
    extractFromDirectArray(apiResponse) ||
    extractFromPaginatedFormat(apiResponse);

  if (!datasources) {
    logInvalidResponseError(apiResponse);
    throw new Error('Invalid API response format: expected array of datasources');
  }

  return datasources;
}

/**
 * Displays datasources in a formatted table
 *
 * @function displayDatasources
 * @param {Array} datasources - Array of datasource objects
 * @param {string} environment - Environment key
 */
function displayDatasources(datasources, environment) {
  if (datasources.length === 0) {
    logger.log(chalk.yellow(`\nNo datasources found in environment: ${environment}`));
    return;
  }

  logger.log(chalk.blue(`\n📋 Datasources in environment: ${environment}\n`));
  logger.log(chalk.gray('Key'.padEnd(30) + 'Display Name'.padEnd(30) + 'System Key'.padEnd(20) + 'Version'.padEnd(15) + 'Status'));
  logger.log(chalk.gray('-'.repeat(120)));

  datasources.forEach((ds) => {
    const key = (ds.key || 'N/A').padEnd(30);
    const displayName = (ds.displayName || 'N/A').padEnd(30);
    const systemKey = (ds.systemKey || 'N/A').padEnd(20);
    const version = (ds.version || 'N/A').padEnd(15);
    const status = ds.enabled !== false ? chalk.green('enabled') : chalk.red('disabled');
    logger.log(`${key}${displayName}${systemKey}${version}${status}`);
  });
  logger.log('');
}

/**
 * Lists datasources from an environment
 *
 * @async
 * @function listDatasources
 * @param {Object} _options - Command options (unused, kept for compatibility)
 * @throws {Error} If listing fails
 */
/**
 * Gets device token from config
 * @async
 * @function getDeviceTokenFromConfig
 * @param {Object} config - Configuration object
 * @returns {Promise<Object|null>} Object with token and controllerUrl or null
 */
async function getDeviceTokenFromConfig(config) {
  if (!config.device) {
    return null;
  }

  const deviceUrls = Object.keys(config.device);
  if (deviceUrls.length === 0) {
    return null;
  }

  const controllerUrl = deviceUrls[0];
  const deviceToken = await getOrRefreshDeviceToken(controllerUrl);
  if (deviceToken && deviceToken.token) {
    return {
      token: deviceToken.token,
      controllerUrl: deviceToken.controller
    };
  }

  return null;
}

/**
 * Validates authentication for datasource listing
 * @function validateDatasourceListingAuth
 * @param {string|null} token - Authentication token
 * @param {string|null} controllerUrl - Controller URL
 */
function validateDatasourceListingAuth(token, controllerUrl) {
  if (!token || !controllerUrl) {
    logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
    logger.error(chalk.gray('   Use device code flow: aifabrix login --method device --controller <url>'));
    process.exit(1);
  }
}

/**
 * Handles API response errors
 * @function handleDatasourceApiError
 * @param {Object} response - API response
 */
function handleDatasourceApiError(response) {
  const formattedError = response.formattedError || formatApiError(response);
  logger.error(formattedError);
  logger.error(chalk.gray('\nFull response for debugging:'));
  logger.error(chalk.gray(JSON.stringify(response, null, 2)));
  process.exit(1);
}

async function listDatasources(_options) {
  const config = await getConfig();

  // Resolve environment from config.yaml (no flags)
  const environment = await resolveEnvironment();

  // Try to get device token
  const authInfo = await getDeviceTokenFromConfig(config);
  validateDatasourceListingAuth(authInfo?.token, authInfo?.controllerUrl);

  // Call controller API using centralized API client
  // Note: validateDatasourceListingAuth will exit if auth is missing, so this check is defensive
  if (!authInfo || !authInfo.token || !authInfo.controllerUrl) {
    validateDatasourceListingAuth(null, null); // This will exit
    return; // Never reached, but satisfies linter
  }
  const authConfig = { type: 'bearer', token: authInfo.token };
  const response = await listEnvironmentDatasources(authInfo.controllerUrl, environment, authConfig);

  if (!response.success || !response.data) {
    handleDatasourceApiError(response);
    return; // Ensure we don't continue after exit
  }

  const datasources = extractDatasources(response);
  displayDatasources(datasources, environment);
}

module.exports = {
  listDatasources,
  displayDatasources,
  extractDatasources
};

