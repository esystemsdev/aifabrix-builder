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

/**
 * Make an API call with proper error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response object with success flag
 */
async function makeApiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || 'Unknown error';
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
      }
      return {
        success: false,
        error: errorMessage,
        status: response.status
      };
    }

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
    return {
      success: false,
      error: error.message,
      network: true
    };
  }
}

/**
 * Make an authenticated API call with bearer token
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

  return makeApiCall(url, {
    ...options,
    headers
  });
}

/**
 * Parses device code response from API
 * @function parseDeviceCodeResponse
 * @param {Object} response - API response object
 * @returns {Object} Parsed device code response
 * @throws {Error} If response is invalid
 */
function parseDeviceCodeResponse(response) {
  const apiResponse = response.data;
  const responseData = apiResponse.data || apiResponse;

  const deviceCode = responseData.deviceCode || responseData.device_code;
  const userCode = responseData.userCode || responseData.user_code;
  const verificationUri = responseData.verificationUri || responseData.verification_uri;
  const expiresIn = responseData.expiresIn || responseData.expires_in || 600;
  const interval = responseData.interval || 5;

  if (!deviceCode || !userCode || !verificationUri) {
    throw new Error('Invalid device code response: missing required fields');
  }

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
 * @param {string} environment - Environment key (e.g., 'dev', 'tst', 'pro')
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
 * @function parseTokenResponse
 * @param {Object} response - API response object
 * @returns {Object|null} Parsed token response or null if pending
 */
function parseTokenResponse(response) {
  const apiResponse = response.data;
  const responseData = apiResponse.data || apiResponse;

  const error = responseData.error || apiResponse.error;
  if (error === 'authorization_pending' || error === 'slow_down') {
    return null;
  }

  const accessToken = responseData.accessToken || responseData.access_token;
  const refreshToken = responseData.refreshToken || responseData.refresh_token;
  const expiresIn = responseData.expiresIn || responseData.expires_in || 3600;

  if (!accessToken) {
    throw new Error('Invalid token response: missing accessToken');
  }

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

module.exports = {
  makeApiCall,
  authenticatedApiCall,
  initiateDeviceCodeFlow,
  pollDeviceCodeToken,
  displayDeviceCodeInfo
};

