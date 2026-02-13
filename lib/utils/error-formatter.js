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
 * Maps common regex patterns to human-readable descriptions
 * @type {Object.<string, string>}
 */
const PATTERN_DESCRIPTIONS = {
  '^[a-z0-9-]+$': 'lowercase letters, numbers, and hyphens only',
  '^[a-z0-9-:]+$': 'lowercase letters, numbers, hyphens, and colons only (e.g., "entity:action")',
  '^[a-z-]+$': 'lowercase letters and hyphens only',
  '^[A-Z_][A-Z0-9_]*$': 'uppercase letters, numbers, and underscores (must start with letter or underscore)',
  '^[a-zA-Z0-9_-]+$': 'letters, numbers, hyphens, and underscores only',
  '^(http|https)://.*$': 'valid HTTP or HTTPS URL',
  '^/[a-z0-9/-]*$': 'URL path starting with / (lowercase letters, numbers, hyphens, slashes)'
};

/**
 * Gets a human-readable description of a regex pattern
 * @function getPatternDescription
 * @param {string} pattern - The regex pattern
 * @returns {string} Human-readable description
 */
function getPatternDescription(pattern) {
  return PATTERN_DESCRIPTIONS[pattern] || `must match pattern: ${pattern}`;
}

/**
 * Extracts the field name from an error's instancePath
 * @function getFieldName
 * @param {Object} error - Validation error object
 * @returns {string} Formatted field name
 */
function getFieldName(error) {
  const instancePath = error.instancePath || '';
  const path = instancePath ? instancePath.slice(1) : '';
  return path ? `Field "${path}"` : 'Configuration';
}

/**
 * Formats a pattern validation error with the actual invalid value
 * @function formatPatternError
 * @param {string} field - Field name
 * @param {Object} error - Validation error object
 * @returns {string} Formatted error message
 */
function formatPatternError(field, error) {
  const invalidValue = error.data !== undefined ? `"${error.data}"` : 'value';
  const patternDesc = getPatternDescription(error.params?.pattern);
  return `${field}: Invalid value ${invalidValue} - ${patternDesc}`;
}

/**
 * Formats additionalProperties validation errors
 * @function formatAdditionalPropertiesError
 * @param {string} field - Field name
 * @param {Object} error - Validation error object
 * @returns {string} Formatted error message
 */
function formatAdditionalPropertiesError(field, error) {
  const invalidProperty = error.params?.additionalProperty;
  const parentSchema = error.parentSchema || {};
  const allowedProps = parentSchema.properties ? Object.keys(parentSchema.properties) : [];
  const lines = [`${field}: must NOT have additional properties`];

  if (invalidProperty) {
    lines.push(`  Invalid property: "${invalidProperty}" (not allowed)`);
  }
  if (allowedProps.length > 0) {
    lines.push(`  Allowed properties: ${allowedProps.join(', ')}`);
  }
  if ((error.instancePath || '').includes('/portalInput/validation')) {
    lines.push('  Example: { "minLength": 1, "maxLength": 1000, "pattern": "^[0-9]+$", "required": false }');
  }

  return lines.join('\n');
}

/**
 * Creates error message formatters for each validation keyword
 * @function createKeywordFormatters
 * @param {string} field - Field name
 * @param {Object} error - Validation error object
 * @returns {Object} Object mapping keywords to formatted messages
 */
function createKeywordFormatters(field, error) {
  const params = error.params || {};

  return {
    required: params.missingProperty
      ? `${field}: Missing required property "${params.missingProperty}"`
      : `${field}: Missing required property`,

    type: params.type
      ? `${field}: Expected ${params.type}, got ${typeof error.data}`
      : `${field}: Type error`,

    minimum: params.limit !== undefined
      ? `${field}: Value must be at least ${params.limit}`
      : `${field}: Value below minimum`,

    maximum: params.limit !== undefined
      ? `${field}: Value must be at most ${params.limit}`
      : `${field}: Value above maximum`,

    minLength: params.limit !== undefined
      ? `${field}: Must be at least ${params.limit} characters`
      : `${field}: Too short`,

    maxLength: params.limit !== undefined
      ? `${field}: Must be at most ${params.limit} characters`
      : `${field}: Too long`,

    enum: params.allowedValues && params.allowedValues.length > 0
      ? `${field}: Must be one of: ${params.allowedValues.join(', ')}`
      : `${field}: Must be one of: unknown`
  };
}

/**
 * Formats a single validation error into a developer-friendly message
 *
 * @function formatSingleError
 * @param {Object} error - Raw validation error from Ajv
 * @returns {string} Formatted error message
 */
function formatSingleError(error) {
  const field = getFieldName(error);

  // Handle pattern errors with special formatting
  if (error.keyword === 'pattern') {
    return formatPatternError(field, error);
  }
  if (error.keyword === 'additionalProperties') {
    return formatAdditionalPropertiesError(field, error);
  }

  // Use object lookup for keyword-specific messages
  const formatters = createKeywordFormatters(field, error);
  const message = formatters[error.keyword];

  // Return keyword message or fallback to generic message
  return message || `${field}: ${error.message || 'Validation error'}`;
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

/**
 * Formats the error when a required DB password variable is missing.
 * Supports single-db (DB_0_PASSWORD or DB_PASSWORD) and multi-db (DB_0_PASSWORD, DB_1_PASSWORD, ...).
 * @param {string} appKey - Application key
 * @param {Object} opts - Options
 * @param {boolean} [opts.multiDb] - True when multiple databases; required passwordKey is used, no hardcoded index
 * @param {string} [opts.passwordKey] - The missing variable name (e.g. 'DB_1_PASSWORD'); required when multiDb is true
 * @returns {string} Error message with next steps
 */
function formatMissingDbPasswordError(appKey, opts = {}) {
  const { multiDb, passwordKey } = opts;
  if (multiDb && passwordKey) {
    return 'Missing required password variable ' + passwordKey + ' in .env file for application \'' + appKey + '\'. ' +
      'Add ' + passwordKey + '=your_secret to your .env file. For multiple databases you need DB_0_PASSWORD, DB_1_PASSWORD, etc.';
  }
  return 'Missing required password variable DB_0_PASSWORD or DB_PASSWORD in .env file for application \'' + appKey + '\'. ' +
    'This app has requires.database or databases in application.yaml. Add DB_0_PASSWORD=your_secret or DB_PASSWORD=your_secret to builder/' + appKey + '/.env (or run \'aifabrix resolve ' + appKey + '\'), or set requires.database: false in application.yaml if not needed.';
}

module.exports = {
  formatSingleError,
  formatValidationErrors,
  formatMissingDbPasswordError,
  getPatternDescription,
  PATTERN_DESCRIPTIONS
};
