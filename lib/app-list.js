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
const { getConfig } = require('./config');
const { getOrRefreshDeviceToken } = require('./utils/token-manager');
const { listEnvironmentApplications } = require('./api/environments.api');
const { formatApiError } = require('./utils/api-error-handler');
const logger = require('./utils/logger');

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
  let applications;

  // Check if apiResponse.data is an array (wrapped format)
  if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data)) {
    applications = apiResponse.data;
  } else if (Array.isArray(apiResponse)) {
    // Check if apiResponse is directly an array
    applications = apiResponse;
  } else if (apiResponse && Array.isArray(apiResponse.items)) {
    // Check if apiResponse.items is an array (paginated format)
    applications = apiResponse.items;
  } else if (apiResponse && apiResponse.data && apiResponse.data.items && Array.isArray(apiResponse.data.items)) {
    // Check if apiResponse.data.items is an array (wrapped paginated format)
    applications = apiResponse.data.items;
  } else {
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
 * List applications in an environment
 * @async
 * @param {Object} options - Command options
 * @param {string} options.environment - Environment ID or key
 * @throws {Error} If listing fails
 */
async function listApplications(options) {
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

  // Use centralized API client
  const authConfig = { type: 'bearer', token: token };
  const response = await listEnvironmentApplications(controllerUrl, options.environment, authConfig);

  if (!response.success || !response.data) {
    const formattedError = response.formattedError || formatApiError(response);
    logger.error(formattedError);
    // Log full response for debugging
    logger.error(chalk.gray('\nFull response for debugging:'));
    logger.error(chalk.gray(JSON.stringify(response, null, 2)));
    process.exit(1);
  }

  const applications = extractApplications(response);
  displayApplications(applications, options.environment);
}

module.exports = { listApplications };

