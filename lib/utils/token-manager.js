/**
 * AI Fabrix Builder Token Management Utilities
 *
 * Centralized token management for device and client credentials tokens
 * Handles token retrieval, expiration checking, and refresh logic
 *
 * @fileoverview Token management utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../core/config');
const logger = require('./logger');
const pathsUtil = require('./paths');
const {
  refreshClientToken,
  refreshDeviceToken
} = require('./token-manager-refresh');

function getSecretsFilePath() {
  return path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');
}

/**
 * Load client credentials from secrets.local.yaml or process.env (e.g. integration/hubspot/.env).
 * Reads secrets file using pattern: <app-name>-client-idKeyVault and <app-name>-client-secretKeyVault.
 * If not found, checks process.env.CLIENTID and process.env.CLIENTSECRET (set when .env is loaded).
 * @param {string} appName - Application name
 * @returns {Promise<{clientId: string, clientSecret: string}|null>} Credentials or null if not found
 */
async function loadClientCredentials(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  try {
    const secretsFile = getSecretsFilePath();
    if (fs.existsSync(secretsFile)) {
      const content = fs.readFileSync(secretsFile, 'utf8');
      const secrets = yaml.load(content) || {};

      const clientIdKey = `${appName}-client-idKeyVault`;
      const clientSecretKey = `${appName}-client-secretKeyVault`;

      const clientId = secrets[clientIdKey];
      const clientSecret = secrets[clientSecretKey];

      if (clientId && clientSecret) {
        return {
          clientId: String(clientId),
          clientSecret: String(clientSecret)
        };
      }
    }
  } catch (error) {
    logger.warn(`Failed to load credentials from secrets.local.yaml: ${error.message}`);
  }

  // Fallback: use CLIENTID/CLIENTSECRET from process.env (e.g. from integration/hubspot/.env)
  const envClientId = process.env.CLIENTID || process.env.CLIENT_ID;
  const envClientSecret = process.env.CLIENTSECRET || process.env.CLIENT_SECRET;
  if (envClientId && envClientSecret) {
    return {
      clientId: String(envClientId).trim(),
      clientSecret: String(envClientSecret).trim()
    };
  }

  return null;
}

/**
 * Get device token for controller
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<{controller: string, token: string, refreshToken: string, expiresAt: string}|null>} Device token info or null
 */
async function getDeviceToken(controllerUrl) {
  return await config.getDeviceToken(controllerUrl);
}

/**
 * Get client token for environment and app
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @returns {Promise<{controller: string, token: string, expiresAt: string}|null>} Client token info or null
 */
async function getClientToken(environment, appName) {
  return await config.getClientToken(environment, appName);
}

/**
 * Check if token is expired
 * @param {string} expiresAt - ISO timestamp string
 * @returns {boolean} True if token is expired
 */
function isTokenExpired(expiresAt) {
  return config.isTokenExpired(expiresAt);
}

/**
 * Check if token should be refreshed proactively
 * Returns true if token is within 15 minutes of expiry
 * This helps keep Keycloak sessions alive by refreshing before the SSO Session Idle timeout (30 minutes)
 * @param {string} expiresAt - ISO timestamp string
 * @returns {boolean} True if token should be refreshed proactively
 */
function shouldRefreshToken(expiresAt) {
  return config.shouldRefreshToken(expiresAt);
}

/**
 * Get or refresh client token for environment and app
 * Checks if token exists and is valid, refreshes if expired
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<{token: string, controller: string}>} Token and controller URL
 * @throws {Error} If token cannot be retrieved or refreshed
 */
async function getOrRefreshClientToken(environment, appName, controllerUrl) {
  // Try to get existing token
  const tokenInfo = await getClientToken(environment, appName);

  if (tokenInfo && tokenInfo.controller === controllerUrl && !isTokenExpired(tokenInfo.expiresAt)) {
    // Token exists, is for correct controller, and is not expired
    return {
      token: tokenInfo.token,
      controller: tokenInfo.controller
    };
  }

  // Token missing or expired, refresh it
  const refreshed = await refreshClientToken(environment, appName, controllerUrl);
  return {
    token: refreshed.token,
    controller: controllerUrl
  };
}

/**
 * Get or refresh device token for controller
 * Checks if token exists and is valid, refreshes proactively if within 15 minutes of expiry
 * This helps keep Keycloak sessions alive by refreshing before the SSO Session Idle timeout (30 minutes)
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<{token: string, controller: string}|null>} Token and controller URL, or null if not available
 */
