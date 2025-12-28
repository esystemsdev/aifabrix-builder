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
 * @param {string} [scope] - OAuth2 scope string (default: 'openid profile email')
 * @returns {Promise<Object>} Device code response with device_code, user_code, verification_uri, expires_in, interval
 * @throws {Error} If initiation fails
 */
async function initiateDeviceCodeFlow(controllerUrl, environment, scope) {
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment key is required');
  }

  // Default scope for backward compatibility
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
 * Creates a validation error with detailed information
 * @function createValidationError
 * @param {Object} response - Full API response object
 * @returns {Error} Validation error with formattedError and errorData attached
 */
function createValidationError(response) {
  const validationError = new Error('Token polling failed: Validation error');

  // Attach formatted error if available (includes detailed validation info with ANSI colors)
  if (response && response.formattedError) {
    validationError.formattedError = response.formattedError;
    validationError.message = `Token polling failed:\n${response.formattedError}`;
  }

  // Attach error data for programmatic access
  if (response && response.errorData) {
    validationError.errorData = response.errorData;
    validationError.errorType = response.errorType || 'validation';

    // Build detailed message if formattedError not available
    if (!validationError.formattedError) {
      const errorData = response.errorData;
      const detail = errorData.detail || errorData.title || errorData.message || 'Validation error';
      let errorMsg = `Token polling failed: ${detail}`;
      // Add validation errors if available
      if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        errorMsg += '\n\nValidation errors:';
        errorData.errors.forEach(err => {
          const field = err.field || err.path || 'validation';
          const message = err.message || 'Invalid value';
          if (field === 'validation' || field === 'unknown') {
            errorMsg += `\n  • ${message}`;
          } else {
            errorMsg += `\n  • ${field}: ${message}`;
          }
        });
      }
      validationError.message = errorMsg;
    }
  }

  return validationError;
}

/**
 * Handles polling errors
 * @function handlePollingErrors
 * @param {string} error - Error code
 * @param {number} status - HTTP status code
 * @param {Object} response - Full API response object (for accessing formattedError and errorData)
 * @throws {Error} For fatal errors
 * @returns {boolean} True if should continue polling
 */
function handlePollingErrors(error, status, response) {
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

  // Handle validation errors with detailed message
  // Check for validation_error, status 400, or specific validation error codes
  if (error === 'validation_error' || status === 400 || 
      error === 'INVALID_TOKEN' || error === 'INVALID_ACCESS_TOKEN') {
    throw createValidationError(response);
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
 * Extracts error from API response
 * @param {Object} response - API response object
 * @returns {string} Error code or 'Unknown error'
 */
function extractPollingError(response) {
  // Check for structured error data first (from api-error-handler)
  if (response.errorData) {
    const errorData = response.errorData;
    // For validation errors, return the error type so we can handle it specially
    if (response.errorType === 'validation') {
      return 'validation_error';
    }
    // Check if error code indicates validation error (e.g., INVALID_TOKEN)
    const errorCode = errorData.error || errorData.code || response.error;
    if (errorCode === 'INVALID_TOKEN' || errorCode === 'INVALID_ACCESS_TOKEN') {
      return 'validation_error';
    }
    // Return the error message from structured error
    return errorData.detail || errorData.title || errorData.message || errorCode || response.error || 'Unknown error';
  }

  // Fallback to original extraction logic
  const apiResponse = response.data || {};
  const errorData = typeof apiResponse === 'object' ? apiResponse : {};
  const errorCode = errorData.error || response.error || 'Unknown error';
  
  // Check if error code indicates validation error (e.g., INVALID_TOKEN)
  if (errorCode === 'INVALID_TOKEN' || errorCode === 'INVALID_ACCESS_TOKEN') {
    return 'validation_error';
  }
  
  return errorCode;
}

/**
 * Handles successful polling response
 * @param {Object} response - API response object
 * @returns {Object|null} Token response or null if pending
 */
function handleSuccessfulPoll(response) {
  const tokenResponse = parseTokenResponse(response);
  if (tokenResponse) {
    return tokenResponse;
  }
  return null;
}

/**
 * Processes polling response and determines next action
 * @async
 * @function processPollingResponse
 * @param {Object} response - API response object
 * @param {number} interval - Polling interval in seconds
 * @returns {Promise<Object|null>} Token response if complete, null if should continue
 */
async function processPollingResponse(response, interval) {
  if (response.success) {
    // Check if response contains an error code even though success is true
    const apiResponse = response.data || {};
    const responseData = apiResponse.data || apiResponse;
    const errorCode = responseData.error || apiResponse.error || response.error;
    
    // If there's an error code like INVALID_TOKEN, treat it as a validation error
    if (errorCode && (errorCode === 'INVALID_TOKEN' || errorCode === 'INVALID_ACCESS_TOKEN')) {
      throw createValidationError(response);
    }
    
    const tokenResponse = handleSuccessfulPoll(response);
    if (tokenResponse) {
      return tokenResponse;
    }

    const error = errorCode;
    const slowDown = error === 'slow_down';
    await waitForNextPoll(interval, slowDown);
    return null;
  }

  const error = extractPollingError(response);
  const shouldContinue = handlePollingErrors(error, response.status, response);

  if (shouldContinue) {
    const slowDown = error === 'slow_down';
    await waitForNextPoll(interval, slowDown);
    return null;
  }

  return null;
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
  const response = await getMakeApiCall()(url, {
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
  initiateDeviceCodeFlow,
  pollDeviceCodeToken,
  displayDeviceCodeInfo,
  refreshDeviceToken,
  parseTokenResponse
};

