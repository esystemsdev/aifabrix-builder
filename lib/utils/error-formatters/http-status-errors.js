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
 * @returns {string} Formatted authentication error message
 */
function formatAuthenticationError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Authentication Failed\n'));
  if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
  } else {
    lines.push(chalk.yellow('Invalid credentials or token expired.'));
  }
  lines.push('');
  lines.push(chalk.gray('Run: aifabrix login'));
  if (errorData.correlationId) {
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }
  return lines.join('\n');
}

/**
 * Formats server error (500+)
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted server error message
 */
function formatServerError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Server Error\n'));

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
 * @returns {string} Formatted conflict error message
 */
function formatConflictError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Conflict\n'));

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
 * @returns {string} Formatted not found error message
 */
function formatNotFoundError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Not Found\n'));

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
 * @returns {string} Formatted error message
 */
function formatGenericError(errorData, statusCode) {
  const lines = [];
  lines.push(chalk.red(`❌ Error (HTTP ${statusCode})\n`));

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

