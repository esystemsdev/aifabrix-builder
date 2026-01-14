/**
 * HTTP Status Error Formatters
 *
 * Formats HTTP status code errors (401, 404, 409, 500+)
 *
 * @fileoverview HTTP status error formatting utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

/**
 * Formats authentication error
 * @param {Object} errorData - Error response data
 * @param {string} [errorData.controllerUrl] - Controller URL for example command
 * @param {string[]} [errorData.attemptedUrls] - Array of attempted controller URLs
 * @param {string} [errorData.message] - Error message
 * @param {string} [errorData.error] - Error text
 * @param {string} [errorData.detail] - Error detail
 * @param {string} [errorData.correlationId] - Correlation ID
 * @returns {string} Formatted authentication error message
 */
/**
 * Adds controller URL information to error lines
 * @function addControllerUrlInfo
 * @param {string[]} lines - Error message lines
 * @param {Object} errorData - Error data
 */
function addControllerUrlInfo(lines, errorData) {
  if (errorData.controllerUrl) {
    lines.push(chalk.yellow(`Controller URL: ${errorData.controllerUrl}`));
    lines.push('');
  }
}

/**
 * Adds attempted URLs information
 * @function addAttemptedUrlsInfo
 * @param {string[]} lines - Error message lines
 * @param {Object} errorData - Error data
 */
function addAttemptedUrlsInfo(lines, errorData) {
  if (errorData.attemptedUrls && errorData.attemptedUrls.length > 1) {
    lines.push(chalk.gray('Attempted controller URLs:'));
    errorData.attemptedUrls.forEach(url => {
      lines.push(chalk.gray(`  • ${url}`));
    });
    lines.push('');
  }
}

/**
 * Checks if error message is generic
 * @function isGenericErrorMessage
 * @param {string} errorMessage - Error message
 * @returns {boolean} True if generic
 */
function isGenericErrorMessage(errorMessage) {
  const lowerMessage = errorMessage.toLowerCase();
  return lowerMessage.includes('authentication required') ||
         lowerMessage.includes('unauthorized') ||
         lowerMessage === '';
}

/**
 * Adds error message if not generic
 * @function addErrorMessageIfNotGeneric
 * @param {string[]} lines - Error message lines
 * @param {Object} errorData - Error data
 */
function addErrorMessageIfNotGeneric(lines, errorData) {
  const errorMessage = errorData.message || errorData.error || errorData.detail || '';
  if (errorMessage && !isGenericErrorMessage(errorMessage)) {
    lines.push(chalk.yellow(errorMessage));
    lines.push('');
  }
}

/**
 * Adds authentication guidance
 * @function addAuthenticationGuidance
 * @param {string[]} lines - Error message lines
 * @param {Object} errorData - Error data
 */
function addAuthenticationGuidance(lines, errorData) {
  lines.push(chalk.gray('Your authentication token is invalid or has expired.'));
  lines.push('');
  lines.push(chalk.gray('To authenticate, run:'));

  const controllerUrl = errorData.controllerUrl;
  if (controllerUrl && controllerUrl.trim()) {
    lines.push(chalk.gray(`  aifabrix login --method device --controller ${controllerUrl}`));
  } else {
    lines.push(chalk.gray('  aifabrix login --method device --controller <url>'));
  }

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }
}

function formatAuthenticationError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Authentication Failed\n'));

  addControllerUrlInfo(lines, errorData);
  addAttemptedUrlsInfo(lines, errorData);
  addErrorMessageIfNotGeneric(lines, errorData);
  addAuthenticationGuidance(lines, errorData);

  return lines.join('\n');
}

/**
 * Formats server error (500+)
 * @param {Object} errorData - Error response data
 * @param {string} [errorData.controllerUrl] - Controller URL
 * @returns {string} Formatted server error message
 */
