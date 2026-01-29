/**
 * Token Manager Refresh Utilities
 *
 * Token refresh functions for device and client tokens
 *
 * @fileoverview Token refresh utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const config = require('../core/config');
const { refreshDeviceToken: apiRefreshDeviceToken } = require('./api');
const { isTokenEncrypted } = require('./token-encryption');

/**
 * Validates refresh token parameters
 * @function validateRefreshTokenParams
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @throws {Error} If validation fails
 */
function validateRefreshTokenParams(environment, appName, controllerUrl) {
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment is required and must be a string');
  }
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('Controller URL is required and must be a string');
  }
}

/**
 * Loads client credentials from parameters or secrets file
 * @async
 * @function loadClientCredentialsForRefresh
 * @param {string} appName - Application name
 * @param {string} [clientId] - Optional client ID
 * @param {string} [clientSecret] - Optional client secret
 * @returns {Promise<Object>} Credentials object with clientId and clientSecret
 * @throws {Error} If credentials cannot be loaded
 */
async function loadClientCredentialsForRefresh(appName, clientId, clientSecret) {
  const { loadClientCredentials } = require('./token-manager');
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  const credentials = await loadClientCredentials(appName);
  if (!credentials) {
    throw new Error(`Client credentials not found for app '${appName}'. Add them to ~/.aifabrix/secrets.local.yaml as '${appName}-client-idKeyVault' and '${appName}-client-secretKeyVault'`);
  }
  return credentials;
}

/**
 * Calls token API to get new token
 * @async
 * @function callTokenApi
 * @param {string} controllerUrl - Controller URL
 * @param {Object} credentials - Credentials object
 * @returns {Promise<Object>} API response
 * @throws {Error} If API call fails
 */
async function callTokenApi(controllerUrl, credentials) {
  const { makeApiCall: _makeApiCall } = require('./api');
  const response = await _makeApiCall(`${controllerUrl}/api/v1/auth/token`, {
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

  return responseData;
}

/**
 * Calculates token expiration timestamp
 * @function calculateTokenExpiration
 * @param {Object} responseData - API response data
 * @returns {string} ISO timestamp of expiration
 */
function calculateTokenExpiration(responseData) {
  const expiresIn = responseData.expiresIn || 86400;
  return responseData.expiresAt || new Date(Date.now() + expiresIn * 1000).toISOString();
}

/**
 * Refresh client token using credentials
 * @async
 * @function refreshClientToken
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @param {string} [clientId] - Optional client ID override
 * @param {string} [clientSecret] - Optional client secret override
 * @returns {Promise<{token: string, expiresAt: string}>} New token info
 * @throws {Error} If credentials are missing or token refresh fails
 */
async function refreshClientToken(environment, appName, controllerUrl, clientId, clientSecret) {
  validateRefreshTokenParams(environment, appName, controllerUrl);

  const credentials = await loadClientCredentialsForRefresh(appName, clientId, clientSecret);
  const responseData = await callTokenApi(controllerUrl, credentials);

  const token = responseData.token;
  const expiresAt = calculateTokenExpiration(responseData);

  // Save token to config.yaml (NEVER save credentials)
  await config.saveClientToken(environment, appName, controllerUrl, token, expiresAt);

  return { token, expiresAt };
}

/**
 * Refresh device token using refresh token
 * Calls API refresh endpoint and saves new token to config
 * @param {string} controllerUrl - Controller URL
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{token: string, refreshToken: string, expiresAt: string}>} New token info
 * @throws {Error} If refresh fails or refresh token is expired/invalid
 */
async function refreshDeviceToken(controllerUrl, refreshToken) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('Controller URL is required');
  }
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new Error('Refresh token is required');
  }
  // Never send encrypted token to the API (causes 401). Decryption should happen in getDeviceToken; this is a safeguard.
  if (isTokenEncrypted(refreshToken)) {
    throw new Error('Refresh token is still encrypted; decryption may have failed. Run "aifabrix login" to authenticate again.');
  }

  try {
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
  } catch (error) {
    // Check if error indicates refresh token expiry (case-insensitive)
    const errorMessage = (error.message || String(error)).toLowerCase();
    if (errorMessage.includes('expired') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('401') ||
        errorMessage.includes('unauthorized')) {
      throw new Error('Refresh token has expired. Please login again using: aifabrix login');
    }
    // Re-throw other errors as-is
    throw error;
  }
}

module.exports = {
  refreshClientToken,
  refreshDeviceToken,
  validateRefreshTokenParams,
  loadClientCredentialsForRefresh,
  callTokenApi,
  calculateTokenExpiration
};

