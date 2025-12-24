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
 * Unified error handler for deployment errors
 * Handles audit logging, error formatting, and user-friendly messages
 * @param {Error} error - Error object
 * @param {string} appName - Application name for audit logging
 * @param {string} url - Controller URL for audit logging
 * @param {boolean} [alreadyLogged=false] - Whether error has already been logged
 * @throws {Error} User-friendly error message
 */
async function handleDeploymentErrors(error, appName, url, alreadyLogged = false) {
  // For validation errors (like URL validation), just re-throw them directly
  // They already have user-friendly messages
  // Handle both Error objects and strings
  let errorMessage = '';
  if (error instanceof Error) {
    errorMessage = error.message || '';
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && error.message) {
    errorMessage = error.message;
  }

  if (errorMessage && (
    errorMessage.includes('Controller URL must use HTTPS') ||
    errorMessage.includes('Invalid environment key') ||
    errorMessage.includes('Environment key is required') ||
    errorMessage.includes('Authentication configuration is required') ||
    errorMessage.includes('Invalid controller URL format') ||
    errorMessage.includes('Controller URL is required')
  )) {
    // If error is a string, convert to Error object
    if (typeof error === 'string') {
      throw new Error(error);
    }
    // If it's already an Error object, re-throw it directly
    if (error instanceof Error) {
      throw error;
    }
    // Otherwise, create a new Error with the message
    throw new Error(errorMessage);
  }

  // Log to audit log if not already logged
  if (!alreadyLogged) {
    try {
      await auditLogger.logDeploymentFailure(appName, url, error);
    } catch (logError) {
      // Don't fail if audit logging fails, but log to console
      // eslint-disable-next-line no-console
      console.error(`[AUDIT LOG ERROR] Failed to log deployment failure: ${logError.message}`);
    }
  }

  const safeError = handleDeploymentError(error);

  // Extract error data from axios response
  let errorData = safeError.data;
  if (error.response && error.response.data !== undefined) {
    errorData = error.response.data;
  }

  // Ensure errorData is not undefined before parsing
  // If errorData is undefined, use the error message instead
  let errorResponse = errorData !== undefined ? errorData : safeError.message;

  // Ensure errorResponse is a string or object, not an Error object
  if (errorResponse instanceof Error) {
    errorResponse = errorResponse.message || 'Unknown error occurred';
  }

  // Ensure errorResponse is not null or undefined
  if (errorResponse === null || errorResponse === undefined) {
    errorResponse = safeError.message || 'Unknown error occurred';
  }

  // Determine if this is a network error
  const isNetworkError = safeError.code === 'ECONNREFUSED' ||
    safeError.code === 'ENOTFOUND' ||
    safeError.code === 'ECONNABORTED' ||
    safeError.timeout;

  // Parse error using error handler
  let parsedError;
  try {
    parsedError = parseErrorResponse(errorResponse, safeError.status || 0, isNetworkError);
    // Ensure parsedError is a valid object
    if (!parsedError || typeof parsedError !== 'object') {
      throw new Error('parseErrorResponse returned invalid result');
    }
  } catch (parseErr) {
    // If parsing fails, use the safe error message
    parsedError = {
      message: safeError.message || 'Unknown error occurred',
      formatted: safeError.message || 'Unknown error occurred',
      data: undefined
    };
  }

  // Ensure parsedError is always a valid object with required properties
  if (!parsedError || typeof parsedError !== 'object') {
    parsedError = {
      message: safeError.message || 'Unknown error occurred',
      formatted: safeError.message || 'Unknown error occurred',
      data: undefined
    };
  }

  // Ensure we have a message - handle case where parsedError.message might be undefined
  const finalErrorMessage = (parsedError && parsedError.message) ? parsedError.message : (safeError.message || 'Unknown error occurred');

  // Validate finalErrorMessage is a string
  if (typeof finalErrorMessage !== 'string') {
    throw new Error(`Invalid error message type: ${typeof finalErrorMessage}. Error: ${JSON.stringify(error)}`);
  }

  // Throw clean error message (without emoji) - CLI will format it
  const formattedError = new Error(finalErrorMessage);
  formattedError.formatted = parsedError?.formatted || finalErrorMessage;
  formattedError.status = safeError.status;
  formattedError.data = parsedError?.data;
  formattedError._logged = true; // Mark as logged to prevent double-logging
  throw formattedError;
}

module.exports = {
  handleDeploymentError,
  handleDeploymentErrors
};

