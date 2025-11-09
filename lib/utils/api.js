/**
 * AI Fabrix Builder API Utilities
 *
 * Helper functions for making API calls to the controller
 * Supports both bearer token and ClientId/Secret authentication
 * Supports OAuth2 Device Code Flow (RFC 8628)
 *
 * @fileoverview API calling utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { parseErrorResponse } = require('./api-error-handler');
const auditLogger = require('../audit-logger');

/**
 * Logs API request performance metrics and errors to audit log
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {number} statusCode - HTTP status code
 * @param {number} duration - Request duration in milliseconds
 * @param {boolean} success - Whether the request was successful
 * @param {Object} errorInfo - Error information (if failed)
 */
async function logApiPerformance(url, options, statusCode, duration, success, errorInfo = {}) {
  // Log all API calls (both success and failure) to audit log for troubleshooting
  // This helps track what API calls were made when errors occur
  try {
    await auditLogger.logApiCall(url, options, statusCode, duration, success, errorInfo);
  } catch (logError) {
    // Don't fail the API call if audit logging fails
    // Silently continue - audit logging should never break functionality
  }
}

/**
 * Make an API call with proper error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response object with success flag
 */
async function makeApiCall(url, options = {}) {
  const startTime = Date.now();

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = errorText || `HTTP ${response.status}: ${response.statusText}`;
      }

      // Parse error using error handler
      const parsedError = parseErrorResponse(errorData, response.status, false);

      // Log error to audit log
      await logApiPerformance(url, options, response.status, duration, false, {
        errorType: parsedError.type,
        errorMessage: parsedError.message,
        errorData: parsedError.data,
        correlationId: parsedError.data?.correlationId
      });

      return {
        success: false,
        error: parsedError.message,
        errorData: parsedError.data,
        errorType: parsedError.type,
        formattedError: parsedError.formatted,
        status: response.status
      };
    }

    // Log successful API call to audit log
    await logApiPerformance(url, options, response.status, duration, true);

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return {
        success: true,
        data,
        status: response.status
      };
    }

    const text = await response.text();
    return {
      success: true,
      data: text,
      status: response.status
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    // Parse network error using error handler
    const parsedError = parseErrorResponse(error.message, 0, true);

    // Log network error to audit log
    await logApiPerformance(url, options, 0, duration, false, {
      errorType: parsedError.type,
      errorMessage: parsedError.message,
      network: true
    });

    return {
      success: false,
      error: parsedError.message,
      errorData: parsedError.data,
      errorType: parsedError.type,
      formattedError: parsedError.formatted,
      network: true
    };
  }
}

/**
 * Extract controller URL from API endpoint URL
 * @param {string} url - Full API endpoint URL
 * @returns {string} Controller base URL
 */
function extractControllerUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    // If URL parsing fails, try to extract manually
    const match = url.match(/^(https?:\/\/[^/]+)/);
    return match ? match[1] : url;
  }
}

/**
 * Make an authenticated API call with bearer token
 * Automatically refreshes device token on 401 errors if refresh token is available
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {string} token - Bearer token
 * @returns {Promise<Object>} Response object
 */
async function authenticatedApiCall(url, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await makeApiCall(url, {
    ...options,
    headers
  });

  // Handle 401 errors with automatic token refresh for device tokens
  if (!response.success && response.status === 401) {
    try {
      // Extract controller URL from request URL
      const controllerUrl = extractControllerUrl(url);

      // Try to get and refresh device token
      const { getOrRefreshDeviceToken } = require('./token-manager');
      const refreshedToken = await getOrRefreshDeviceToken(controllerUrl);

      if (refreshedToken && refreshedToken.token) {
        // Retry request with new token
        headers['Authorization'] = `Bearer ${refreshedToken.token}`;
        return makeApiCall(url, {
          ...options,
          headers
        });
      }
    } catch (refreshError) {
      // Refresh failed, return original 401 error
      // This allows the caller to handle the authentication error
    }
  }

  return response;
}

/**
 * Parses device code response from API
 * Matches OpenAPI DeviceCodeResponse schema (camelCase)
 * @function parseDeviceCodeResponse
 * @param {Object} response - API response object
 * @returns {Object} Parsed device code response
 * @throws {Error} If response is invalid
 */
function parseDeviceCodeResponse(response) {
  // OpenAPI spec: { success: boolean, data: DeviceCodeResponse, timestamp: string }
  const apiResponse = response.data;
  const responseData = apiResponse.data || apiResponse;

  // OpenAPI spec uses camelCase: deviceCode, userCode, verificationUri, expiresIn, interval
  const deviceCode = responseData.deviceCode;
  const userCode = responseData.userCode;
  const verificationUri = responseData.verificationUri;
  const expiresIn = responseData.expiresIn || 600;
  const interval = responseData.interval || 5;

  if (!deviceCode || !userCode || !verificationUri) {
    throw new Error('Invalid device code response: missing required fields');
  }

  // Return in snake_case for internal consistency (used by existing code)
  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    expires_in: expiresIn,
    interval: interval
  };
}

/**
 * Initiates OAuth2 Device Code Flow
 * Calls the device code endpoint to get device_code and user_code
 *
 * @async
 * @function initiateDeviceCodeFlow
 * @param {string} controllerUrl - Base URL of the controller
 * @param {string} environment - Environment key (e.g., 'miso', 'dev', 'tst', 'pro')
 * @returns {Promise<Object>} Device code response with device_code, user_code, verification_uri, expires_in, interval
 * @throws {Error} If initiation fails
 */
