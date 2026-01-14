/**
 * Network Error Formatters
 *
 * Formats network-related errors (connection refused, timeouts, etc.)
 *
 * @fileoverview Network error formatting utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

/**
 * Normalizes error message to string
 * @function normalizeErrorMessage
 * @param {string} errorMessage - Error message
 * @returns {string} Normalized error message
 */
function normalizeErrorMessage(errorMessage) {
  return typeof errorMessage === 'string' ? errorMessage : String(errorMessage || 'Network error');
}

/**
 * Adds controller URL header to error lines
 * @function addControllerUrlHeader
 * @param {Array<string>} lines - Error message lines
 * @param {Object} errorData - Error response data
 */
function addControllerUrlHeader(lines, errorData) {
  if (errorData && errorData.controllerUrl) {
    lines.push(chalk.yellow(`Controller URL: ${errorData.controllerUrl}`));
    lines.push('');
  }
}

/**
 * Adds controller URL to error message
 * @function addControllerUrlToMessage
 * @param {Array<string>} lines - Error message lines
 * @param {Object} errorData - Error response data
 */
function addControllerUrlToMessage(lines, errorData) {
  if (errorData && errorData.controllerUrl) {
    lines.push(chalk.gray(`Controller URL: ${errorData.controllerUrl}`));
  }
}

/**
 * Formats connection refused error
 * @function formatConnectionRefusedError
 * @param {Array<string>} lines - Error message lines
 * @param {Object} errorData - Error response data
 */
function formatConnectionRefusedError(lines, errorData) {
  lines.push(chalk.yellow('Cannot connect to controller.'));
  addControllerUrlToMessage(lines, errorData);
  lines.push(chalk.gray('Check if the controller is running.'));
}

/**
 * Formats hostname not found error
 * @function formatHostnameNotFoundError
 * @param {Array<string>} lines - Error message lines
 * @param {Object} errorData - Error response data
 */
function formatHostnameNotFoundError(lines, errorData) {
  lines.push(chalk.yellow('Controller hostname not found.'));
  addControllerUrlToMessage(lines, errorData);
  lines.push(chalk.gray('Check your controller URL.'));
}

/**
 * Formats timeout error
 * @function formatTimeoutError
 * @param {Array<string>} lines - Error message lines
 * @param {Object} errorData - Error response data
 */
function formatTimeoutError(lines, errorData) {
  lines.push(chalk.yellow('Request timed out.'));
  addControllerUrlToMessage(lines, errorData);
  lines.push(chalk.gray('The controller may be overloaded.'));
}

/**
 * Formats error message based on error type
 * @function formatErrorMessageByType
 * @param {string} message - Normalized error message
 * @param {Array<string>} lines - Error message lines
 * @param {Object} errorData - Error response data
 */
function formatErrorMessageByType(message, lines, errorData) {
  if (message.includes('ECONNREFUSED') || message.includes('Cannot connect')) {
    formatConnectionRefusedError(lines, errorData);
  } else if (message.includes('ENOTFOUND') || message.includes('hostname not found')) {
    formatHostnameNotFoundError(lines, errorData);
  } else if (message.includes('timeout') || message.includes('timed out')) {
    formatTimeoutError(lines, errorData);
  } else {
    lines.push(chalk.yellow(message));
  }
}

/**
 * Adds correlation ID if present
 * @function addCorrelationId
 * @param {Array<string>} lines - Error message lines
 * @param {Object} errorData - Error response data
 */
function addCorrelationId(lines, errorData) {
  if (errorData && errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }
}

/**
 * Formats network error
 * @param {string} errorMessage - Error message
 * @param {Object} errorData - Error response data (optional)
 * @param {string} [errorData.controllerUrl] - Controller URL
 * @returns {string} Formatted network error message
 */
function formatNetworkError(errorMessage, errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Network Error\n'));

  addControllerUrlHeader(lines, errorData);

  const message = normalizeErrorMessage(errorMessage);
  formatErrorMessageByType(message, lines, errorData);

  addCorrelationId(lines, errorData);

  return lines.join('\n');
}

module.exports = {
  formatNetworkError
};
