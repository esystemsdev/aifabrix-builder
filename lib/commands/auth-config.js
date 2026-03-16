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
const { getControllerUrlFromLoggedInUser } = require('../utils/controller-url');
const logger = require('../utils/logger');

/**
 * Handle set-controller command
 * Allows setting the default controller when no credentials are stored, or when already logged in to that controller.
 * If credentials exist for a different controller, throws with a clear message.
 *
 * @async
 * @function handleSetController
 * @param {string} url - Controller URL to set
 * @returns {Promise<void>}
 * @throws {Error} If validation fails or credentials exist for another controller
 */
async function handleSetController(url) {
  try {
    validateControllerUrl(url);
    const normalizedUrl = url.trim().replace(/\/+$/, '');

    const loggedInControllerUrl = await getControllerUrlFromLoggedInUser();
    if (!loggedInControllerUrl) {
      // No stored credentials: allow setting controller so "aifabrix login" opens the right place
      await setControllerUrl(url);
      logger.log(chalk.green(`✓ Controller URL set to: ${url}`));
      return;
    }

    const normalizedLoggedIn = loggedInControllerUrl.trim().replace(/\/+$/, '');
    if (normalizedLoggedIn === normalizedUrl) {
      await setControllerUrl(url);
      logger.log(chalk.green(`✓ Controller URL set to: ${url}`));
      return;
    }

    throw new Error(
      `You have credentials for another controller (${loggedInControllerUrl}).\n` +
      'To use a different controller either run "aifabrix login" with that controller, or run "aifabrix logout" first to clear credentials, then set the new controller with "aifabrix auth --set-controller <url>".'
    );
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
        'No controller URL found in config. Run "aifabrix login" first, or set the controller with "aifabrix auth --set-controller <url>".'
      );
    }

    // Check if user is logged in to that controller
    const isLoggedIn = await checkUserLoggedIn(controllerUrl);
    if (!isLoggedIn) {
      throw new Error(
        `You are not logged in to controller ${controllerUrl}. Run "aifabrix login" first to authenticate.`
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
      'No action specified. Use "aifabrix auth --set-controller <url>" or "aifabrix auth --set-environment <env>".'
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