async function initiateDeviceCodeFlow(controllerUrl, environment) {
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment key is required');
  }

  const url = `${controllerUrl}/api/v1/auth/login?environment=${encodeURIComponent(environment)}`;
  const response = await makeApiCall(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.success) {
    throw new Error(`Device code initiation failed: ${response.error || 'Unknown error'}`);
  }

  return parseDeviceCodeResponse(response);
}

/**
 * Checks if token has expired based on elapsed time
 * @function checkTokenExpiration
 * @param {number} startTime - Start time in milliseconds
 * @param {number} expiresIn - Expiration time in seconds
 * @throws {Error} If token has expired
 */
function checkTokenExpiration(startTime, expiresIn) {
  const maxWaitTime = (expiresIn + 30) * 1000;
  if (Date.now() - startTime > maxWaitTime) {
    throw new Error('Device code expired: Maximum polling time exceeded');
  }
}

/**
 * Parses token response from API
 * Matches OpenAPI DeviceCodeTokenResponse schema (camelCase)
 * @function parseTokenResponse
 * @param {Object} response - API response object
 * @returns {Object|null} Parsed token response or null if pending
 */
function parseTokenResponse(response) {
  // OpenAPI spec: { success: boolean, data: DeviceCodeTokenResponse, timestamp: string }
  const apiResponse = response.data;
  const responseData = apiResponse.data || apiResponse;

  const error = responseData.error || apiResponse.error;
  if (error === 'authorization_pending' || error === 'slow_down') {
    return null;
  }

  // OpenAPI spec uses camelCase: accessToken, refreshToken, expiresIn
  const accessToken = responseData.accessToken;
  const refreshToken = responseData.refreshToken;
  const expiresIn = responseData.expiresIn || 3600;

  if (!accessToken) {
    throw new Error('Invalid token response: missing accessToken');
  }

  // Return in snake_case for internal consistency (used by existing code)
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn
  };
}

/**
 * Handles polling errors
 * @function handlePollingErrors
 * @param {string} error - Error code
 * @param {number} status - HTTP status code
 * @throws {Error} For fatal errors
 * @returns {boolean} True if should continue polling
 */
function handlePollingErrors(error, status) {
  if (error === 'authorization_pending' || status === 202) {
    return true;
  }

  // Check error field first, then status code
  if (error === 'authorization_declined') {
    throw new Error('Authorization declined: User denied the request');
  }

  if (error === 'expired_token' || status === 410) {
    throw new Error('Device code expired: Please restart the authentication process');
  }

  if (error === 'slow_down') {
    return true;
  }

  throw new Error(`Token polling failed: ${error}`);
}

/**
 * Waits for next polling interval
 * @async
 * @function waitForNextPoll
 * @param {number} interval - Polling interval in seconds
 * @param {boolean} slowDown - Whether to slow down
 */
async function waitForNextPoll(interval, slowDown) {
  const waitInterval = slowDown ? interval * 2 : interval;
  await new Promise(resolve => setTimeout(resolve, waitInterval * 1000));
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

    const response = await makeApiCall(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceCode: deviceCode
      })
    });

    if (response.success) {
      const tokenResponse = parseTokenResponse(response);
      if (tokenResponse) {
        return tokenResponse;
      }

      const apiResponse = response.data;
      const responseData = apiResponse.data || apiResponse;
      const error = responseData.error || apiResponse.error;
      const slowDown = error === 'slow_down';
      await waitForNextPoll(interval, slowDown);
      continue;
    }

    const apiResponse = response.data || {};
    const errorData = typeof apiResponse === 'object' ? apiResponse : {};
    const error = errorData.error || response.error || 'Unknown error';
    const shouldContinue = handlePollingErrors(error, response.status);

    if (shouldContinue) {
      const slowDown = error === 'slow_down';
      await waitForNextPoll(interval, slowDown);
      continue;
    }
  }
}

/**
 * Displays device code information to the user
 * Formats user code and verification URL for easy reading
 *
 * @function displayDeviceCodeInfo
 * @param {string} userCode - User code to display
 * @param {string} verificationUri - Verification URL
 * @param {Object} logger - Logger instance with log method
 * @param {Object} chalk - Chalk instance for colored output
 */
function displayDeviceCodeInfo(userCode, verificationUri, logger, chalk) {
  logger.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  logger.log(chalk.cyan('  Device Code Flow Authentication'));
  logger.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  logger.log(chalk.yellow('To complete authentication:'));
  logger.log(chalk.gray('  1. Visit: ') + chalk.blue.underline(verificationUri));
  logger.log(chalk.gray('  2. Enter code: ') + chalk.bold.cyan(userCode));
  logger.log(chalk.gray('  3. Approve the request\n'));
  logger.log(chalk.gray('Waiting for approval...'));
}

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
  const response = await makeApiCall(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.success) {
    const errorMsg = response.error || 'Unknown error';
    throw new Error(`Failed to refresh token: ${errorMsg}`);
  }

  // Parse response using existing parseTokenResponse function
  const tokenResponse = parseTokenResponse(response);
  if (!tokenResponse) {
    throw new Error('Invalid refresh token response');
  }

  return tokenResponse;
}

module.exports = {
  makeApiCall,
  authenticatedApiCall,
  initiateDeviceCodeFlow,
  pollDeviceCodeToken,
  displayDeviceCodeInfo,
  refreshDeviceToken
};

