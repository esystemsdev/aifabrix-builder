/**
 * @fileoverview Wizard dataplane URL discovery utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { getDataplaneUrl } = require('../datasource/deploy');
const { listEnvironmentApplications } = require('../api/environments.api');

/**
 * Find dataplane service application key from environment applications list
 * @async
 * @function findDataplaneServiceAppKey
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<string|null>} Dataplane service appKey or null if not found
 */
// eslint-disable-next-line complexity
async function findDataplaneServiceAppKey(controllerUrl, environment, authConfig) {
  try {
    const response = await listEnvironmentApplications(controllerUrl, environment, authConfig, { pageSize: 100 });
    if (!response.success || !response.data) return null;
    const applications = response.data.data || response.data || [];
    for (const app of applications) {
      const appKey = app.key || app.id;
      if (!appKey) continue;
      const keyLower = appKey.toLowerCase();
      const appType = app.configuration?.type || app.type;
      const nameLower = (app.displayName || app.name || '').toLowerCase();
      if (keyLower === 'dataplane' || keyLower.includes('dataplane') || (appType === 'service' && nameLower.includes('dataplane'))) {
        return appKey;
      }
    }
    return null;
  } catch (error) {
    logger.log(chalk.gray(`  Could not list applications: ${error.message}`));
    return null;
  }
}

/**
 * Check if error is a "Not Found" error
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is a "Not Found" error
 */
function isNotFoundError(error) {
  return error.message.includes('Not Found') ||
         error.message.includes('not found') ||
         error.message.includes('Application not found');
}

/**
 * Create error message for missing dataplane service
 * @returns {Error} Error with helpful message
 */
function createDataplaneNotFoundError() {
  return new Error(
    'Could not discover dataplane URL from controller. No dataplane service application found in this environment. ' +
    'Please provide the dataplane URL using --dataplane <url> flag.'
  );
}

/**
 * Try to get dataplane URL using fallback app key
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<string>} Dataplane URL
 * @throws {Error} If dataplane URL cannot be retrieved
 */
async function tryFallbackDataplaneUrl(controllerUrl, environment, authConfig) {
  try {
    const fallbackUrl = await getDataplaneUrl(controllerUrl, 'dataplane', environment, authConfig);
    logger.log(chalk.green(`\u2713 Dataplane URL: ${fallbackUrl}`));
    return fallbackUrl;
  } catch (fallbackError) {
    if (isNotFoundError(fallbackError)) {
      throw createDataplaneNotFoundError();
    }
    throw fallbackError;
  }
}

/**
 * Discover dataplane URL from controller
 * @async
 * @function discoverDataplaneUrl
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<string>} Dataplane URL
 * @throws {Error} If dataplane URL cannot be discovered
 */
async function discoverDataplaneUrl(controllerUrl, environment, authConfig) {
  logger.log(chalk.blue('\uD83C\uDF10 Getting dataplane URL from controller...'));
  try {
    const dataplaneAppKey = await findDataplaneServiceAppKey(controllerUrl, environment, authConfig);
    if (dataplaneAppKey) {
      const dataplaneUrl = await getDataplaneUrl(controllerUrl, dataplaneAppKey, environment, authConfig);
      logger.log(chalk.green(`\u2713 Dataplane URL: ${dataplaneUrl}`));
      return dataplaneUrl;
    }
    return await tryFallbackDataplaneUrl(controllerUrl, environment, authConfig);
  } catch (error) {
    if (error.message.includes('Could not discover dataplane URL')) {
      throw error;
    }
    if (isNotFoundError(error) && error.message.includes('Failed to get application')) {
      throw createDataplaneNotFoundError();
    }
    throw new Error(`Failed to discover dataplane URL: ${error.message}`);
  }
}

module.exports = {
  discoverDataplaneUrl,
  findDataplaneServiceAppKey
};
