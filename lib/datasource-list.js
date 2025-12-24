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
const { getConfig } = require('./config');
const { getOrRefreshDeviceToken } = require('./utils/token-manager');
const { listEnvironmentDatasources } = require('./api/environments.api');
const { formatApiError } = require('./utils/api-error-handler');
const logger = require('./utils/logger');

/**
 * Extracts datasources array from API response
 * Handles multiple response formats similar to applications list
 *
 * @function extractDatasources
 * @param {Object} response - API response from centralized API client
 * @returns {Array} Array of datasources
 * @throws {Error} If response format is invalid
 */
function extractDatasources(response) {
  if (!response.success || !response.data) {
    throw new Error('Invalid API response: missing success or data');
  }

  const apiResponse = response.data;
  let datasources;

  // Check if apiResponse.data is an array (wrapped format)
  if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data)) {
    datasources = apiResponse.data;
  } else if (Array.isArray(apiResponse)) {
    // Check if apiResponse is directly an array
    datasources = apiResponse;
  } else if (apiResponse && Array.isArray(apiResponse.items)) {
    // Check if apiResponse.items is an array (paginated format)
    datasources = apiResponse.items;
  } else if (apiResponse && apiResponse.data && apiResponse.data.items && Array.isArray(apiResponse.data.items)) {
    // Check if apiResponse.data.items is an array (wrapped paginated format)
    datasources = apiResponse.data.items;
  } else {
    logger.error(chalk.red('❌ Invalid response: expected data array or items array'));
    logger.error(chalk.gray('\nAPI response type:'), typeof apiResponse);
    logger.error(chalk.gray('API response:'), JSON.stringify(apiResponse, null, 2));
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
 * @param {Object} options - Command options
 * @param {string} options.environment - Environment ID or key
 * @throws {Error} If listing fails
 */
async function listDatasources(options) {
  const config = await getConfig();

  // Try to get device token
  let controllerUrl = null;
  let token = null;

  if (config.device) {
    const deviceUrls = Object.keys(config.device);
    if (deviceUrls.length > 0) {
      controllerUrl = deviceUrls[0];
      const deviceToken = await getOrRefreshDeviceToken(controllerUrl);
      if (deviceToken && deviceToken.token) {
        token = deviceToken.token;
        controllerUrl = deviceToken.controller;
      }
    }
  }

  if (!token || !controllerUrl) {
    logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
    logger.error(chalk.gray('   Use device code flow: aifabrix login --method device --controller <url>'));
    process.exit(1);
  }

  // Call controller API using centralized API client
  const authConfig = { type: 'bearer', token };
  const response = await listEnvironmentDatasources(controllerUrl, options.environment, authConfig);

  if (!response.success || !response.data) {
    const formattedError = response.formattedError || formatApiError(response);
    logger.error(formattedError);
    logger.error(chalk.gray('\nFull response for debugging:'));
    logger.error(chalk.gray(JSON.stringify(response, null, 2)));
    process.exit(1);
    return; // Ensure we don't continue after exit
  }

  const datasources = extractDatasources(response);
  displayDatasources(datasources, options.environment);
}

module.exports = {
  listDatasources,
  displayDatasources,
  extractDatasources
};

