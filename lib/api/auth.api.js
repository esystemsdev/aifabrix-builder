/**
 * @fileoverview Authentication API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * Get authentication token using client credentials
 * POST /api/v1/auth/token
 * @requiresPermission {Controller} Client credentials (no scope in spec)
 * @async
 * @function getToken
 * @param {string} clientId - Client ID
 * @param {string} clientSecret - Client secret
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<Object>} Token response with access token
 * @throws {Error} If authentication fails
 */
async function getToken(clientId, clientSecret, controllerUrl) {
  const client = new ApiClient(controllerUrl, {
    type: 'client-credentials',
    clientId,
    clientSecret
  });

  return await client.post('/api/v1/auth/token');
}

/**
 * Get client token for frontend application
 * GET/POST /api/v1/auth/client-token
 * @requiresPermission {Controller} Client credentials or unauthenticated
 * @async
 * @function getClientToken
 * @param {string} controllerUrl - Controller base URL
 * @param {string} [method] - HTTP method ('GET' or 'POST', default: 'POST')
 * @returns {Promise<Object>} Client token response
 * @throws {Error} If token generation fails
 */
async function getClientToken(controllerUrl, method = 'POST') {
  const client = new ApiClient(controllerUrl);

  if (method === 'GET') {
    return await client.get('/api/v1/auth/client-token');
  }

  return await client.post('/api/v1/auth/client-token');
}

/**
 * Get current user information
 * GET /api/v1/auth/user
 * @requiresPermission {Controller} auth:read
 * @async
 * @function getAuthUser
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} User information response
 * @throws {Error} If request fails
 */
async function getAuthUser(controllerUrl, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get('/api/v1/auth/user');
}

/**
 * Get login URL for OAuth2 authorization flow
 * GET /api/v1/auth/login
 * @requiresPermission {Controller} Client credentials
 * @async
 * @function getAuthLogin
 * @param {string} controllerUrl - Controller base URL
 * @param {string} redirect - Redirect URI for OAuth2 callback
 * @param {string} [state] - State parameter for CSRF protection
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Login URL response
 * @throws {Error} If request fails
 */
async function getAuthLogin(controllerUrl, redirect, state, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get('/api/v1/auth/login', {
    params: { redirect, state }
  });
}

/**
 * Initiate OAuth2 Device Code Flow
 * POST /api/v1/auth/login
 * @requiresPermission {Controller} Public (no auth required for device code initiation)
 * @async
 * @function initiateDeviceCodeFlow
 * @param {string} controllerUrl - Controller base URL
 * @param {string} [environment] - Environment key
 * @param {string} [scope] - OAuth2 scope string (defaults to 'openid profile email')
 * @returns {Promise<Object>} Device code response
 * @throws {Error} If device code flow initiation fails
 */
async function initiateDeviceCodeFlow(controllerUrl, environment, scope) {
  const client = new ApiClient(controllerUrl);
  const body = {};
  const params = {};

  // Environment goes in query params (per OpenAPI spec)
  if (environment) {
    params.environment = environment;
  }

  // Scope goes in request body
  if (scope) {
    body.scope = scope;
  }

  // Build request options
  const requestOptions = {};
  if (Object.keys(params).length > 0) {
    requestOptions.params = params;
  }
  if (Object.keys(body).length > 0) {
    requestOptions.body = body;
  }

  return await client.post('/api/v1/auth/login', requestOptions);
}

/**
 * Poll for device code token
 * POST /api/v1/auth/login/device/token
 * @requiresPermission {Controller} Public
 * @async
 * @function pollDeviceCodeToken
 * @param {string} deviceCode - Device code from initiate device code flow
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<Object>} Token response (may return 202 with authorization_pending)
 * @throws {Error} If polling fails
 */
async function pollDeviceCodeToken(deviceCode, controllerUrl) {
  const client = new ApiClient(controllerUrl);
  return await client.post('/api/v1/auth/login/device/token', {
    body: { deviceCode }
  });
}

/**
 * Refresh device code access token
 * POST /api/v1/auth/login/device/refresh
 * @requiresPermission {Controller} Bearer token (refresh token)
 * @async
 * @function refreshDeviceToken
 * @param {string} refreshToken - Refresh token obtained from device code token flow
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<Object>} New token response
 * @throws {Error} If token refresh fails
 */
