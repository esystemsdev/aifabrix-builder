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
  const safeError = {
    message: error.message,
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
  const errorResponse = errorData !== undefined ? errorData : safeError.message;

  // Determine if this is a network error
  const isNetworkError = safeError.code === 'ECONNREFUSED' ||
    safeError.code === 'ENOTFOUND' ||
    safeError.code === 'ECONNABORTED' ||
    safeError.timeout;

  // Parse error using error handler
  const parsedError = parseErrorResponse(errorResponse, safeError.status || 0, isNetworkError);

  // Throw clean error message (without emoji) - CLI will format it
  const formattedError = new Error(parsedError.message);
  formattedError.formatted = parsedError.formatted;
  formattedError.status = safeError.status;
  formattedError.data = parsedError.data;
  formattedError._logged = true; // Mark as logged to prevent double-logging
  throw formattedError;
}

module.exports = {
  handleDeploymentError,
  handleDeploymentErrors
};

