/**
 * Authentication Configuration Validators
 *
 * Provides validation functions for authentication configuration commands
 *
 * @fileoverview Authentication configuration validators
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getControllerUrlFromLoggedInUser } = require('./controller-url');

/**
 * Validate controller URL format
 * @function validateControllerUrl
 * @param {string} url - Controller URL to validate
 * @throws {Error} If URL format is invalid
 */
function validateControllerUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Controller URL is required and must be a string');
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    throw new Error('Controller URL cannot be empty');
  }

  // Basic URL validation - must start with http:// or https://
  if (!trimmed.match(/^https?:\/\//)) {
    throw new Error('Controller URL must start with http:// or https://');
  }

  try {
    // Use URL constructor for more thorough validation
    new URL(trimmed);
  } catch (error) {
    throw new Error(`Invalid controller URL format: ${error.message}`);
  }
}

/**
 * Validate environment key format
 * @function validateEnvironment
 * @param {string} env - Environment key to validate
 * @throws {Error} If environment format is invalid
 */
function validateEnvironment(env) {
  if (!env || typeof env !== 'string') {
    throw new Error('Environment is required and must be a string');
  }

  const trimmed = env.trim();
  if (trimmed.length === 0) {
    throw new Error('Environment cannot be empty');
  }

  // Environment key must contain only letters, numbers, hyphens, and underscores
  if (!/^[a-z0-9-_]+$/i.test(trimmed)) {
    throw new Error('Environment must contain only letters, numbers, hyphens, and underscores');
  }
}

/**
 * Check if user is logged in to a controller
 * @async
 * @function checkUserLoggedIn
 * @param {string} controllerUrl - Controller URL to check
 * @returns {Promise<boolean>} True if user has device token for this controller
 */
async function checkUserLoggedIn(controllerUrl) {
  if (!controllerUrl) {
    return false;
  }

  const normalizedUrl = controllerUrl.trim().replace(/\/+$/, '');
  const loggedInControllerUrl = await getControllerUrlFromLoggedInUser();

  if (!loggedInControllerUrl) {
    return false;
  }

  // Normalize both URLs for comparison
  const normalizedLoggedIn = loggedInControllerUrl.trim().replace(/\/+$/, '');
  return normalizedLoggedIn === normalizedUrl;
}

module.exports = {
  validateControllerUrl,
  validateEnvironment,
  checkUserLoggedIn
};
