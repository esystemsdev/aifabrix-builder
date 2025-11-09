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
const os = require('os');
const yaml = require('js-yaml');
const config = require('../config');
const { makeApiCall, refreshDeviceToken: apiRefreshDeviceToken } = require('./api');
const logger = require('./logger');

const SECRETS_FILE = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');

/**
 * Load client credentials from secrets.local.yaml
 * Reads using pattern: <app-name>-client-idKeyVault and <app-name>-client-secretKeyVault
 * @param {string} appName - Application name
 * @returns {Promise<{clientId: string, clientSecret: string}|null>} Credentials or null if not found
 */
async function loadClientCredentials(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  try {
    if (!fs.existsSync(SECRETS_FILE)) {
      return null;
    }

    const content = fs.readFileSync(SECRETS_FILE, 'utf8');
    const secrets = yaml.load(content) || {};

    const clientIdKey = `${appName}-client-idKeyVault`;
    const clientSecretKey = `${appName}-client-secretKeyVault`;

    const clientId = secrets[clientIdKey];
    const clientSecret = secrets[clientSecretKey];

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      clientId: clientId,
      clientSecret: clientSecret
    };
  } catch (error) {
    logger.warn(`Failed to load credentials from secrets.local.yaml: ${error.message}`);
    return null;
  }
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
 * Refresh client token using credentials from secrets.local.yaml
 * Gets new token from API and saves it to config.yaml
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @param {string} [clientId] - Optional client ID (if not provided, loads from secrets.local.yaml)
 * @param {string} [clientSecret] - Optional client secret (if not provided, loads from secrets.local.yaml)
 * @returns {Promise<{token: string, expiresAt: string}>} New token and expiration
 * @throws {Error} If credentials are missing or token refresh fails
 */
async function refreshClientToken(environment, appName, controllerUrl, clientId, clientSecret) {
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment is required and must be a string');
  }
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('Controller URL is required and must be a string');
  }

  // Load credentials if not provided
  let credentials = null;
  if (clientId && clientSecret) {
    credentials = { clientId, clientSecret };
  } else {
    credentials = await loadClientCredentials(appName);
    if (!credentials) {
      throw new Error(`Client credentials not found for app '${appName}'. Add them to ~/.aifabrix/secrets.local.yaml as '${appName}-client-idKeyVault' and '${appName}-client-secretKeyVault'`);
    }
  }

  // Call login API to get new token
  const response = await makeApiCall(`${controllerUrl}/api/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': credentials.clientId,
      'x-client-secret': credentials.clientSecret
    }
  });

  if (!response.success) {
    throw new Error(`Failed to refresh token: ${response.error || 'Unknown error'}`);
  }

  const responseData = response.data;
  if (!responseData || !responseData.token) {
    throw new Error('Invalid response: missing token');
  }

  const token = responseData.token;
  // Calculate expiration (default to 24 hours if not provided)
  const expiresIn = responseData.expiresIn || 86400;
  const expiresAt = responseData.expiresAt || new Date(Date.now() + expiresIn * 1000).toISOString();

  // Save token to config.yaml (NEVER save credentials)
  await config.saveClientToken(environment, appName, controllerUrl, token, expiresAt);

  return { token, expiresAt };
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
 * Refresh device token using refresh token
 * Calls API refresh endpoint and saves new token to config
 * @param {string} controllerUrl - Controller URL
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{token: string, refreshToken: string, expiresAt: string}>} New token info
 * @throws {Error} If refresh fails
 */
async function refreshDeviceToken(controllerUrl, refreshToken) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('Controller URL is required');
  }
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new Error('Refresh token is required');
  }

  // Call API refresh endpoint
  const tokenResponse = await apiRefreshDeviceToken(controllerUrl, refreshToken);

  const token = tokenResponse.access_token;
  const newRefreshToken = tokenResponse.refresh_token || refreshToken; // Use new refresh token if provided, otherwise keep old one
  const expiresIn = tokenResponse.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Save new token and refresh token to config
  await config.saveDeviceToken(controllerUrl, token, newRefreshToken, expiresAt);

  return {
    token,
    refreshToken: newRefreshToken,
    expiresAt
  };
}

/**
 * Get or refresh device token for controller
 * Checks if token exists and is valid, refreshes if expired using refresh token
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<{token: string, controller: string}|null>} Token and controller URL, or null if not available
 */
async function getOrRefreshDeviceToken(controllerUrl) {
  // Try to get existing token
  const tokenInfo = await getDeviceToken(controllerUrl);

  if (!tokenInfo) {
    return null;
  }

  // Check if token is expired
  if (!isTokenExpired(tokenInfo.expiresAt)) {
    // Token is valid
    return {
      token: tokenInfo.token,
      controller: tokenInfo.controller
    };
  }

  // Token is expired, try to refresh if refresh token exists
  if (!tokenInfo.refreshToken) {
    // No refresh token available
    return null;
  }

  try {
    const refreshed = await refreshDeviceToken(controllerUrl, tokenInfo.refreshToken);
    return {
      token: refreshed.token,
      controller: controllerUrl
    };
  } catch (error) {
    // Refresh failed, return null
    logger.warn(`Failed to refresh device token: ${error.message}`);
    return null;
  }
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
 * @returns {Promise<{type: 'bearer'|'credentials', token?: string, clientId?: string, clientSecret?: string, controller: string}>} Auth configuration
 * @throws {Error} If no authentication method is available
 */
async function getDeploymentAuth(controllerUrl, environment, appName) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('Controller URL is required');
  }
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment is required');
  }
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required');
  }

  // Priority 1: Try device token (for user-level audit)
  const deviceToken = await getOrRefreshDeviceToken(controllerUrl);
  if (deviceToken && deviceToken.token) {
    return {
      type: 'bearer',
      token: deviceToken.token,
      controller: deviceToken.controller
    };
  }

  // Priority 2: Try client token (application-level)
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

  // Priority 3: Use client credentials directly
  const credentials = await loadClientCredentials(appName);
  if (credentials && credentials.clientId && credentials.clientSecret) {
    return {
      type: 'credentials',
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      controller: controllerUrl
    };
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
  if (authConfig.type === 'credentials') {
    if (!authConfig.clientId || !authConfig.clientSecret) {
      throw new Error('Client ID and Client Secret are required');
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

    // Construct clientId from controller, environment, and application key
    // (not used, but shown in error message for reference)
    throw new Error(`Client ID and Client Secret are required. Add credentials to ~/.aifabrix/secrets.local.yaml as '${appKey}-client-idKeyVault' and '${appKey}-client-secretKeyVault', or use credentials authentication.`);
  }

  throw new Error('Invalid authentication type');
}

module.exports = {
  getDeviceToken,
  getClientToken,
  isTokenExpired,
  refreshClientToken,
  refreshDeviceToken,
  loadClientCredentials,
  getOrRefreshClientToken,
  getOrRefreshDeviceToken,
  getDeploymentAuth,
  extractClientCredentials
};

