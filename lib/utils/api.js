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
const auditLogger = require('../core/audit-logger');

/** Default timeout for HTTP requests (ms). Prevents hanging when the controller is unreachable. */
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

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
    const logData = {
      url: params.url,
      options: params.options,
      statusCode: params.statusCode,
      duration: params.duration,
      success: params.success
    };
    // Only include errorInfo if there's actual error information
    if (params.errorInfo) {
      logData.errorInfo = params.errorInfo;
    }
    await auditLogger.logApiCall(logData);
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
 * Validates that a URL is not empty or missing
 * @function validateUrl
 * @param {string} url - URL to validate
 * @param {string} [urlType='URL'] - Type of URL for error message (e.g., 'Dataplane URL', 'Controller URL')
 * @returns {void}
 * @throws {Error} If URL is empty, null, undefined, whitespace-only, or malformed
 */
function validateUrl(url, urlType = 'URL') {
  if (!url || typeof url !== 'string') {
    throw new Error(`${urlType} is required and must be a string (received: ${JSON.stringify(url)})`);
  }
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new Error(`${urlType} cannot be empty. Please provide a valid URL.`);
  }
  // Check for common invalid URL patterns
  if (trimmedUrl === 'undefined' || trimmedUrl === 'null' || trimmedUrl === 'NaN') {
    throw new Error(`${urlType} is invalid: "${trimmedUrl}". Please provide a valid URL.`);
  }
  // Basic URL format validation - must start with http:// or https://
  if (!trimmedUrl.match(/^https?:\/\//i)) {
    throw new Error(`${urlType} must be a valid HTTP/HTTPS URL (received: "${trimmedUrl}")`);
  }
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
  // Enhance error message with URL information if URL is missing or invalid
  let errorMessage = error.message;
  if (errorMessage && (errorMessage.includes('cannot be empty') || errorMessage.includes('is required'))) {
    // Add URL context to validation errors
    if (!url || !url.trim()) {
      errorMessage = `${errorMessage} (URL was: ${JSON.stringify(url)})`;
    } else {
      errorMessage = `${errorMessage} (URL was: ${url})`;
    }
  } else if (!url || !url.trim()) {
    // If URL is empty but error doesn't mention it, add context
    errorMessage = `Invalid or missing URL. ${errorMessage} (URL was: ${JSON.stringify(url)})`;
  }

  const parsedError = parseErrorResponse(errorMessage, 0, true);

  // Extract controller URL from full URL for error data
  let controllerUrl = null;
  const endpointUrl = url;
  if (url && typeof url === 'string' && url.trim()) {
    try {
      const urlObj = new URL(url);
      controllerUrl = `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      // If URL parsing fails, use the full URL as endpoint
      controllerUrl = null;
    }
  }

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

  // Include both controller URL and full endpoint URL in error data
  const errorData = {
    ...parsedError.data,
    controllerUrl: controllerUrl,
    endpointUrl: endpointUrl
  };

  return {
    success: false,
    error: parsedError.message,
    errorData: errorData,
    errorType: parsedError.type,
    formattedError: parsedError.formatted,
    network: true
  };
}

/**
 * Make an API call with proper error handling
 * Uses a 15s timeout to avoid hanging when the controller is unreachable.
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options (signal, method, headers, body, etc.)
 * @returns {Promise<Object>} Response object with success flag
 */
async function makeApiCall(url, options = {}) {
  // Validate URL before attempting request
  try {
    validateUrl(url, 'API endpoint URL');
  } catch (error) {
    const duration = 0;
    return await handleNetworkError(error, url || '', options, duration);
  }

  const startTime = Date.now();
  const fetchOptions = { ...options };
  if (!fetchOptions.signal) {
    fetchOptions.signal = AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      return await handleErrorResponse(response, url, options, duration);
    }

    return await handleSuccessResponse(response, url, options, duration);
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err?.name === 'AbortError'
      ? new Error(
        `Request timed out after ${DEFAULT_REQUEST_TIMEOUT_MS / 1000} seconds. The controller may be unreachable. Check the URL and network.`
      )
      : err;
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
 * @param {string|Object} tokenOrAuthConfig - Bearer token string or authConfig object
 * @param {string} [tokenOrAuthConfig.token] - Bearer token (if object)
 * @param {string} [tokenOrAuthConfig.controller] - Controller URL for token refresh (if object)
 * @returns {Promise<Object>} Response object
 */
// eslint-disable-next-line max-statements
async function authenticatedApiCall(url, options = {}, tokenOrAuthConfig) {
  const isStringToken = typeof tokenOrAuthConfig === 'string';
  const token = isStringToken ? tokenOrAuthConfig : tokenOrAuthConfig?.token;
  const authControllerUrl = isStringToken ? null : tokenOrAuthConfig?.controller;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await makeApiCall(url, {
    ...options,
    headers
  });

  if (!response.success && response.status === 401) {
    try {
      const { forceRefreshDeviceToken } = require('./token-manager');
      const refreshedToken = await forceRefreshDeviceToken(authControllerUrl || extractControllerUrl(url));
      if (refreshedToken?.token) {
        headers['Authorization'] = `Bearer ${refreshedToken.token}`;
        return await makeApiCall(url, { ...options, headers });
      }
      const authError = 'Authentication failed: Token expired and refresh failed. Please login again using: aifabrix login';
      return { ...response, error: authError, formattedError: authError };
    } catch (refreshError) {
      const authError = `Authentication failed: ${refreshError.message || String(refreshError)}. Please login again using: aifabrix login`;
      return { ...response, error: authError, formattedError: authError };
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

