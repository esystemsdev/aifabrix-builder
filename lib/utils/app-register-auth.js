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
const { getConfig } = require('../config');
const { getOrRefreshDeviceToken } = require('./token-manager');

/**
 * Check if user is authenticated and get token
 * @async
 * @param {string} [controllerUrl] - Optional controller URL from variables.yaml
 * @param {string} [environment] - Optional environment key
 * @returns {Promise<{apiUrl: string, token: string}>} Configuration with API URL and token
 */
async function checkAuthentication(controllerUrl, environment) {
  const config = await getConfig();

  // Try to get controller URL from parameter, config, or device tokens
  let finalControllerUrl = controllerUrl;
  let token = null;

  // If controller URL provided, try to get device token
  if (finalControllerUrl) {
    const deviceToken = await getOrRefreshDeviceToken(finalControllerUrl);
    if (deviceToken && deviceToken.token) {
      token = deviceToken.token;
      finalControllerUrl = deviceToken.controller;
    }
  }

  // If no token yet, try to find any device token in config
  if (!token && config.device) {
    const deviceUrls = Object.keys(config.device);
    if (deviceUrls.length > 0) {
      // Use first available device token
      finalControllerUrl = deviceUrls[0];
      const deviceToken = await getOrRefreshDeviceToken(finalControllerUrl);
      if (deviceToken && deviceToken.token) {
        token = deviceToken.token;
        finalControllerUrl = deviceToken.controller;
      }
    }
  }

  // If still no token, check for client token (requires environment and app)
  if (!token && environment) {
    // For app register, we don't have an app yet, so client tokens won't work
    // This is expected - device tokens should be used for registration
  }

  if (!token || !finalControllerUrl) {
    logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
    logger.error(chalk.gray('   Use device code flow: aifabrix login --method device --controller <url>'));
    process.exit(1);
  }

  return {
    apiUrl: finalControllerUrl,
    token: token
  };
}

module.exports = { checkAuthentication };

