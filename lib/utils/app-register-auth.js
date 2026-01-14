/**
 * AI Fabrix Builder - App Register Authentication Utilities
 *
 * Authentication utilities for application registration
 *
 * @fileoverview Authentication utilities for app registration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');
const { getConfig, normalizeControllerUrl } = require('../core/config');
const { getOrRefreshDeviceToken } = require('./token-manager');
const { formatAuthenticationError } = require('./error-formatters/http-status-errors');

/**
 * Display authentication error and exit
 * Uses the centralized error formatter for consistent error messages
 * @param {Error|null} [error] - Optional error object
 * @param {Object|string} [controllerUrlOrData] - Optional controller URL string or error data object
 */
function displayAuthenticationError(error = null, controllerUrlOrData = null) {
  // Build error data object for the formatter
  let errorData;
  if (typeof controllerUrlOrData === 'object' && controllerUrlOrData !== null) {
    // If it's an object, use it directly (may contain attemptedUrls, etc.)
    errorData = {
      message: error ? error.message : controllerUrlOrData.message,
      controllerUrl: controllerUrlOrData.controllerUrl || undefined,
      attemptedUrls: controllerUrlOrData.attemptedUrls || undefined,
      correlationId: controllerUrlOrData.correlationId || undefined
    };
  } else {
    // If it's a string or null, treat as controllerUrl
    errorData = {
      message: error ? error.message : undefined,
      controllerUrl: controllerUrlOrData || undefined,
      correlationId: undefined
    };
  }

  // Use centralized formatter (it will include controller URL in the command)
  const formattedError = formatAuthenticationError(errorData);
  logger.error(formattedError);

  process.exit(1);
}

/**
 * Find device token from config by trying each stored URL
 * @async
 * @param {Object} deviceConfig - Device configuration object
 * @param {Array} attemptedUrls - Array to track attempted URLs
 * @returns {Promise<Object|null>} Token result with token and controllerUrl, or null if not found
 */
