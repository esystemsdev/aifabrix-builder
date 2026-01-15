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
  // Handle empty or missing instancePath - use 'Configuration' for root level errors
  const instancePath = error.instancePath || '';
  const path = instancePath ? instancePath.slice(1) : '';
  const field = path ? `Field "${path}"` : 'Configuration';

  // Check if params exists before accessing it
  const errorMessages = {
    required: error.params?.missingProperty
      ? `${field}: Missing required property "${error.params.missingProperty}"`
      : `${field}: Missing required property`,
    type: error.params?.type
      ? `${field}: Expected ${error.params.type}, got ${typeof error.data}`
      : `${field}: Type error`,
    minimum: error.params?.limit
      ? `${field}: Value must be at least ${error.params.limit}`
      : `${field}: Value below minimum`,
    maximum: error.params?.limit
      ? `${field}: Value must be at most ${error.params.limit}`
      : `${field}: Value above maximum`,
    minLength: error.params?.limit
      ? `${field}: Must be at least ${error.params.limit} characters`
      : `${field}: Too short`,
    maxLength: error.params?.limit
      ? `${field}: Must be at most ${error.params.limit} characters`
      : `${field}: Too long`,
    pattern: `${field}: Invalid format`,
    enum: error.params?.allowedValues && error.params.allowedValues.length > 0
      ? `${field}: Must be one of: ${error.params.allowedValues.join(', ')}`
      : `${field}: Must be one of: unknown`
  };

  return errorMessages[error.keyword] || `${field}: ${error.message || 'Validation error'}`;
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

