/**
 * Deployment Error Handling Utilities
 *
 * Handles deployment errors with security-aware messages and audit logging.
 *
 * @fileoverview Deployment error handling functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const auditLogger = require('../audit-logger');
const { parseErrorResponse } = require('./api-error-handler');

/**
 * Handles deployment errors with security-aware messages
 *
 * @param {Error} error - Error to handle
 * @returns {Object} Structured error information
 */
function handleDeploymentError(error) {
  if (!error) {
    return {
      message: 'Unknown error',
      code: 'UNKNOWN',
      timeout: false,
      status: undefined,
      data: undefined
    };
  }
  const safeError = {
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN',
    timeout: error.code === 'ECONNABORTED',
    status: error.status || error.response?.status,
    data: error.data || error.response?.data
  };

  // Mask sensitive information in error messages
  safeError.message = auditLogger.maskSensitiveData(safeError.message);

  return safeError;
}

/**
 * Extract error message from different error types
 * @param {Error|string|Object} error - Error object, string, or object
 * @returns {string} Error message
 */
function extractErrorMessage(error) {
  if (error instanceof Error) {
    return error.message || '';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && error.message) {
    return error.message;
  }
  return '';
}

/**
 * Check if error is a validation error that should be re-thrown directly
 * @param {string} errorMessage - Error message
 * @returns {boolean} True if validation error
 */
function isValidationError(errorMessage) {
  return errorMessage && (
    errorMessage.includes('Controller URL must use HTTPS') ||
    errorMessage.includes('Invalid environment key') ||
    errorMessage.includes('Environment key is required') ||
    errorMessage.includes('Authentication configuration is required') ||
    errorMessage.includes('Invalid controller URL format') ||
    errorMessage.includes('Controller URL is required')
  );
}

/**
 * Re-throw validation errors directly
 * @param {Error|string|Object} error - Error object
 * @param {string} errorMessage - Error message
 * @throws {Error} Validation error
 */
function throwValidationError(error, errorMessage) {
  if (typeof error === 'string') {
    throw new Error(error);
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(errorMessage);
}

/**
 * Log deployment failure to audit log
 * @async
 * @param {string} appName - Application name
 * @param {string} url - Controller URL
 * @param {Error|string|Object} error - Error object
 * @returns {Promise<void>}
 */
async function logDeploymentFailure(appName, url, error) {
  try {
    await auditLogger.logDeploymentFailure(appName, url, error);
  } catch (logError) {
    // Don't fail if audit logging fails, but log to console
    // eslint-disable-next-line no-console
    console.error(`[AUDIT LOG ERROR] Failed to log deployment failure: ${logError.message}`);
  }
}

/**
 * Extract and normalize error response data
 * @param {Object} safeError - Safe error object
 * @param {Error|Object} error - Original error object
 * @returns {string|Object} Normalized error response
 */
function extractErrorResponse(safeError, error) {
  let errorData = safeError.data;
  if (error.response && error.response.data !== undefined) {
    errorData = error.response.data;
  }

  let errorResponse = errorData !== undefined ? errorData : safeError.message;

  if (errorResponse instanceof Error) {
    errorResponse = errorResponse.message || 'Unknown error occurred';
  }

  if (errorResponse === null || errorResponse === undefined) {
    errorResponse = safeError.message || 'Unknown error occurred';
  }

  return errorResponse;
}

/**
 * Determine if error is a network error
 * @param {Object} safeError - Safe error object
 * @returns {boolean} True if network error
 */
function isNetworkError(safeError) {
  return safeError.code === 'ECONNREFUSED' ||
    safeError.code === 'ENOTFOUND' ||
    safeError.code === 'ECONNABORTED' ||
    safeError.timeout;
}

/**
 * Parse error response and ensure valid result
 * @param {string|Object} errorResponse - Error response
 * @param {Object} safeError - Safe error object
 * @returns {Object} Parsed error object
 */
function parseErrorResponseSafely(errorResponse, safeError) {
  const isNetwork = isNetworkError(safeError);

  try {
    const parsedError = parseErrorResponse(errorResponse, safeError.status || 0, isNetwork);
    if (!parsedError || typeof parsedError !== 'object') {
      throw new Error('parseErrorResponse returned invalid result');
    }
    return parsedError;
  } catch {
    return {
      message: safeError.message || 'Unknown error occurred',
      formatted: safeError.message || 'Unknown error occurred',
      data: undefined
    };
  }
}

/**
 * Create formatted error object
 * @param {Object} parsedError - Parsed error object
 * @param {Object} safeError - Safe error object
 * @param {Error|string|Object} originalError - Original error
 * @returns {Error} Formatted error object
 */
function createFormattedError(parsedError, safeError, originalError) {
  const finalErrorMessage = (parsedError && parsedError.message) ? parsedError.message : (safeError.message || 'Unknown error occurred');

  if (typeof finalErrorMessage !== 'string') {
    throw new Error(`Invalid error message type: ${typeof finalErrorMessage}. Error: ${JSON.stringify(originalError)}`);
  }

  const formattedError = new Error(finalErrorMessage);
  formattedError.formatted = parsedError?.formatted || finalErrorMessage;
  formattedError.status = safeError.status;
  formattedError.data = parsedError?.data;
  formattedError._logged = true;

  return formattedError;
}

/**
 * Unified error handler for deployment errors
 * Handles audit logging, error formatting, and user-friendly messages
 * @param {Error} error - Error object
 * @param {string} appName - Application name for audit logging
 * @param {string} url - Controller URL for audit logging
 * @param {boolean} [alreadyLogged=false] - Whether error has already been logged
 * @throws {Error} User-friendly error message
 */
async function handleDeploymentErrors(error, appName, url, alreadyLogged = false) {
  // Extract error message
  const errorMessage = extractErrorMessage(error);

  // For validation errors (like URL validation), just re-throw them directly
  if (isValidationError(errorMessage)) {
    throwValidationError(error, errorMessage);
  }

  // Log to audit log if not already logged
  if (!alreadyLogged) {
    await logDeploymentFailure(appName, url, error);
  }

  const safeError = handleDeploymentError(error);
  const errorResponse = extractErrorResponse(safeError, error);
  const parsedError = parseErrorResponseSafely(errorResponse, safeError);

  // Ensure parsedError is always a valid object
  const validParsedError = (!parsedError || typeof parsedError !== 'object')
    ? {
      message: safeError.message || 'Unknown error occurred',
      formatted: safeError.message || 'Unknown error occurred',
      data: undefined
    }
    : parsedError;

  // Create and throw formatted error
  throw createFormattedError(validParsedError, safeError, error);
}

module.exports = {
  handleDeploymentError,
  handleDeploymentErrors
};

