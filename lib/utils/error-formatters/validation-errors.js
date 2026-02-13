/**
 * Validation Error Formatters
 *
 * Formats validation errors (400, 422) with field-level details
 *
 * @fileoverview Validation error formatting utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

/**
 * Adds main error message to lines array
 * @param {Array<string>} lines - Lines array to append to
 * @param {Object} errorData - Error response data
 */
function addValidationErrorMessage(lines, errorData) {
  // Handle RFC 7807 Problem Details format
  // Priority: detail > title > errorDescription > message > error
  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
    lines.push('');
  } else if (errorData.title) {
    lines.push(chalk.yellow(errorData.title));
    lines.push('');
  } else if (errorData.errorDescription) {
    lines.push(chalk.yellow(errorData.errorDescription));
    if (errorData.error) {
      lines.push(chalk.gray(`Error code: ${errorData.error}`));
    }
    lines.push('');
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
    lines.push('');
  } else if (errorData.error) {
    lines.push(chalk.yellow(errorData.error));
    lines.push('');
  }
}

/**
 * Formats errors array and adds to lines
 * @param {Array<string>} lines - Lines array to append to
 * @param {Array<Object>} errors - Array of error objects
 */
function addValidationErrorsList(lines, errors) {
  if (!errors || !Array.isArray(errors) || errors.length === 0) {
    return;
  }
  lines.push(chalk.yellow('Validation errors:'));
  errors.forEach(err => {
    const field = err.field || err.path || err.loc?.join('.') || 'validation';
    const message = err.msg || err.message || 'Invalid value';
    const value = err.value !== undefined ? ` (value: ${JSON.stringify(err.value)})` : '';
    if (field === 'validation' || field === 'unknown') {
      lines.push(chalk.gray(`  • ${message}${value}`));
    } else {
      lines.push(chalk.gray(`  • ${field}: ${message}${value}`));
    }
  });
  lines.push('');
}

/**
 * Formats configuration errors and adds to lines
 * @param {Array<string>} lines - Lines array to append to
 * @param {Object} configuration - Configuration error object
 */
function addConfigurationErrors(lines, configuration) {
  if (!configuration || !configuration.errors) {
    return;
  }
  lines.push(chalk.yellow('Configuration errors:'));
  if (Array.isArray(configuration.errors)) {
    configuration.errors.forEach(err => {
      const field = err.field || err.path || 'configuration';
      const message = err.message || 'Invalid value';
      lines.push(chalk.gray(`  • ${field}: ${message}`));
    });
  } else if (typeof configuration.errors === 'object') {
    Object.keys(configuration.errors).forEach(key => {
      const message = configuration.errors[key];
      lines.push(chalk.gray(`  • configuration.${key}: ${message}`));
    });
  }
  lines.push('');
}

/**
 * Adds actionable guidance tips to lines
 * @param {Array<string>} lines - Lines array to append to
 * @param {boolean} hasErrors - Whether there are validation errors
 */
function addValidationGuidance(lines, hasErrors) {
  if (!hasErrors) {
    return;
  }
  lines.push(chalk.gray('Tips:'));
  lines.push(chalk.gray('  • Check your application.yaml file for the correct field values'));
  lines.push(chalk.gray('  • Verify field names match the expected schema'));
  lines.push(chalk.gray('  • Ensure required fields are present and valid'));
  lines.push('');
}

/**
 * Formats validation error with field-level details
 * Handles unified error API response format (RFC 7807 Problem Details)
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted validation error message
 */
function formatValidationError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Validation Error\n'));

  addValidationErrorMessage(lines, errorData);
  addValidationErrorsList(lines, errorData.errors);
  addConfigurationErrors(lines, errorData.configuration);
  addValidationGuidance(lines, errorData.errors && errorData.errors.length > 0);

  if (errorData.instance) {
    lines.push(chalk.gray(`Endpoint: ${errorData.instance}`));
  }
  if (errorData.correlationId) {
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }
  return lines.join('\n');
}

module.exports = {
  formatValidationError
};

