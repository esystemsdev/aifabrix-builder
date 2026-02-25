/**
 * AI Fabrix Builder Device Code Flow Utilities
 *
 * Handles OAuth2 Device Code Flow (RFC 8628) authentication
 * Supports device code initiation, token polling, and token refresh
 *
 * @fileoverview Device code flow utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  parseDeviceCodeResponse,
  parseTokenResponse,
  checkTokenExpiration,
  processPollingResponse
} = require('./device-code-helpers');

// Lazy require to avoid circular dependency
let makeApiCall;
function getMakeApiCall() {
  if (!makeApiCall) {
    const api = require('./api');
    makeApiCall = api.makeApiCall;
  }
  return makeApiCall;
}

/**
 * Initiates OAuth2 Device Code Flow
 * Calls the device code endpoint to get device_code and user_code
 *
 * @async
 * @function initiateDeviceCodeFlow
 * @param {string} controllerUrl - Base URL of the controller
 * @param {string} environment - Environment key (e.g., 'miso', 'dev', 'tst', 'pro')
 * @param {string} [scope] - OAuth2 scope string (default: 'openid profile email')
 * @returns {Promise<Object>} Device code response with device_code, user_code, verification_uri, expires_in, interval
 * @throws {Error} If initiation fails
 */
async function initiateDeviceCodeFlow(controllerUrl, environment, scope) {
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment key is required');
  }

  const defaultScope = 'openid profile email';
  const requestScope = scope || defaultScope;

  const url = `${controllerUrl}/api/v1/auth/login?environment=${encodeURIComponent(environment)}`;
  const response = await getMakeApiCall()(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      scope: requestScope
    })
  });

  if (!response.success) {
    throw new Error(`Device code initiation failed: ${response.error || 'Unknown error'}`);
  }

  return parseDeviceCodeResponse(response);
}

/**
 * Polls for token during Device Code Flow
 * Continuously polls the token endpoint until user approves or flow expires
 *
 * @async
 * @function pollDeviceCodeToken
 * @param {string} controllerUrl - Base URL of the controller
 * @param {string} deviceCode - Device code from initiation
 * @param {number} interval - Polling interval in seconds
 * @param {number} expiresIn - Expiration time in seconds
 * @param {Function} [onPoll] - Optional callback called on each poll attempt
 * @returns {Promise<Object>} Token response with access_token, refresh_token, expires_in
 * @throws {Error} If polling fails or token is expired/declined
 */
async function pollDeviceCodeToken(controllerUrl, deviceCode, interval, expiresIn, onPoll) {
  if (!deviceCode || typeof deviceCode !== 'string') {
    throw new Error('Device code is required');
  }

  const url = `${controllerUrl}/api/v1/auth/login/device/token`;
  const startTime = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    checkTokenExpiration(startTime, expiresIn);

    if (onPoll) {
      onPoll();
    }

    const response = await getMakeApiCall()(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceCode: deviceCode
      })
    });

    const tokenResponse = await processPollingResponse(response, interval);
    if (tokenResponse) {
      return tokenResponse;
    }
  }
}

/**
 * Builds verification URL with user_code query parameter so the device page can pre-fill the code.
 *
 * @function buildVerificationUrlWithUserCode
 * @param {string} verificationUri - Base verification URL (e.g. http://localhost:8182/realms/aifabrix/device)
 * @param {string} userCode - User code to append as user_code query param
 * @returns {string} Full URL with ?user_code=<code> or &user_code=<code>
 */
function buildVerificationUrlWithUserCode(verificationUri, userCode) {
  if (!verificationUri || !userCode) {
    return verificationUri || '';
  }
  const separator = verificationUri.includes('?') ? '&' : '?';
  return `${verificationUri}${separator}user_code=${encodeURIComponent(userCode)}`;
}

/**
 * Displays device code information to the user
 * Formats user code and verification URL for easy reading. Uses a URL with user_code in the query
 * so the device page can pre-fill the code and the user does not need to type it.
 *
 * @function displayDeviceCodeInfo
 * @param {string} userCode - User code to display
 * @param {string} verificationUri - Verification URL (base, without user_code)
 * @param {Object} logger - Logger instance with log method
 * @param {Object} chalk - Chalk instance for colored output
 */
function displayDeviceCodeInfo(userCode, verificationUri, logger, chalk) {
  const visitUrl = buildVerificationUrlWithUserCode(verificationUri, userCode);
  logger.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  logger.log(chalk.cyan('  Device Code Flow Authentication'));
  logger.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  logger.log(chalk.yellow('To complete authentication:'));
  logger.log(chalk.gray('  1. Visit (code is in the URL): ') + chalk.blue.underline(visitUrl));
  logger.log(chalk.gray('  2. Approve the request\n'));
  logger.log(chalk.gray('Waiting for approval...'));
}

/** Timeout for token refresh request (ms). Longer than default to allow for slow controller/Keycloak. */
const REFRESH_TOKEN_TIMEOUT_MS = 60000;

/**
 * Refresh device code access token using refresh token
 * Uses OpenAPI /api/v1/auth/login/device/refresh endpoint
 *
 * @async
 * @function refreshDeviceToken
 * @param {string} controllerUrl - Base URL of the controller
 * @param {string} refreshToken - Refresh token from previous authentication
 * @returns {Promise<Object>} Token response with access_token, refresh_token, expires_in
 * @throws {Error} If refresh fails or refresh token is invalid/expired
 */
async function refreshDeviceToken(controllerUrl, refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new Error('Refresh token is required');
  }

  const url = `${controllerUrl}/api/v1/auth/login/device/refresh`;
  const response = await getMakeApiCall()(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: refreshToken, refreshToken }),
    signal: AbortSignal.timeout(REFRESH_TOKEN_TIMEOUT_MS)
  });

  if (!response.success) {
    const errorMsg = response.error || 'Unknown error';
    throw new Error(`Failed to refresh token: ${errorMsg}`);
  }

  const tokenResponse = parseTokenResponse(response);
  if (!tokenResponse) {
    throw new Error('Invalid refresh token response');
  }

  return tokenResponse;
}

module.exports = {
  initiateDeviceCodeFlow,
  pollDeviceCodeToken,
  displayDeviceCodeInfo,
  refreshDeviceToken,
  parseTokenResponse,
  buildVerificationUrlWithUserCode
};
