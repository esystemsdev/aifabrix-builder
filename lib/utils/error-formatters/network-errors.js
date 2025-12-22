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
 * Formats network error
 * @param {string} errorMessage - Error message
 * @param {Object} errorData - Error response data (optional)
 * @returns {string} Formatted network error message
 */
function formatNetworkError(errorMessage, errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Network Error\n'));

  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Cannot connect')) {
    lines.push(chalk.yellow('Cannot connect to controller.'));
    lines.push(chalk.gray('Check if the controller is running.'));
  } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('hostname not found')) {
    lines.push(chalk.yellow('Controller hostname not found.'));
    lines.push(chalk.gray('Check your controller URL.'));
  } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    lines.push(chalk.yellow('Request timed out.'));
    lines.push(chalk.gray('The controller may be overloaded.'));
  } else {
    lines.push(chalk.yellow(errorMessage));
  }

  if (errorData && errorData.correlationId) {
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

module.exports = {
  formatNetworkError
};