async function getOrRefreshDeviceToken(controllerUrl) {
  // Try to get existing token
  const tokenInfo = await getDeviceToken(controllerUrl);

  if (!tokenInfo) {
    return null;
  }

  // Check if token should be refreshed proactively (within 15 minutes of expiry)
  // This ensures we refresh before Keycloak's SSO Session Idle timeout (30 minutes)
  const needsRefresh = shouldRefreshToken(tokenInfo.expiresAt);

  if (!needsRefresh) {
    // Token is valid and doesn't need refresh yet
    return {
      token: tokenInfo.token,
      controller: tokenInfo.controller
    };
  }

  // Token needs refresh (expired or within 15 minutes of expiry)
  // Try to refresh if refresh token exists
  if (!tokenInfo.refreshToken) {
    // No refresh token available
    logger.warn('Access token expired and no refresh token available. Please login again using: aifabrix login');
    return null;
  }

  try {
    const refreshed = await refreshDeviceToken(controllerUrl, tokenInfo.refreshToken);
    return {
      token: refreshed.token,
      controller: controllerUrl
    };
  } catch (error) {
    // Refresh failed - check if it's a refresh token expiry
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('Refresh token has expired')) {
      logger.warn(`Refresh token expired: ${errorMessage}`);
    } else {
      logger.warn(`Failed to refresh device token: ${errorMessage}`);
    }
    return null;
  }
}

/**
 * Validates deployment auth parameters
 * @function validateDeploymentAuthParams
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @throws {Error} If validation fails
 */
function validateDeploymentAuthParams(controllerUrl, environment, appName) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('Controller URL is required');
  }
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment is required');
  }
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required');
  }
}

/**
 * Tries to get device token for deployment auth
 * @async
 * @function tryDeviceTokenAuth
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<Object|null>} Auth config with device token or null
 */
async function tryDeviceTokenAuth(controllerUrl) {
  const deviceToken = await getOrRefreshDeviceToken(controllerUrl);
  if (deviceToken && deviceToken.token) {
    return {
      type: 'bearer',
      token: deviceToken.token,
      controller: deviceToken.controller
    };
  }
  return null;
}

/**
 * Tries to get client token for deployment auth
 * @async
 * @function tryClientTokenAuth
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<Object|null>} Auth config with client token or null
 */
async function tryClientTokenAuth(environment, appName, controllerUrl) {
  try {
    const clientToken = await getOrRefreshClientToken(environment, appName, controllerUrl);
    if (clientToken && clientToken.token) {
      return {
        type: 'bearer',
        token: clientToken.token,
        controller: clientToken.controller
      };
    }
  } catch (error) {
    // Client token unavailable, continue to credentials
    logger.warn(`Client token unavailable: ${error.message}`);
  }
  return null;
}

/**
 * Tries to get client credentials for deployment auth
 * @async
 * @function tryClientCredentialsAuth
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<Object|null>} Auth config with client credentials or null
 */
async function tryClientCredentialsAuth(appName, controllerUrl) {
  const credentials = await loadClientCredentials(appName);
  if (credentials && credentials.clientId && credentials.clientSecret) {
    return {
      type: 'client-credentials',
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      controller: controllerUrl
    };
  }
  return null;
}

/**
 * Get deployment authentication configuration with priority:
 * 1. Device token (Bearer) - for user-level audit tracking (preferred)
 * 2. Client token (Bearer) - for application-level authentication
 * 3. Client credentials (x-client-id/x-client-secret) - direct credential authentication
 *
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @returns {Promise<{type: 'bearer'|'client-credentials', token?: string, clientId?: string, clientSecret?: string, controller: string}>} Auth configuration
 * @throws {Error} If no authentication method is available
 */
async function getDeploymentAuth(controllerUrl, environment, appName) {
  validateDeploymentAuthParams(controllerUrl, environment, appName);

  // Priority 1: Try device token (for user-level audit)
  const deviceAuth = await tryDeviceTokenAuth(controllerUrl);
  if (deviceAuth) {
    return deviceAuth;
  }

  // Priority 2: Try client token (application-level)
  const clientTokenAuth = await tryClientTokenAuth(environment, appName, controllerUrl);
  if (clientTokenAuth) {
    return clientTokenAuth;
  }

  // Priority 3: Use client credentials directly
  const credentialsAuth = await tryClientCredentialsAuth(appName, controllerUrl);
  if (credentialsAuth) {
    return credentialsAuth;
  }

  throw new Error(`No authentication method available. Run 'aifabrix login' for device token, or add credentials to ~/.aifabrix/secrets.local.yaml as '${appName}-client-idKeyVault' and '${appName}-client-secretKeyVault'`);
}

