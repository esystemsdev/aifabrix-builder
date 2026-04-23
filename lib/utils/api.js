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

/** Default timeout for HTTP requests (ms). Prevents hanging when the controller is unreachable. 30s allows Azure Web App cold start to complete. */
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

/** Cap for optional per-request ``timeoutMs`` (validation run E2E can block on one POST). */
const MAX_SINGLE_REQUEST_TIMEOUT_MS = 45 * 60 * 1000;

/**
 * Resolve per-request AbortSignal timeout from fetch options.
 * @param {Object} options - Same object passed to fetch (may include timeoutMs / requestTimeoutMs)
 * @returns {number}
 */
function resolveSingleRequestTimeoutMs(options) {
  const raw = options?.requestTimeoutMs ?? options?.timeoutMs;
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }
  return Math.min(n, MAX_SINGLE_REQUEST_TIMEOUT_MS);
}

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

  // 204 No Content or empty body: nothing to parse (avoids "Unexpected end of JSON input")
  if (response.status === 204) {
    return { success: true, data: null, status: response.status };
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const data = await response.json();
      return { success: true, data, status: response.status };
    } catch (e) {
      if (e instanceof SyntaxError && e.message && e.message.includes('JSON')) {
        return { success: true, data: null, status: response.status };
      }
      throw e;
    }
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
 * Flattens Error.message and nested error.cause (Node fetch/undici wraps TLS errors under cause).
 * @param {Error} error - Network error
 * @returns {string} Combined detail for parsing and SSL detection
 */
function flattenNetworkErrorDetail(error) {
  if (!error) return '';
  const parts = [];
  let e = error;
  let depth = 0;
  const maxDepth = 12;
  while (e && depth < maxDepth) {
    if (typeof e === 'string') {
      parts.push(e);
      break;
    }
    if (e.message) parts.push(e.message);
    if (e.code !== undefined && e.code !== null && String(e.code) !== e.message) {
      parts.push(String(e.code));
    }
    e = e.cause;
    depth++;
  }
  return parts.filter(Boolean).join(' ');
}

/**
 * Adds URL context to validation / empty-URL network errors.
 * @param {string} errorMessage - Base message
 * @param {string} url - Request URL
 * @returns {string}
 */
function withUrlContextForNetworkError(errorMessage, url) {
  if (errorMessage && (errorMessage.includes('cannot be empty') || errorMessage.includes('is required'))) {
    if (!url || !url.trim()) {
      return `${errorMessage} (URL was: ${JSON.stringify(url)})`;
    }
    return `${errorMessage} (URL was: ${url})`;
  }
  if (!url || !url.trim()) {
    return `Invalid or missing URL. ${errorMessage} (URL was: ${JSON.stringify(url)})`;
  }
  return errorMessage;
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
  const flat = flattenNetworkErrorDetail(error);
  const errorMessage = withUrlContextForNetworkError(flat || error.message, url);

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
    network: true,
    originalError: error
  };
}

/**
 * Make an API call with proper error handling
 * Uses a 30s timeout by default. Pass ``options.timeoutMs`` or ``options.requestTimeoutMs`` for
 * longer single requests (e.g. dataplane validation run E2E POST); capped at 45 minutes.
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options (signal, method, headers, body, etc.)
 * @param {number} [options.timeoutMs] - Optional per-request timeout (ms) when ``signal`` omitted
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
  const singleRequestTimeoutMs = resolveSingleRequestTimeoutMs(fetchOptions);
  if (!fetchOptions.signal) {
    fetchOptions.signal = AbortSignal.timeout(singleRequestTimeoutMs);
  }
  delete fetchOptions.timeoutMs;
  delete fetchOptions.requestTimeoutMs;

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
        `Request timed out after ${Math.round(singleRequestTimeoutMs / 1000)} seconds. The controller may be unreachable. Check the URL and network.`
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
 * Set auth header on headers object: Bearer for user token, x-client-token for application token.
 * @param {Object} headers - Headers object to mutate
 * @param {string} token - Token value
 * @param {string} authType - 'bearer' or 'client-token'
 */
function setAuthHeader(headers, token, authType) {
  if (!token) return;
  if (authType === 'client-token') {
    headers['x-client-token'] = token;
  } else {
    headers['Authorization'] = `Bearer ${token}`;
  }
}

/**
 * Make an authenticated API call with user token (Bearer) or application token (x-client-token).
 * Automatically refreshes device token on 401 when user Bearer was used.
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {string|Object} tokenOrAuthConfig - User token string (Bearer), or authConfig object with type 'bearer'|'client-token'
 * @param {string} [tokenOrAuthConfig.type] - 'bearer' (user token) or 'client-token' (application token)
 * @param {string} [tokenOrAuthConfig.token] - Token (if object)
 * @param {string} [tokenOrAuthConfig.controller] - Controller URL for token refresh (if object)
 * @returns {Promise<Object>} Response object
 */
// eslint-disable-next-line max-statements
async function authenticatedApiCall(url, options = {}, tokenOrAuthConfig) {
  const isStringToken = typeof tokenOrAuthConfig === 'string';
  const token = isStringToken ? tokenOrAuthConfig : tokenOrAuthConfig?.token;
  const authType = isStringToken ? 'bearer' : tokenOrAuthConfig?.type;
  const authControllerUrl = isStringToken ? null : tokenOrAuthConfig?.controller;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  setAuthHeader(headers, token, authType);

  const response = await makeApiCall(url, {
    ...options,
    headers
  });

  // Only attempt device token refresh on 401 when user Bearer token was used (not for client-token)
  if (!response.success && response.status === 401 && authType !== 'client-token') {
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

