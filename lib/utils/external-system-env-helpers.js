/**
 * External System Environment Variable Helpers
 *
 * Helper functions for extracting environment variables from external system configurations.
 * Separated from external-system-download.js to maintain file size limits.
 *
 * @fileoverview External system environment variable extraction helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Extract OAuth2 environment variables
 * @param {Object} oauth2 - OAuth2 configuration
 * @param {string} systemKey - System key
 * @param {Array<string>} lines - Lines array to append to
 */
function extractOAuth2EnvVars(oauth2, systemKey, lines) {
  if (oauth2.clientId && oauth2.clientId.includes('{{')) {
    const key = oauth2.clientId.replace(/[{}]/g, '').trim();
    lines.push(`${key}=kv://secrets/${systemKey}/client-id`);
  }
  if (oauth2.clientSecret && oauth2.clientSecret.includes('{{')) {
    const key = oauth2.clientSecret.replace(/[{}]/g, '').trim();
    lines.push(`${key}=kv://secrets/${systemKey}/client-secret`);
  }
}

/**
 * Extract API Key environment variables
 * @param {Object} apikey - API Key configuration
 * @param {string} systemKey - System key
 * @param {Array<string>} lines - Lines array to append to
 */
function extractApiKeyEnvVars(apikey, systemKey, lines) {
  if (apikey.key && apikey.key.includes('{{')) {
    const key = apikey.key.replace(/[{}]/g, '').trim();
    lines.push(`${key}=kv://secrets/${systemKey}/api-key`);
  }
}

/**
 * Extract Basic Auth environment variables
 * @param {Object} basic - Basic Auth configuration
 * @param {string} systemKey - System key
 * @param {Array<string>} lines - Lines array to append to
 */
function extractBasicAuthEnvVars(basic, systemKey, lines) {
  if (basic.username && basic.username.includes('{{')) {
    const key = basic.username.replace(/[{}]/g, '').trim();
    lines.push(`${key}=kv://secrets/${systemKey}/username`);
  }
  if (basic.password && basic.password.includes('{{')) {
    const key = basic.password.replace(/[{}]/g, '').trim();
    lines.push(`${key}=kv://secrets/${systemKey}/password`);
  }
}

/**
 * Extract authentication environment variables
 * @param {Object} auth - Authentication configuration
 * @param {string} systemKey - System key
 * @param {Array<string>} lines - Lines array to append to
 */
function extractAuthEnvVars(auth, systemKey, lines) {
  // OAuth2 configuration
  if (auth.type === 'oauth2' && auth.oauth2) {
    extractOAuth2EnvVars(auth.oauth2, systemKey, lines);
  }

  // API Key configuration
  if (auth.type === 'apikey' && auth.apikey) {
    extractApiKeyEnvVars(auth.apikey, systemKey, lines);
  }

  // Basic Auth configuration
  if (auth.type === 'basic' && auth.basic) {
    extractBasicAuthEnvVars(auth.basic, systemKey, lines);
  }
}

/**
 * Extracts environment variables from authentication configuration
 * @param {Object} application - External system configuration
 * @returns {string} Environment variables template content
 */
function generateEnvTemplate(application) {
  const lines = ['# Environment variables for external system'];
  lines.push(`# System: ${application.key || 'unknown'}`);
  lines.push('');

  if (!application.authentication) {
    return lines.join('\n');
  }

  extractAuthEnvVars(application.authentication, application.key, lines);
  return lines.join('\n');
}

module.exports = {
  extractOAuth2EnvVars,
  extractApiKeyEnvVars,
  extractBasicAuthEnvVars,
  extractAuthEnvVars,
  generateEnvTemplate
};

