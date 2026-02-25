/**
 * Device code flow parsing, error handling, and polling helpers.
 * Used by device-code.js; not part of the public API.
 *
 * @fileoverview Helpers for device code flow (RFC 8628)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Parses device code response from API
 * @param {Object} response - API response object
 * @returns {Object} Parsed device code response
 */
function parseDeviceCodeResponse(response) {
  const apiResponse = response.data;
  const responseData = apiResponse.data || apiResponse;
  const deviceCode = responseData.deviceCode;
  const userCode = responseData.userCode;
  const verificationUri = responseData.verificationUri;
  const expiresIn = responseData.expiresIn || 600;
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
 * Parses token response from API
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

  const accessToken = responseData.accessToken;
  const refreshToken = responseData.refreshToken;
  const expiresIn = responseData.expiresIn || 3600;

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
 * Checks if token has expired based on elapsed time
 * @param {number} startTime - Start time in milliseconds
 * @param {number} expiresIn - Expiration time in seconds
 */
function checkTokenExpiration(startTime, expiresIn) {
  const maxWaitTime = (expiresIn + 30) * 1000;
  if (Date.now() - startTime > maxWaitTime) {
    throw new Error('Device code expired: Maximum polling time exceeded');
  }
}

function attachFormattedError(validationError, response) {
  if (response && response.formattedError) {
    validationError.formattedError = response.formattedError;
    validationError.message = `Token polling failed:\n${response.formattedError}`;
  }
}

function buildDetailedErrorMessage(errorData) {
  const detail = errorData.detail || errorData.title || errorData.message || 'Validation error';
  let errorMsg = `Token polling failed: ${detail}`;
  if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
    errorMsg += '\n\nValidation errors:';
    errorData.errors.forEach(err => {
      const field = err.field || err.path || 'validation';
      const message = err.message || 'Invalid value';
      errorMsg += (field === 'validation' || field === 'unknown')
        ? `\n  • ${message}` : `\n  • ${field}: ${message}`;
    });
  }
  return errorMsg;
}

function attachErrorData(validationError, response) {
  if (response && response.errorData) {
    validationError.errorData = response.errorData;
    validationError.errorType = response.errorType || 'validation';
    if (!validationError.formattedError) {
      validationError.message = buildDetailedErrorMessage(response.errorData);
    }
  }
}

function createValidationError(response) {
  const validationError = new Error('Token polling failed: Validation error');
  attachFormattedError(validationError, response);
  attachErrorData(validationError, response);
  return validationError;
}

/**
 * Handles polling errors; throws for fatal errors, returns true to continue polling.
 * @param {string} error - Error code
 * @param {number} status - HTTP status code
 * @param {Object} response - Full API response object
 * @returns {boolean} True if should continue polling
 */
function handlePollingErrors(error, status, response) {
  if (error === 'authorization_pending' || status === 202) {
    return true;
  }
  if (error === 'authorization_declined') {
    throw new Error('Authorization declined: User denied the request');
  }
  if (error === 'expired_token' || status === 410) {
    throw new Error('Device code expired: Please restart the authentication process');
  }
  if (error === 'slow_down') {
    return true;
  }
  if (error === 'validation_error' || status === 400 ||
      error === 'INVALID_TOKEN' || error === 'INVALID_ACCESS_TOKEN') {
    throw createValidationError(response);
  }
  throw new Error(`Token polling failed: ${error}`);
}

async function waitForNextPoll(interval, slowDown) {
  const waitInterval = slowDown ? interval * 2 : interval;
  await new Promise(resolve => setTimeout(resolve, waitInterval * 1000));
}

function isValidationErrorCode(errorCode) {
  return errorCode === 'INVALID_TOKEN' || errorCode === 'INVALID_ACCESS_TOKEN';
}

function extractStructuredError(response) {
  if (response.errorType === 'validation') {
    return 'validation_error';
  }
  const errorData = response.errorData;
  const errorCode = errorData.error || errorData.code || response.error;
  if (isValidationErrorCode(errorCode)) {
    return 'validation_error';
  }
  return errorData.detail || errorData.title || errorData.message || errorCode || response.error || 'Unknown error';
}

function extractFallbackError(response) {
  const apiResponse = response.data || {};
  const errorData = typeof apiResponse === 'object' ? apiResponse : {};
  const errorCode = errorData.error || response.error || 'Unknown error';
  if (isValidationErrorCode(errorCode)) {
    return 'validation_error';
  }
  return errorCode;
}

function extractPollingError(response) {
  if (response.errorData) {
    return extractStructuredError(response);
  }
  return extractFallbackError(response);
}

function handleSuccessfulPoll(response) {
  const tokenResponse = parseTokenResponse(response);
  return tokenResponse || null;
}

/**
 * Processes polling response and determines next action.
 * @param {Object} response - API response object
 * @param {number} interval - Polling interval in seconds
 * @returns {Promise<Object|null>} Token response if complete, null if should continue
 */
async function processPollingResponse(response, interval) {
  if (response.success) {
    const apiResponse = response.data || {};
    const responseData = apiResponse.data || apiResponse;
    const errorCode = responseData.error || apiResponse.error || response.error;
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
    await waitForNextPoll(interval, error === 'slow_down');
    return null;
  }
  return null;
}

module.exports = {
  parseDeviceCodeResponse,
  parseTokenResponse,
  checkTokenExpiration,
  processPollingResponse
};
