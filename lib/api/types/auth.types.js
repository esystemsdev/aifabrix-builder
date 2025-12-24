/**
 * @fileoverview Authentication API type definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Authentication configuration
 * @typedef {Object} AuthConfig
 * @property {string} type - Authentication type ('bearer' | 'client-credentials' | 'client-token')
 * @property {string} [token] - Bearer token (for type='bearer' or type='client-token')
 * @property {string} [clientId] - Client ID (for type='client-credentials')
 * @property {string} [clientSecret] - Client secret (for type='client-credentials')
 */

/**
 * Standard API response wrapper
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Request success flag
 * @property {*} [data] - Response data
 * @property {string} [error] - Error message
 * @property {Object} [errorData] - Error data object
 * @property {string} [errorType] - Error type
 * @property {string} [formattedError] - Formatted error message
 * @property {number} [status] - HTTP status code
 * @property {string} [timestamp] - Response timestamp (ISO 8601)
 */

/**
 * Get token request (x-client-token generation)
 * @typedef {Object} GetTokenRequest
 * @property {string} clientId - Client ID (via x-client-id header)
 * @property {string} clientSecret - Client secret (via x-client-secret header)
 */

/**
 * Get token response (x-client-token generation)
 * @typedef {Object} GetTokenResponse
 * @property {boolean} success - Request success flag
 * @property {string} token - Generated x-client-token
 * @property {number} expiresIn - Token expiry time in seconds
 * @property {string} expiresAt - Token expiry timestamp (ISO 8601)
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Get client token response (frontend token)
 * @typedef {Object} GetClientTokenResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Token data
 * @property {string} data.token - Generated x-client-token
 * @property {number} data.expiresIn - Token expiry time in seconds
 * @property {string} data.expiresAt - Token expiry timestamp (ISO 8601)
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Get auth user response
 * @typedef {Object} GetAuthUserResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - User data
 * @property {Object} data.user - User information
 * @property {string} data.user.id - User ID
 * @property {string} data.user.username - Username
 * @property {string} data.user.email - Email address
 * @property {boolean} data.authenticated - Authentication status
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Get auth login request
 * @typedef {Object} GetAuthLoginRequest
 * @property {string} redirect - Redirect URI for OAuth2 callback
 * @property {string} [state] - State parameter for CSRF protection
 */

/**
 * Get auth login response
 * @typedef {Object} GetAuthLoginResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Login data
 * @property {string} data.loginUrl - Login URL for OAuth2 authorization flow
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Initiate device code flow request
 * @typedef {Object} InitiateDeviceCodeRequest
 * @property {string} [environment] - Environment key (query or body)
 * @property {string} [scope] - OAuth2 scope string (defaults to 'openid profile email')
 */

/**
 * Device code response
 * @typedef {Object} DeviceCodeResponse
 * @property {string} deviceCode - Device code for polling token endpoint
 * @property {string} userCode - User code to enter at verification URI
 * @property {string} verificationUri - URI for user to visit and enter user code
 * @property {string} [verificationUriComplete] - Complete URI with user code pre-filled
 * @property {number} expiresIn - Device code expiration time in seconds (typically 600)
 * @property {number} interval - Polling interval in seconds (typically 5)
 */

/**
 * Initiate device code flow response
 * @typedef {Object} InitiateDeviceCodeResponse
 * @property {boolean} success - Request success flag
 * @property {DeviceCodeResponse} data - Device code information
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Poll device code token request
 * @typedef {Object} PollDeviceCodeTokenRequest
 * @property {string} deviceCode - Device code from initiate device code flow
 */

/**
 * Device code token response
 * @typedef {Object} DeviceCodeTokenResponse
 * @property {string} accessToken - JWT access token from Keycloak
 * @property {string} [refreshToken] - Refresh token for obtaining new access tokens
 * @property {number} expiresIn - Access token expiration time in seconds
 */

/**
 * Poll device code token response
 * @typedef {Object} PollDeviceCodeTokenResponse
 * @property {boolean} success - Request success flag
 * @property {DeviceCodeTokenResponse} [data] - Token data (on success)
 * @property {string} [error] - Error code (on pending: 'authorization_pending' | 'slow_down')
 * @property {string} [errorDescription] - Error description
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Refresh device token request
 * @typedef {Object} RefreshDeviceTokenRequest
 * @property {string} refreshToken - Refresh token obtained from device code token flow
 */

/**
 * Refresh device token response
 * @typedef {Object} RefreshDeviceTokenResponse
 * @property {boolean} success - Request success flag
 * @property {DeviceCodeTokenResponse} data - New token data
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Refresh user token request
 * @typedef {Object} RefreshUserTokenRequest
 * @property {string} refreshToken - Refresh token obtained from OAuth callback flow
 */

/**
 * Refresh user token response
 * @typedef {Object} RefreshUserTokenResponse
 * @property {boolean} success - Request success flag
 * @property {DeviceCodeTokenResponse} data - New token data
 * @property {string} [message] - Response message
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Validate token request
 * @typedef {Object} ValidateTokenRequest
 * @property {string} token - JWT token to validate
 * @property {string} [environment] - Optional environment key (overrides x-client-token context)
 * @property {string} [application] - Optional application key (overrides x-client-token context)
 */

/**
 * Validate token response
 * @typedef {Object} ValidateTokenResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Validation data
 * @property {boolean} data.authenticated - Authentication status
 * @property {Object} [data.user] - User information
 * @property {string} [data.user.id] - User ID
 * @property {string} [data.user.username] - Username
 * @property {string} [data.user.email] - Email address
 * @property {string} [data.expiresAt] - Token expiration timestamp (ISO 8601)
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Get auth roles response
 * @typedef {Object} GetAuthRolesResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Roles data
 * @property {string[]} data.roles - Array of role names
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Get auth permissions response
 * @typedef {Object} GetAuthPermissionsResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Permissions data
 * @property {string[]} data.permissions - Array of permission names
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

/**
 * Get auth login diagnostics response
 * @typedef {Object} GetAuthLoginDiagnosticsResponse
 * @property {boolean} success - Request success flag
 * @property {Object} data - Diagnostic data
 * @property {Object} data.database - Database health status
 * @property {Object} data.controller - Controller status
 * @property {Object} data.environment - Environment status
 * @property {Object} data.keycloak - Keycloak configuration status
 * @property {string} timestamp - Response timestamp (ISO 8601)
 */

module.exports = {};