async function refreshDeviceToken(refreshToken, controllerUrl) {
  const client = new ApiClient(controllerUrl);
  return await client.post('/api/v1/auth/login/device/refresh', {
    body: { refreshToken }
  });
}

/**
 * Refresh user access token
 * POST /api/v1/auth/refresh
 * @requiresPermission {Controller} Bearer token (refresh token)
 * @async
 * @function refreshUserToken
 * @param {string} refreshToken - Refresh token obtained from OAuth callback flow
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<Object>} New token response
 * @throws {Error} If token refresh fails
 */
async function refreshUserToken(refreshToken, controllerUrl) {
  const client = new ApiClient(controllerUrl);
  return await client.post('/api/v1/auth/refresh', {
    body: { refreshToken }
  });
}

/**
 * Validate authentication token
 * POST /api/v1/auth/validate
 * @requiresPermission {Controller} auth:read or client credentials
 * @async
 * @function validateToken
 * @param {string} token - JWT token to validate
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} [environment] - Optional environment key
 * @param {string} [application] - Optional application key
 * @returns {Promise<Object>} Token validation response
 * @throws {Error} If validation fails
 */
async function validateToken(token, controllerUrl, authConfig, environment, application) {
  const client = new ApiClient(controllerUrl, authConfig);
  const body = { token };

  if (environment) {
    body.environment = environment;
  }
  if (application) {
    body.application = application;
  }

  return await client.post('/api/v1/auth/validate', {
    body
  });
}

/**
 * Get user roles
 * GET /api/v1/auth/roles
 * @requiresPermission {Controller} auth:read
 * @async
 * @function getAuthRoles
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} [environment] - Optional environment key filter
 * @param {string} [application] - Optional application key filter
 * @returns {Promise<Object>} User roles response
 * @throws {Error} If request fails
 */
async function getAuthRoles(controllerUrl, authConfig, environment, application) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get('/api/v1/auth/roles', {
    params: { environment, application }
  });
}

/**
 * Refresh user roles
 * GET /api/v1/auth/roles/refresh
 * @requiresPermission {Controller} auth:read
 * @async
 * @function refreshAuthRoles
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Refreshed roles response
 * @throws {Error} If request fails
 */
async function refreshAuthRoles(controllerUrl, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get('/api/v1/auth/roles/refresh');
}

/**
 * Get user permissions
 * GET /api/v1/auth/permissions
 * @requiresPermission {Controller} auth:read
 * @async
 * @function getAuthPermissions
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} [environment] - Optional environment key filter
 * @param {string} [application] - Optional application key filter
 * @returns {Promise<Object>} User permissions response
 * @throws {Error} If request fails
 */
async function getAuthPermissions(controllerUrl, authConfig, environment, application) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get('/api/v1/auth/permissions', {
    params: { environment, application }
  });
}

/**
 * Refresh user permissions
 * GET /api/v1/auth/permissions/refresh
 * @requiresPermission {Controller} auth:read
 * @async
 * @function refreshAuthPermissions
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Refreshed permissions response
 * @throws {Error} If request fails
 */
async function refreshAuthPermissions(controllerUrl, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get('/api/v1/auth/permissions/refresh');
}

/**
 * Get device code login diagnostics
 * GET /api/v1/auth/login/diagnostics
 * @requiresPermission {Controller} Public
 * @async
 * @function getAuthLoginDiagnostics
 * @param {string} controllerUrl - Controller base URL
 * @param {string} [environment] - Optional environment key
 * @returns {Promise<Object>} Diagnostic information response
 * @throws {Error} If request fails
 */
async function getAuthLoginDiagnostics(controllerUrl, environment) {
  const client = new ApiClient(controllerUrl);
  return await client.get('/api/v1/auth/login/diagnostics', {
    params: { environment }
  });
}

module.exports = {
  getToken,
  getClientToken,
  getAuthUser,
  getAuthLogin,
  initiateDeviceCodeFlow,
  pollDeviceCodeToken,
  refreshDeviceToken,
  refreshUserToken,
  validateToken,
  getAuthRoles,
  refreshAuthRoles,
  getAuthPermissions,
  refreshAuthPermissions,
  getAuthLoginDiagnostics
};

