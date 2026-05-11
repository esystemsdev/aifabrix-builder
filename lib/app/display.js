const { formatNextActions, formatSuccessParagraph } = require('../utils/cli-test-layout-chalk');
/**
 * Application Display Utilities
 *
 * Handles display of success messages and user guidance
 * for application creation.
 *
 * @fileoverview Display utilities for application creation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');

/**
 * Displays external system success message
 * @function displayExternalSystemSuccess
 * @param {string} appName - Application name
 * @param {Object} config - Configuration
 * @param {string} location - Application location
 */
function displayExternalSystemSuccess(appName, config, location) {
  logger.log(chalk.blue('Type: External System'));
  logger.log(chalk.blue(`System Key: ${config.systemKey || appName}`));
  logger.log('');
  logger.log(formatNextActions([
    `Edit external system JSON files in ${location}`,
    `Run: aifabrix validate ${appName}`,
    'Run: aifabrix login',
    `Run: aifabrix deploy ${appName}`
  ]));
}

/**
 * Displays webapp success message
 * @function displayWebappSuccess
 * @param {string} appName - Application name
 * @param {Object} config - Configuration
 * @param {string} envConversionMessage - Environment conversion message
 */
function displayWebappSuccess(appName, config, envConversionMessage) {
  logger.log(chalk.blue(`Language: ${config.language}`));
  logger.log(chalk.blue(`Port: ${config.port}`));

  if (config.database) logger.log(chalk.yellow('  - Database enabled'));
  if (config.redis) logger.log(chalk.yellow('  - Redis enabled'));
  if (config.storage) logger.log(chalk.yellow('  - Storage enabled'));
  if (config.authentication) logger.log(chalk.yellow('  - Authentication enabled'));

  logger.log(chalk.gray(envConversionMessage));

  logger.log('');
  logger.log(formatNextActions([
    'Copy env.template to .env and fill in your values',
    'Run: aifabrix up-infra',
    `Run: aifabrix build ${appName}`,
    `Run: aifabrix run ${appName}`
  ]));
}

/**
 * Displays success message after app creation
 * @param {string} appName - Application name
 * @param {Object} config - Final configuration
 * @param {string} envConversionMessage - Environment conversion message
 * @param {boolean} hasAppFiles - Whether app files were created
 * @param {string} appPath - Application path
 */
function displaySuccessMessage(appName, config, envConversionMessage, hasAppFiles = false, appPath = null) {
  logger.log(formatSuccessParagraph('Application created successfully!'));
  logger.log(chalk.blue(`\nApplication: ${appName}`));

  // Determine location based on app type
  const baseDir = config.type === 'external' ? 'integration' : 'builder';
  const location = appPath ? path.relative(process.cwd(), appPath) : `${baseDir}/${appName}/`;
  logger.log(chalk.blue(`Location: ${location}`));

  if (hasAppFiles) {
    logger.log(chalk.blue(`Application files: apps/${appName}/`));
  }

  if (config.type === 'external') {
    displayExternalSystemSuccess(appName, config, location);
  } else {
    displayWebappSuccess(appName, config, envConversionMessage);
  }
}

module.exports = {
  displaySuccessMessage,
  displayExternalSystemSuccess,
  displayWebappSuccess
};

