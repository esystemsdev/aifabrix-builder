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
const { formatBlockingError, formatSuccessLine } = require('../utils/cli-test-layout-chalk');
const {
  setControllerUrl,
  setCurrentEnvironment,
  getControllerUrl,
  getRegisteredControllerUrls,
  getConfig
} = require('../core/config');
const {
  validateControllerUrl,
  validateEnvironment,
  checkUserLoggedIn
} = require('../utils/auth-config-validator');
const { hasStoredDeviceTokenForController } = require('../utils/controller-url');
const logger = require('../utils/logger');

/**
 * True when user ran --set-controller with no URL (pick from config.yaml).
 * @param {unknown} setController - Commander option value
 * @returns {boolean}
 */
function isInteractiveControllerPick(setController) {
  return (
    setController === true ||
    (typeof setController === 'string' && setController.trim() === '')
  );
}

/**
 * True when a non-empty controller URL string was passed.
 * @param {unknown} setController - Commander option value
 * @returns {boolean}
 */
function hasExplicitControllerUrl(setController) {
  return typeof setController === 'string' && setController.trim() !== '';
}

/**
 * Normalize controller URL for equality checks (trailing slashes).
 * @param {string|null|undefined} url - URL or empty
 * @returns {string}
 */
function normalizeForCompare(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
}

function throwNoRegisteredControllers() {
  const msg =
    'No controllers are registered in config. Run "aifabrix login" first, or set a controller with "aifabrix auth --set-controller <url>".';
  logger.error(formatBlockingError(msg));
  throw new Error(msg);
}

function throwNonInteractiveControllerPick() {
  const msg =
    'Cannot choose a controller without a URL in non-interactive mode. Run: aifabrix auth --set-controller <url>';
  logger.error(formatBlockingError(msg));
  throw new Error(msg);
}

/**
 * Pick default controller from URLs in config (`controller` + `device` keys), or set the only one.
 * @async
 * @returns {Promise<void>}
 */
async function handleSelectRegisteredController() {
  const urls = await getRegisteredControllerUrls();

  if (urls.length === 0) {
    throwNoRegisteredControllers();
  }

  if (!process.stdin.isTTY) {
    throwNonInteractiveControllerPick();
  }

  if (urls.length === 1) {
    const sole = urls[0];
    const current = await getControllerUrl();
    if (normalizeForCompare(current) === normalizeForCompare(sole)) {
      logger.log(formatSuccessLine(`Default controller is already set to ${sole}.`));
      logger.log(
        chalk.white('To add another controller, run: aifabrix auth --set-controller <url>')
      );
      return;
    }
    await handleSetController(sole);
    return;
  }

  const inquirer = require('inquirer');
  const { controllerUrl } = await inquirer.prompt([
    {
      type: 'list',
      name: 'controllerUrl',
      message: 'Select default controller:',
      choices: urls
    }
  ]);
  await handleSetController(controllerUrl);
}

/**
 * Handle set-controller command
 * Allows setting the default controller when there are no device tokens, or when a token exists
 * for the target URL (including switching among multiple logged-in controllers). If device tokens
 * exist only for other controller URLs, throws with a clear message.
 *
 * @async
 * @function handleSetController
 * @param {string} url - Controller URL to set
 * @returns {Promise<void>}
 * @throws {Error} If validation fails or credentials exist only for other controllers
 */
async function handleSetController(url) {
  try {
    validateControllerUrl(url);
    const normalizedUrl = url.trim().replace(/\/+$/, '');

    const userConfig = await getConfig();
    const device =
      userConfig.device && typeof userConfig.device === 'object' ? userConfig.device : {};
    const deviceKeys = Object.keys(device);
    const hasTokenForTarget = await hasStoredDeviceTokenForController(normalizedUrl);

    if (deviceKeys.length === 0 || hasTokenForTarget) {
      await setControllerUrl(url);
      logger.log(formatSuccessLine(`Controller URL set to: ${url}`));
      return;
    }

    const otherKey =
      deviceKeys.find((k) => normalizeForCompare(k) !== normalizeForCompare(normalizedUrl)) ||
      deviceKeys[0];
    throw new Error(
      `You have credentials for another controller (${otherKey.trim().replace(/\/+$/, '')}).\n` +
      'To use a different controller either run "aifabrix login" with that controller, or run "aifabrix logout" first to clear credentials, then set the new controller with "aifabrix auth --set-controller <url>".'
    );
  } catch (error) {
    logger.error(formatBlockingError(`Failed to set controller URL: ${error.message}`));
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

    logger.log(formatSuccessLine(`Environment set to: ${environment}`));
  } catch (error) {
    logger.error(formatBlockingError(`Failed to set environment: ${error.message}`));
    throw error;
  }
}

/**
 * Handle auth config command
 * @async
 * @function handleAuthConfig
 * @param {Object} options - Command options
 * @param {string|boolean} [options.setController] - Controller URL, or true when flag has no value
 * @param {string} [options.setEnvironment] - Environment to set
 * @returns {Promise<void>}
 * @throws {Error} If command fails
 */
async function handleAuthConfig(options) {
  const pick = isInteractiveControllerPick(options.setController);
  const hasUrl = hasExplicitControllerUrl(options.setController);

  if (!pick && !hasUrl && !options.setEnvironment) {
    throw new Error(
      'No action specified. Use "aifabrix auth --set-controller <url>" or "aifabrix auth --set-environment <env>".'
    );
  }

  if (pick) {
    await handleSelectRegisteredController();
  } else if (hasUrl) {
    await handleSetController(options.setController);
  }

  if (options.setEnvironment) {
    await handleSetEnvironment(options.setEnvironment);
  }
}

module.exports = {
  handleAuthConfig
};
