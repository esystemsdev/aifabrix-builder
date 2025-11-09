/**
 * Deployment Validation Utilities
 *
 * Validates deployment configuration inputs with ISO 27001 security measures.
 *
 * @fileoverview Deployment validation functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Validates and sanitizes controller URL
 * Enforces HTTPS-only communication for security
 *
 * @param {string} url - Controller URL to validate
 * @throws {Error} If URL is invalid or uses HTTP
 */
function validateControllerUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Controller URL is required and must be a string');
  }

  // Must use HTTPS for security (allow http://localhost for local development)
  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    throw new Error('Controller URL must use HTTPS (https://) or http://localhost');
  }

  // Basic URL format validation
  const urlPattern = /^(https?):\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(localhost)?(:[0-9]+)?(\/.*)?$/;
  if (!urlPattern.test(url)) {
    throw new Error('Invalid controller URL format');
  }

  // Remove trailing slash if present
  return url.replace(/\/$/, '');
}

/**
 * Validates environment key
 * @param {string} envKey - Environment key to validate
 * @throws {Error} If environment key is invalid
 */
function validateEnvironmentKey(envKey) {
  if (!envKey || typeof envKey !== 'string') {
    throw new Error('Environment key is required and must be a string');
  }

  const validEnvironments = ['miso', 'dev', 'tst', 'pro'];
  if (!validEnvironments.includes(envKey.toLowerCase())) {
    throw new Error(`Invalid environment key: ${envKey}. Must be one of: ${validEnvironments.join(', ')}`);
  }

  return envKey.toLowerCase();
}

module.exports = {
  validateControllerUrl,
  validateEnvironmentKey
};

