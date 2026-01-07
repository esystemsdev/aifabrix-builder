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
 * @param {string} [errorData.controllerUrl] - Controller URL
 * @returns {string} Formatted network error message
 */
function formatNetworkError(errorMessage, errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Network Error\n'));

  // Show controller URL prominently if available
  if (errorData && errorData.controllerUrl) {
    lines.push(chalk.yellow(`Controller URL: ${errorData.controllerUrl}`));
    lines.push('');
  }

  // Ensure errorMessage is a string
  const message = typeof errorMessage === 'string' ? errorMessage : String(errorMessage || 'Network error');

  if (message.includes('ECONNREFUSED') || message.includes('Cannot connect')) {
    lines.push(chalk.yellow('Cannot connect to controller.'));
    if (errorData && errorData.controllerUrl) {
      lines.push(chalk.gray(`Controller URL: ${errorData.controllerUrl}`));
    }
    lines.push(chalk.gray('Check if the controller is running.'));
  } else if (message.includes('ENOTFOUND') || message.includes('hostname not found')) {
    lines.push(chalk.yellow('Controller hostname not found.'));
    if (errorData && errorData.controllerUrl) {
      lines.push(chalk.gray(`Controller URL: ${errorData.controllerUrl}`));
    }
    lines.push(chalk.gray('Check your controller URL.'));
  } else if (message.includes('timeout') || message.includes('timed out')) {
    lines.push(chalk.yellow('Request timed out.'));
    if (errorData && errorData.controllerUrl) {
      lines.push(chalk.gray(`Controller URL: ${errorData.controllerUrl}`));
    }
    lines.push(chalk.gray('The controller may be overloaded.'));
  } else {
    lines.push(chalk.yellow(message));
  }

  if (errorData && errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

module.exports = {
  formatNetworkError
};
