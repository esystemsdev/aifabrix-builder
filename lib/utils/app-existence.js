/**
 * Application Existence Check Utility
 *
 * Checks if an application exists in an environment before deployment.
 *
 * @fileoverview Application existence checking for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getEnvironmentApplication } = require('../api/environments.api');

/**
 * Check if application exists in the environment
 * Uses device token auth to check existence (doesn't require app credentials)
 * @async
 * @function checkApplicationExists
 * @param {string} appKey - Application key
 * @param {string} controllerUrl - Controller URL
 * @param {string} envKey - Environment key
 * @param {Object} authConfig - Authentication configuration (device token)
 * @returns {Promise<boolean>} True if application exists, false otherwise
 */
async function checkApplicationExists(appKey, controllerUrl, envKey, authConfig) {
  try {
    // Use device token auth (bearer token) to check if app exists
    // This doesn't require app credentials, so it works even if credentials are wrong
    const deviceAuthConfig = { type: 'bearer', token: authConfig.token };
    const response = await getEnvironmentApplication(controllerUrl, envKey, appKey, deviceAuthConfig);
    return response.success && response.data !== null && response.data !== undefined;
  } catch (error) {
    // If 404, application doesn't exist
    if (error.status === 404 || (error.response && error.response.status === 404)) {
      return false;
    }
    // For other errors (including 401 if device token is invalid), we can't determine existence
    // Return false to avoid blocking deployment - the validation step will catch credential issues
    return false;
  }
}

module.exports = { checkApplicationExists };