async function findDeviceTokenFromConfig(deviceConfig, attemptedUrls) {
  const deviceUrls = Object.keys(deviceConfig);
  if (deviceUrls.length === 0) {
    return null;
  }

  for (const storedUrl of deviceUrls) {
    attemptedUrls.push(storedUrl);
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
 * Check if user is authenticated and get token
 * @async
 * @param {string} [controllerUrl] - Optional controller URL from variables.yaml or --controller flag
 * @param {string} [environment] - Optional environment key
 * @returns {Promise<{apiUrl: string, token: string, controllerUrl: string}>} Configuration with API URL, token, and controller URL
 */
/**
 * Tries to get device token for provided controller URL
 * @async
 * @function tryGetDeviceTokenForController
 * @param {string} controllerUrl - Controller URL
 * @param {Array<string>} attemptedUrls - Array to track attempted URLs
 * @returns {Promise<Object|null>} Token result or null
 */
async function tryGetDeviceTokenForController(controllerUrl, attemptedUrls) {
  if (!controllerUrl) {
    return null;
  }
  attemptedUrls.push(controllerUrl);
  try {
    const deviceToken = await getOrRefreshDeviceToken(controllerUrl);
    if (deviceToken && deviceToken.token) {
      return {
        token: deviceToken.token,
        controllerUrl: deviceToken.controller || controllerUrl
      };
    }
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Failed to get token for controller ${controllerUrl}: ${error.message}`));
    return { error };
  }
  return null;
}

/**
 * Tries to find device token from config
 * @async
 * @function tryFindDeviceTokenFromConfig
 * @param {Object} deviceConfig - Device config from main config
 * @param {Array<string>} attemptedUrls - Array to track attempted URLs
 * @returns {Promise<Object|null>} Token result or null
 */
async function tryFindDeviceTokenFromConfig(deviceConfig, attemptedUrls) {
  if (!deviceConfig) {
    return null;
  }
  const tokenResult = await findDeviceTokenFromConfig(deviceConfig, attemptedUrls);
  if (tokenResult) {
    return {
      token: tokenResult.token,
      controllerUrl: tokenResult.controllerUrl
    };
  }
  return null;
}

/**
 * Creates error data for authentication failure
 * @function createAuthErrorData
 * @param {Error|null} lastError - Last error encountered
 * @param {string|null} controllerUrl - Original controller URL
 * @param {Array<string>} attemptedUrls - Attempted URLs
 * @returns {Object} Error data object
 */
function createAuthErrorData(lastError, controllerUrl, attemptedUrls) {
  return {
    message: lastError ? lastError.message : 'No valid authentication found',
    controllerUrl: controllerUrl || (attemptedUrls.length > 0 ? attemptedUrls[0] : undefined),
    attemptedUrls: attemptedUrls.length > 1 ? attemptedUrls : undefined,
    correlationId: undefined
  };
}

/**
 * Normalizes controller URL
 * @function normalizeControllerUrlIfProvided
 * @param {string|null} controllerUrl - Controller URL
 * @returns {string|null} Normalized controller URL or null
 */
function normalizeControllerUrlIfProvided(controllerUrl) {
  // Handle empty string as falsy (treat same as undefined/null)
  return (controllerUrl && controllerUrl.trim()) ? normalizeControllerUrl(controllerUrl) : null;
}

/**
 * Attempts to get device token for provided controller URL
 * @async
 * @function attemptDeviceTokenForController
 * @param {string|null} finalControllerUrl - Final controller URL
 * @param {string[]} attemptedUrls - Array of attempted URLs
 * @returns {Promise<Object|null>} Device token result or null
 */
async function attemptDeviceTokenForController(finalControllerUrl, attemptedUrls) {
  if (!finalControllerUrl) {
    return null;
  }

  const deviceTokenResult = await tryGetDeviceTokenForController(finalControllerUrl, attemptedUrls);
  return deviceTokenResult;
}

/**
 * Attempts to find device token from config
 * @async
 * @function attemptDeviceTokenFromConfig
 * @param {Object} deviceConfig - Device configuration
 * @param {string[]} attemptedUrls - Array of attempted URLs
 * @returns {Promise<Object|null>} Device token result or null
 */
async function attemptDeviceTokenFromConfig(deviceConfig, attemptedUrls) {
  if (!deviceConfig) {
    return null;
  }

  return await tryFindDeviceTokenFromConfig(deviceConfig, attemptedUrls);
}

/**
 * Validates authentication result
 * @function validateAuthenticationResult
 * @param {string|null} token - Authentication token
 * @param {string|null} finalControllerUrl - Final controller URL
 * @param {Error|null} lastError - Last error encountered
 * @param {string|null} originalControllerUrl - Original controller URL
 * @param {string[]} attemptedUrls - Array of attempted URLs
 */
function validateAuthenticationResult(token, finalControllerUrl, lastError, originalControllerUrl, attemptedUrls) {
  if (!token || !finalControllerUrl) {
    const errorData = createAuthErrorData(lastError, originalControllerUrl, attemptedUrls);
    displayAuthenticationError(lastError, errorData);
  }
}

/**
 * Attempts to get authentication token
 * @async
 * @function attemptGetAuthenticationToken
 * @param {string|null} normalizedControllerUrl - Normalized controller URL
 * @param {Object} config - Configuration object
 * @param {string[]} attemptedUrls - Array of attempted URLs
 * @returns {Promise<Object>} Object with token, finalControllerUrl, and lastError
 */
async function attemptGetAuthenticationToken(normalizedControllerUrl, config, attemptedUrls) {
  let finalControllerUrl = normalizedControllerUrl;
  let token = null;
  let lastError = null;

  // If controller URL provided, try to get device token
  const deviceTokenResult = await attemptDeviceTokenForController(finalControllerUrl, attemptedUrls);
  if (deviceTokenResult) {
    if (deviceTokenResult.error) {
      lastError = deviceTokenResult.error;
    } else {
      token = deviceTokenResult.token;
      finalControllerUrl = deviceTokenResult.controllerUrl;
    }
  }

  // If no token yet, try to find any device token in config
  if (!token) {
    const configTokenResult = await attemptDeviceTokenFromConfig(config.device, attemptedUrls);
    if (configTokenResult) {
      token = configTokenResult.token;
      finalControllerUrl = configTokenResult.controllerUrl;
    }
  }

  return { token, finalControllerUrl, lastError };
}

async function checkAuthentication(controllerUrl, _environment) {
  try {
    const config = await getConfig();
    const normalizedControllerUrl = normalizeControllerUrlIfProvided(controllerUrl);
    const attemptedUrls = [];

    const { token, finalControllerUrl, lastError } = await attemptGetAuthenticationToken(
      normalizedControllerUrl,
      config,
      attemptedUrls
    );

    // If no token found, display error with attempted URLs
    validateAuthenticationResult(token, finalControllerUrl, lastError, controllerUrl, attemptedUrls);

    return {
      apiUrl: finalControllerUrl,
      token: token,
      controllerUrl: finalControllerUrl
    };
  } catch (error) {
    displayAuthenticationError(error, { controllerUrl: controllerUrl });
  }
}

module.exports = { checkAuthentication };

