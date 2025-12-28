/**
 * AI Fabrix Builder API Error Handler
 *
 * Parses and formats structured error responses from the controller API
 * Handles permission errors, validation errors, authentication errors,
 * network errors, and server errors with user-friendly formatting
 *
 * @fileoverview API error handling utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { parseErrorResponse } = require('./error-formatters/error-parser');
const { formatPermissionError } = require('./error-formatters/permission-errors');
const { formatValidationError } = require('./error-formatters/validation-errors');
const {
  formatAuthenticationError,
  formatServerError,
  formatConflictError,
  formatGenericError
} = require('./error-formatters/http-status-errors');
const { formatNetworkError } = require('./error-formatters/network-errors');

/**
 * Formats error for display in CLI
 * @param {Object} apiResponse - API response object from makeApiCall
 * @param {string} [controllerUrl] - Controller URL (optional)
 * @returns {string} Formatted error message
 */
function formatApiError(apiResponse, controllerUrl = null) {
  if (!apiResponse || apiResponse.success !== false) {
    return chalk.red('❌ Unknown error occurred');
  }

  // Use formattedError if already available
  if (apiResponse.formattedError) {
    return apiResponse.formattedError;
  }

  const errorResponse = apiResponse.error || apiResponse.data || '';
  const statusCode = apiResponse.status || 0;
  const isNetworkError = apiResponse.network === true;

  // Add controller URL to error data
  // Handle both object and string error responses
  const errorData = typeof errorResponse === 'object' && errorResponse !== null
    ? { ...errorResponse, controllerUrl: controllerUrl }
    : { message: String(errorResponse || ''), controllerUrl: controllerUrl };

  const parsed = parseErrorResponse(errorData, statusCode, isNetworkError);
  return parsed.formatted;
}

module.exports = {
  parseErrorResponse,
  formatApiError,
  formatPermissionError,
  formatValidationError,
  formatAuthenticationError,
  formatConflictError,
  formatNetworkError,
  formatServerError,
  formatGenericError
};