/**
 * Extracts client credentials from authConfig, loading from secrets if needed
 * Used for validation and deployment endpoints that require clientId/clientSecret
 * @async
 * @param {Object} authConfig - Authentication configuration
 * @param {string} appKey - Application key for loading credentials
 * @param {string} envKey - Environment key
 * @param {Object} options - Options with controllerId
 * @returns {Promise<{clientId: string, clientSecret: string}>} Client credentials
 * @throws {Error} If credentials cannot be obtained
 */
async function extractClientCredentials(authConfig, appKey, envKey, _options = {}) {
  if (authConfig.type === 'client-credentials') {
    if (!authConfig.clientId || !authConfig.clientSecret) {
      throw new Error('Client ID and Client Secret are required for client-credentials authentication');
    }
    return {
      clientId: authConfig.clientId,
      clientSecret: authConfig.clientSecret
    };
  }

  if (authConfig.type === 'bearer') {
    if (authConfig.clientId && authConfig.clientSecret) {
      return {
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret
      };
    }

    // Try to load from secrets.local.yaml
    const credentials = await loadClientCredentials(appKey);
    if (credentials && credentials.clientId && credentials.clientSecret) {
      // Store in authConfig so they're available for deployment step
      authConfig.clientId = credentials.clientId;
      authConfig.clientSecret = credentials.clientSecret;
      return {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret
      };
    }

    // No credentials found - provide helpful error message
    throw new Error(
      'Client ID and Client Secret are required for deployment.\n' +
      'Add credentials to ~/.aifabrix/secrets.local.yaml as:\n' +
      `  '${appKey}-client-idKeyVault': <client-id>\n` +
      `  '${appKey}-client-secretKeyVault': <client-secret>\n\n` +
      'Or use credentials authentication with --client-id and --client-secret flags.'
    );
  }

  throw new Error('Invalid authentication type');
}

/**
 * Force refresh device token for controller (regardless of local expiry time)
 * Used when server returns 401 even though local token hasn't expired
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<{token: string, controller: string}|null>} Token and controller URL, or null if not available
 */
async function forceRefreshDeviceToken(controllerUrl) {
  // Try to get existing token to get refresh token
  const tokenInfo = await getDeviceToken(controllerUrl);

  if (!tokenInfo) {
    return null;
  }

  // Must have refresh token to force refresh
  if (!tokenInfo.refreshToken) {
    logger.warn('Cannot refresh: no refresh token available. Please login again using: aifabrix login');
    return null;
  }

  try {
    const refreshed = await refreshDeviceToken(controllerUrl, tokenInfo.refreshToken);
    return {
      token: refreshed.token,
      controller: controllerUrl
    };
  } catch (error) {
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('Refresh token has expired')) {
      logger.warn(`Refresh token expired: ${errorMessage}`);
    } else {
      logger.warn(`Failed to refresh device token: ${errorMessage}`);
    }
    return null;
  }
}

/**
 * Get device-only authentication for services that require user-level authentication.
 * Used for interactive commands like wizard that don't support client credentials.
 * @async
 * @function getDeviceOnlyAuth
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<Object>} Auth config with device token
 * @throws {Error} If device token is not available
 */
async function getDeviceOnlyAuth(controllerUrl) {
  const deviceToken = await getOrRefreshDeviceToken(controllerUrl);
  if (deviceToken && deviceToken.token) {
    return {
      type: 'bearer',
      token: deviceToken.token,
      controller: deviceToken.controller
    };
  }
  throw new Error('Device token authentication required. Run "aifabrix login" to authenticate.');
}

module.exports = {
  getDeviceToken,
  getClientToken,
  isTokenExpired,
  shouldRefreshToken,
  refreshClientToken,
  refreshDeviceToken,
  loadClientCredentials,
  getOrRefreshClientToken,
  getOrRefreshDeviceToken,
  forceRefreshDeviceToken,
  getDeploymentAuth,
  getDeviceOnlyAuth,
  extractClientCredentials
};

