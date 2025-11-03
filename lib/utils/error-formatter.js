/**
 * Error Formatting Utilities
 *
 * Formats validation errors into developer-friendly messages
 * Converts technical schema errors into actionable advice
 *
 * @fileoverview Error formatting utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Formats a single validation error into a developer-friendly message
 *
 * @function formatSingleError
 * @param {Object} error - Raw validation error from Ajv
 * @returns {string} Formatted error message
 */
function formatSingleError(error) {
  const path = error.instancePath ? error.instancePath.slice(1) : 'root';
  const field = path ? `Field "${path}"` : 'Configuration';

  const errorMessages = {
    required: `${field}: Missing required property "${error.params.missingProperty}"`,
    type: `${field}: Expected ${error.params.type}, got ${typeof error.data}`,
    minimum: `${field}: Value must be at least ${error.params.limit}`,
    maximum: `${field}: Value must be at most ${error.params.limit}`,
    minLength: `${field}: Must be at least ${error.params.limit} characters`,
    maxLength: `${field}: Must be at most ${error.params.limit} characters`,
    pattern: `${field}: Invalid format`,
    enum: `${field}: Must be one of: ${error.params.allowedValues?.join(', ') || 'unknown'}`
  };

  return errorMessages[error.keyword] || `${field}: ${error.message}`;
}

/**
 * Formats validation errors into developer-friendly messages
 * Converts technical schema errors into actionable advice
 *
 * @function formatValidationErrors
 * @param {Array} errors - Raw validation errors from Ajv
 * @returns {Array} Formatted error messages
 *
 * @example
 * const messages = formatValidationErrors(ajvErrors);
 * // Returns: ['Port must be between 1 and 65535', 'Missing required field: displayName']
 */
function formatValidationErrors(errors) {
  if (!Array.isArray(errors)) {
    return ['Unknown validation error'];
  }

  return errors.map(formatSingleError);
}

module.exports = {
  formatSingleError,
  formatValidationErrors
};

