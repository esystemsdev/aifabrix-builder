/**
 * Authentication Configuration Commands
 *
 * Handles setting controller, environment, and dataplane URLs in config.yaml
 *
 * @fileoverview Authentication configuration commands
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const {
  setControllerUrl,
  setCurrentEnvironment,
  getControllerUrl
} = require('../core/config');
const {
  validateControllerUrl,
  validateEnvironment,
  checkUserLoggedIn
} = require('../utils/auth-config-validator');
const logger = require('../utils/logger');

/**
 * Handle set-controller command
 * @async
 * @function handleSetController
 * @param {string} url - Controller URL to set
 * @returns {Promise<void>}
 * @throws {Error} If validation fails
 */
async function handleSetController(url) {
  try {
    // Validate URL format
    validateControllerUrl(url);

    // Check if user is logged in to that controller
    const isLoggedIn = await checkUserLoggedIn(url);
    if (!isLoggedIn) {
      throw new Error(
        `You are not logged in to controller ${url}.\n` +
        'Please run "aifabrix login" first to authenticate with this controller.'
      );
    }

    // Save controller URL
    await setControllerUrl(url);

    logger.log(chalk.green(`✓ Controller URL set to: ${url}`));
  } catch (error) {
    logger.error(chalk.red(`✗ Failed to set controller URL: ${error.message}`));
    throw error;
  }
}

/**
 * Handle set-environment command
 * @async
 * @function handleSetEnvironment
 * @param {string} environment - Environment key to set
 * @returns {Promise<void>}
 * @throws {Error} If validation fails
 */
async function handleSetEnvironment(environment) {
  try {
    // Validate environment format
    validateEnvironment(environment);

    // Get current controller from config
    const controllerUrl = await getControllerUrl();
    if (!controllerUrl) {
      throw new Error(
        'No controller URL found in config.\n' +
        'Please run "aifabrix login" first to set the controller URL.'
      );
    }

    // Check if user is logged in to that controller
    const isLoggedIn = await checkUserLoggedIn(controllerUrl);
    if (!isLoggedIn) {
      throw new Error(
        `You are not logged in to controller ${controllerUrl}.\n` +
        'Please run "aifabrix login" first to authenticate with this controller.'
      );
    }

    // Save environment
    await setCurrentEnvironment(environment);

    logger.log(chalk.green(`✓ Environment set to: ${environment}`));
  } catch (error) {
    logger.error(chalk.red(`✗ Failed to set environment: ${error.message}`));
    throw error;
  }
}

/**
 * Handle auth config command
 * @async
 * @function handleAuthConfig
 * @param {Object} options - Command options
 * @param {string} [options.setController] - Controller URL to set
 * @param {string} [options.setEnvironment] - Environment to set
 * @returns {Promise<void>}
 * @throws {Error} If command fails
 */
async function handleAuthConfig(options) {
  if (!options.setController && !options.setEnvironment) {
    throw new Error(
      'No action specified. Use one of:\n' +
      '  --set-controller <url>\n' +
      '  --set-environment <env>'
    );
  }
  if (options.setController) {
    await handleSetController(options.setController);
  }
  if (options.setEnvironment) {
    await handleSetEnvironment(options.setEnvironment);
  }
}

module.exports = {
  handleAuthConfig
};
