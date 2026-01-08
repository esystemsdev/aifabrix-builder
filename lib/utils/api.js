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
 * @param {Object} params - Performance logging parameters
 * @param {string} params.url - API endpoint URL
 * @param {Object} params.options - Fetch options
 * @param {number} params.statusCode - HTTP status code
 * @param {number} params.duration - Request duration in milliseconds
 * @param {boolean} params.success - Whether the request was successful
 * @param {Object} [params.errorInfo] - Error information (if failed)
 */
async function logApiPerformance(params) {
  // Log all API calls (both success and failure) to audit log for troubleshooting
  // This helps track what API calls were made when errors occur
  try {
    await auditLogger.logApiCall({
      url: params.url,
      options: params.options,
      statusCode: params.statusCode,
      duration: params.duration,
      success: params.success,
      errorInfo: params.errorInfo || {}
    });
  } catch (logError) {
    // Don't fail the API call if audit logging fails
    // Silently continue - audit logging should never break functionality
  }
}

/**
 * Parses error response text into error data
 * @param {string} errorText - Error response text
 * @param {number} status - HTTP status code
 * @param {string} statusText - HTTP status text
 * @returns {Object|string} Parsed error data
 */
function parseErrorText(errorText, status, statusText) {
  try {
    return JSON.parse(errorText);
  } catch {
    return errorText || `HTTP ${status}: ${statusText}`;
  }
}

/**
 * Handles error response from API
 * @async
 * @function handleErrorResponse
 * @param {Object} response - Fetch response object
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {number} duration - Request duration
 * @returns {Promise<Object>} Error response object
 */
async function handleErrorResponse(response, url, options, duration) {
  const errorText = await response.text();
  const errorData = parseErrorText(errorText, response.status, response.statusText);
  const parsedError = parseErrorResponse(errorData, response.status, false);

  await logApiPerformance({
    url,
    options,
    statusCode: response.status,
    duration,
    success: false,
    errorInfo: {
      errorType: parsedError.type,
      errorMessage: parsedError.message,
      errorData: parsedError.data,
      correlationId: parsedError.data?.correlationId
    }
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

/**
 * Handles successful response from API
 * @async
 * @function handleSuccessResponse
 * @param {Object} response - Fetch response object
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {number} duration - Request duration
 * @returns {Promise<Object>} Success response object
 */
async function handleSuccessResponse(response, url, options, duration) {
  await logApiPerformance({
    url,
    options,
    statusCode: response.status,
    duration,
    success: true
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    return { success: true, data, status: response.status };
  }

  const text = await response.text();
  return { success: true, data: text, status: response.status };
}

/**
 * Handles network error from API call
 * @async
 * @function handleNetworkError
 * @param {Error} error - Network error
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {number} duration - Request duration
 * @returns {Promise<Object>} Error response object
 */
async function handleNetworkError(error, url, options, duration) {
  const parsedError = parseErrorResponse(error.message, 0, true);

  await logApiPerformance({
    url,
    options,
    statusCode: 0,
    duration,
    success: false,
    errorInfo: {
      errorType: parsedError.type,
      errorMessage: parsedError.message,
      network: true
    }
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
      return await handleErrorResponse(response, url, options, duration);
    }

    return await handleSuccessResponse(response, url, options, duration);
  } catch (error) {
    const duration = Date.now() - startTime;
    return await handleNetworkError(error, url, options, duration);
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
        const retryResponse = await makeApiCall(url, {
          ...options,
          headers
        });
        return retryResponse;
      }

      // Token refresh failed or no refresh token available
      // Return a more helpful error message
      if (!refreshedToken) {
        return {
          ...response,
          error: 'Authentication failed: Token expired and refresh failed. Please login again using: aifabrix login',
          formattedError: 'Authentication failed: Token expired and refresh failed. Please login again using: aifabrix login'
        };
      }
    } catch (refreshError) {
      // Refresh failed, return original 401 error with additional context
      const errorMessage = refreshError.message || String(refreshError);
      return {
        ...response,
        error: `Authentication failed: ${errorMessage}. Please login again using: aifabrix login`,
        formattedError: `Authentication failed: ${errorMessage}. Please login again using: aifabrix login`
      };
    }
  }

  return response;
}

const {
  initiateDeviceCodeFlow,
  pollDeviceCodeToken,
  displayDeviceCodeInfo,
  refreshDeviceToken
} = require('./device-code');

module.exports = {
  makeApiCall,
  authenticatedApiCall,
  initiateDeviceCodeFlow,
  pollDeviceCodeToken,
  displayDeviceCodeInfo,
  refreshDeviceToken
};

