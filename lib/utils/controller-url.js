/**
 * Controller URL Resolution Utilities
 *
 * Provides utilities for resolving controller URLs with developer ID-based defaults
 * and fallback chain support.
 *
 * @fileoverview Controller URL resolution utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDeveloperIdNumber } = require('./env-map');
const devConfig = require('./dev-config');
const config = require('../core/config');

/**
 * Calculate default controller URL based on developer ID
 * Uses getDevPorts to get the app port which is adjusted by developer ID
 * Developer ID 0 = http://localhost:3000
 * Developer ID 1 = http://localhost:3100
 * Developer ID 2 = http://localhost:3200
 * @async
 * @function getDefaultControllerUrl
 * @returns {Promise<string>} Default controller URL
 */
async function getDefaultControllerUrl() {
  const developerId = await getDeveloperIdNumber(null);
  const ports = devConfig.getDevPorts(developerId);
  return `http://localhost:${ports.app}`;
}

/**
 * Normalize controller URL (remove trailing slashes)
 * @param {string} url - Controller URL to normalize
 * @returns {string} Normalized controller URL
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  return url.trim().replace(/\/+$/, '');
}

/**
 * Get controller URL from logged-in user's device tokens
 * Returns the first available controller URL from device tokens stored in config
 * @async
 * @function getControllerUrlFromLoggedInUser
 * @returns {Promise<string|null>} Controller URL from logged-in user, or null if not found
 */
async function getControllerUrlFromLoggedInUser() {
  try {
    const userConfig = await config.getConfig();
    if (!userConfig.device || typeof userConfig.device !== 'object') {
      return null;
    }

    const deviceUrls = Object.keys(userConfig.device);
    if (deviceUrls.length === 0) {
      return null;
    }

    // Return the first available controller URL (normalized)
    const firstControllerUrl = deviceUrls[0];
    return normalizeUrl(firstControllerUrl);
  } catch (error) {
    // If config doesn't exist or can't be read, return null
    return null;
  }
}

/**
 * Get controller URL from config.yaml
 * @async
 * @function getControllerFromConfig
 * @returns {Promise<string|null>} Controller URL from config or null
 */
async function getControllerFromConfig() {
  const { getControllerUrl } = require('../core/config');
  return await getControllerUrl();
}

/**
 * Resolve controller URL with fallback chain
 * Priority:
 * 1. config.controller (from config.yaml)
 * 2. getControllerUrlFromLoggedInUser() (from logged-in device tokens)
 * 3. getDefaultControllerUrl() (developer ID-based default)
 * @async
 * @function resolveControllerUrl
 * @returns {Promise<string>} Resolved controller URL
 */
async function resolveControllerUrl() {
  // Priority 1: config.controller (from config.yaml)
  const configController = await getControllerFromConfig();
  if (configController) {
    return configController.replace(/\/+$/, '');
  }

  // Priority 2: Logged-in user's device tokens
  const loggedInControllerUrl = await getControllerUrlFromLoggedInUser();
  if (loggedInControllerUrl) {
    return loggedInControllerUrl;
  }

  // Priority 3: Developer ID-based default
  return await getDefaultControllerUrl();
}

module.exports = {
  getDefaultControllerUrl,
  getControllerUrlFromLoggedInUser,
  getControllerFromConfig,
  resolveControllerUrl
};