function formatServerError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Server Error\n'));

  // Show controller URL if available
  if (errorData.controllerUrl) {
    lines.push(chalk.yellow(`Controller URL: ${errorData.controllerUrl}`));
    lines.push('');
  }

  // Check for RFC 7807 Problem Details format (detail field)
  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
  } else {
    lines.push(chalk.yellow('An internal server error occurred.'));
  }
  lines.push('');
  lines.push(chalk.gray('Please try again later or contact support.'));

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

/**
 * Formats conflict error (409)
 * @param {Object} errorData - Error response data
 * @param {string} [errorData.controllerUrl] - Controller URL
 * @returns {string} Formatted conflict error message
 */
function formatConflictError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Conflict\n'));

  // Show controller URL if available
  if (errorData.controllerUrl) {
    lines.push(chalk.yellow(`Controller URL: ${errorData.controllerUrl}`));
    lines.push('');
  }

  // Check if it's an application already exists error
  const detail = errorData.detail || errorData.message || '';
  if (detail.toLowerCase().includes('application already exists')) {
    lines.push(chalk.yellow('This application already exists in this environment.'));
    lines.push('');
    lines.push(chalk.gray('Options:'));
    lines.push(chalk.gray('  • Use a different environment'));
    lines.push(chalk.gray('  • Check existing applications: aifabrix app list -e <environment>'));
    lines.push(chalk.gray('  • Update the existing application if needed'));
  } else if (detail) {
    lines.push(chalk.yellow(detail));
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
  } else {
    lines.push(chalk.yellow('A conflict occurred. The resource may already exist.'));
  }

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

/**
 * Gets actionable guidance options based on error detail
 * @param {string} detail - Error detail message
 * @returns {Array<string>} Array of guidance options
 */
function getNotFoundGuidance(detail) {
  const lowerDetail = detail.toLowerCase();
  if (lowerDetail.includes('environment')) {
    return [
      '  • Check the environment key spelling',
      '  • List available environments: aifabrix app list -e <environment>',
      '  • Verify you have access to this environment'
    ];
  }
  if (lowerDetail.includes('application')) {
    return [
      '  • Check the application key spelling',
      '  • List applications: aifabrix app list -e <environment>',
      '  • Verify the application exists in this environment'
    ];
  }
  return [
    '  • Check the resource identifier',
    '  • Verify the resource exists',
    '  • Check your permissions'
  ];
}

/**
 * Formats not found error (404)
 * @param {Object} errorData - Error response data
 * @param {string} [errorData.controllerUrl] - Controller URL
 * @returns {string} Formatted not found error message
 */
function formatNotFoundError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Not Found\n'));

  // Show controller URL if available
  if (errorData.controllerUrl) {
    lines.push(chalk.yellow(`Controller URL: ${errorData.controllerUrl}`));
    lines.push('');
  }

  const detail = errorData.detail || errorData.message || '';
  if (detail) {
    lines.push(chalk.yellow(detail));
    lines.push('');
  }

  lines.push(chalk.gray('Options:'));
  const guidance = getNotFoundGuidance(detail);
  guidance.forEach(option => {
    lines.push(chalk.gray(option));
  });

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

/**
 * Formats generic error
 * @param {Object} errorData - Error response data
 * @param {number} statusCode - HTTP status code
 * @param {string} [errorData.controllerUrl] - Controller URL
 * @returns {string} Formatted error message
 */
function formatGenericError(errorData, statusCode) {
  const lines = [];
  lines.push(chalk.red(`❌ Error (HTTP ${statusCode})\n`));

  // Show controller URL if available
  if (errorData.controllerUrl) {
    lines.push(chalk.yellow(`Controller URL: ${errorData.controllerUrl}`));
    lines.push('');
  }

  // Check for RFC 7807 Problem Details format (detail field)
  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
  } else if (errorData.error) {
    lines.push(chalk.yellow(errorData.error));
  } else {
    lines.push(chalk.yellow('An error occurred while processing your request.'));
  }

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

module.exports = {
  formatAuthenticationError,
  formatServerError,
  formatConflictError,
  formatNotFoundError,
  formatGenericError
};

