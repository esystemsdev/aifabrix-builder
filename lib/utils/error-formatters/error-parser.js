/**
 * Error Parser Utilities
 *
 * Parses error responses and determines error types
 *
 * @fileoverview Error parsing utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { formatPermissionError } = require('./permission-errors');
const { formatValidationError } = require('./validation-errors');
const {
  formatAuthenticationError,
  formatServerError,
  formatConflictError,
  formatNotFoundError,
  formatGenericError
} = require('./http-status-errors');
const { formatNetworkError } = require('./network-errors');

/**
 * Parses error response into error data object
 * @param {string|Object} errorResponse - Error response (string or parsed JSON)
 * @returns {Object} Parsed error data object
 */
function parseErrorData(errorResponse) {
  if (errorResponse === undefined || errorResponse === null) {
    return { message: 'Unknown error occurred' };
  }
  if (typeof errorResponse === 'string') {
    try {
      return JSON.parse(errorResponse);
    } catch {
      return { message: errorResponse };
    }
  }
  return typeof errorResponse === 'object' ? errorResponse : { message: String(errorResponse) };
}

/**
 * Creates error result object
 * @param {string} type - Error type
 * @param {string} message - Error message
 * @param {string} formatted - Formatted error message
 * @param {Object} data - Error data
 * @returns {Object} Error result object
 */
function createErrorResult(type, message, formatted, data) {
  return { type, message, formatted, data };
}

/**
 * Gets error message from error data
 * @param {Object} errorData - Error data object
 * @param {string} defaultMessage - Default message if not found
 * @returns {string} Error message
 */
function getErrorMessage(errorData, defaultMessage) {
  return errorData.detail || errorData.title || errorData.errorDescription ||
    errorData.message || errorData.error || defaultMessage;
}

/**
 * Handles 400 validation error
 * @param {Object} errorData - Error data object
 * @returns {Object} Error result object
 */
function handleValidationError(errorData) {
  const errorMessage = getErrorMessage(errorData, 'Validation error');
  return createErrorResult('validation', errorMessage, formatValidationError(errorData), errorData);
}

/**
 * Handles specific 4xx client error codes
 * @param {number} statusCode - HTTP status code
 * @param {Object} errorData - Error data object
 * @returns {Object|null} Error result object or null if not handled
 */
function handleSpecificClientErrors(statusCode, errorData) {
  switch (statusCode) {
  case 403:
    return createErrorResult('permission', 'Permission denied', formatPermissionError(errorData), errorData);
  case 401:
    return createErrorResult('authentication', 'Authentication failed', formatAuthenticationError(errorData), errorData);
  case 400:
  case 422:
    return handleValidationError(errorData);
  case 404:
    return createErrorResult('notfound', getErrorMessage(errorData, 'Not found'), formatNotFoundError(errorData), errorData);
  case 409:
    return createErrorResult('conflict', getErrorMessage(errorData, 'Conflict'), formatConflictError(errorData), errorData);
  default:
    return null;
  }
}

/**
 * Handles HTTP status code errors
 * @param {number} statusCode - HTTP status code
 * @param {Object} errorData - Error data object
 * @returns {Object|null} Error result object or null if not handled
 */
function handleStatusCodeError(statusCode, errorData) {
  // Handle 4xx client errors
  if (statusCode >= 400 && statusCode < 500) {
    return handleSpecificClientErrors(statusCode, errorData);
  }
  // Handle 5xx server errors
  // Use generic "Server error" message for consistency (specific details shown in formatted output)
  if (statusCode >= 500) {
    return createErrorResult('server', 'Server error', formatServerError(errorData), errorData);
  }
  return null;
}

/**
 * Parses error response and determines error type
 * @param {string|Object} errorResponse - Error response (string or parsed JSON)
 * @param {number} statusCode - HTTP status code
 * @param {boolean} isNetworkError - Whether this is a network error
 * @returns {Object} Parsed error object with type, message, and formatted output
 */
function parseErrorResponse(errorResponse, statusCode, isNetworkError) {
  // For null, undefined, treat as generic regardless of status code
  if (errorResponse === null || errorResponse === undefined) {
    return createErrorResult('generic', 'Unknown error', formatGenericError({ message: 'Unknown error' }, statusCode), { message: 'Unknown error' });
  }

  // For non-string, non-object errors (numbers, booleans, etc.), treat as generic
  if (typeof errorResponse !== 'string' && typeof errorResponse !== 'object') {
    const errorMessage = String(errorResponse);
    return createErrorResult('generic', errorMessage, formatGenericError({ message: errorMessage }, statusCode), { message: errorMessage });
  }

  // Check if it's a plain string (not JSON)
  let isPlainString = false;
  if (typeof errorResponse === 'string') {
    const trimmed = errorResponse.trim();
    isPlainString = !(trimmed.startsWith('{') || trimmed.startsWith('['));
  }

  let errorData = parseErrorData(errorResponse);

  // Handle nested response structure (some APIs wrap errors in data field)
  if (errorData.data && typeof errorData.data === 'object') {
    errorData = errorData.data;
  }

  // Handle network errors
  if (isNetworkError) {
    const errorMessage = errorData.message || errorResponse || 'Network error';
    return createErrorResult('network', errorMessage, formatNetworkError(errorMessage, errorData), errorData);
  }

  // Handle HTTP status codes first (even for plain strings, status code takes precedence)
  // However, for plain string errors, preserve the original message
  const statusError = handleStatusCodeError(statusCode, errorData);
  if (statusError) {
    // For plain string errors, preserve the original message instead of formatted message
    if (isPlainString && typeof errorResponse === 'string') {
      return createErrorResult(statusError.type, errorResponse, statusError.formatted, statusError.data);
    }
    return statusError;
  }

  // For plain string errors (not JSON) without specific status code handling, treat as generic
  if (isPlainString) {
    const errorMessage = errorData.message || errorResponse || 'Unknown error';
    return createErrorResult('generic', errorMessage, formatGenericError(errorData, statusCode), errorData);
  }

  // Generic error
  return createErrorResult('generic', errorData.message || errorData.error || 'Unknown error', formatGenericError(errorData, statusCode), errorData);
}

module.exports = {
  parseErrorResponse
};

