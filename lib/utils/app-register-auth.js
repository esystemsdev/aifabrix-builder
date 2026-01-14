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
async function checkAuthentication(controllerUrl, environment) {
  try {
    const config = await getConfig();

    // Try to get controller URL from parameter, config, or device tokens
    // Handle empty string as falsy (treat same as undefined/null)
    const normalizedControllerUrl = (controllerUrl && controllerUrl.trim()) ? normalizeControllerUrl(controllerUrl) : null;
    let finalControllerUrl = normalizedControllerUrl;
    let token = null;
    let lastError = null;
    const attemptedUrls = []; // Track all attempted URLs

    // If controller URL provided, try to get device token
    if (finalControllerUrl) {
      attemptedUrls.push(finalControllerUrl);
      try {
        const deviceToken = await getOrRefreshDeviceToken(finalControllerUrl);
        if (deviceToken && deviceToken.token) {
          token = deviceToken.token;
          finalControllerUrl = deviceToken.controller || finalControllerUrl;
        }
      } catch (error) {
        lastError = error;
        logger.warn(chalk.yellow(`⚠️  Failed to get token for controller ${finalControllerUrl}: ${error.message}`));
      }
    }

    // If no token yet, try to find any device token in config
    if (!token && config.device) {
      const tokenResult = await findDeviceTokenFromConfig(config.device, attemptedUrls);
      if (tokenResult) {
        token = tokenResult.token;
        finalControllerUrl = tokenResult.controllerUrl;
      }
    }

    // If still no token, check for client token (requires environment and app)
    if (!token && environment) {
      // For app register, we don't have an app yet, so client tokens won't work
      // This is expected - device tokens should be used for registration
    }

    // If no token found, display error with attempted URLs
    if (!token || !finalControllerUrl) {
      const errorData = {
        message: lastError ? lastError.message : 'No valid authentication found',
        controllerUrl: controllerUrl || (attemptedUrls.length > 0 ? attemptedUrls[0] : undefined),
        attemptedUrls: attemptedUrls.length > 1 ? attemptedUrls : undefined,
        correlationId: undefined
      };
      displayAuthenticationError(lastError, errorData);
    }

    return {
      apiUrl: finalControllerUrl,
      token: token,
      controllerUrl: finalControllerUrl // Return the actual URL used
    };
  } catch (error) {
    // Handle any unexpected errors during authentication check
    displayAuthenticationError(error, { controllerUrl: controllerUrl });
  }
}

module.exports = { checkAuthentication };

