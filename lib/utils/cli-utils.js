/**
 * CLI Utility Functions
 *
 * Utility functions for CLI command handling and validation.
 *
 * @fileoverview CLI utilities for error handling and validation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const logger = require('./logger');

/**
 * Validates a command and its options
 * @param {string} _command - Command name
 * @param {Object} _options - Command options
 * @returns {boolean} True if valid
 */
function validateCommand(_command, _options) {
  // TODO: Implement command validation
  // TODO: Add helpful error messages for common issues
  return true;
}

/**
 * Formats error message based on error type
 * @function formatError
 * @param {Error} error - The error that occurred
 * @returns {string[]} Array of error message lines
 */
function formatError(error) {
  const messages = [];
  const errorMsg = error.message || '';

  // Check for specific error patterns first (most specific to least specific)
  if (errorMsg.includes('Configuration not found')) {
    messages.push(`   ${errorMsg}`);
  } else if (errorMsg.includes('not found locally') || (errorMsg.includes('Docker image') && errorMsg.includes('not found'))) {
    messages.push('   Docker image not found.');
    messages.push('   Run: aifabrix build <app> first');
  } else if (errorMsg.includes('Docker') && (errorMsg.includes('not running') || errorMsg.includes('not installed') || errorMsg.includes('Cannot connect'))) {
    messages.push('   Docker is not running or not installed.');
    messages.push('   Please start Docker Desktop and try again.');
  } else if (errorMsg.includes('port')) {
    messages.push('   Port conflict detected.');
    messages.push('   Run "aifabrix doctor" to check which ports are in use.');
  } else if (errorMsg.includes('permission')) {
    messages.push('   Permission denied.');
    messages.push('   Make sure you have the necessary permissions to run Docker commands.');
  } else if (errorMsg.includes('Azure CLI') || errorMsg.includes('az --version')) {
    messages.push('   Azure CLI is not installed.');
    messages.push('   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
    messages.push('   Run: az login');
  } else if (errorMsg.includes('authenticate') || errorMsg.includes('ACR')) {
    messages.push('   Azure Container Registry authentication failed.');
    messages.push('   Run: az acr login --name <registry-name>');
    messages.push('   Or login to Azure: az login');
  } else if (errorMsg.includes('Invalid ACR URL') || errorMsg.includes('Expected format')) {
    messages.push('   Invalid registry URL format.');
    messages.push('   Use format: *.azurecr.io (e.g., myacr.azurecr.io)');
  } else if (errorMsg.includes('Registry URL is required')) {
    messages.push('   Registry URL is required.');
    messages.push('   Provide via --registry flag or configure in variables.yaml under image.registry');
  } else {
    messages.push(`   ${errorMsg}`);
  }

  return messages;
}

/**
 * Logs error messages
 * @function logError
 * @param {string} command - Command that failed
 * @param {string[]} errorMessages - Error message lines
 */
function logError(command, errorMessages) {
  logger.error(`\n❌ Error in ${command} command:`);
  errorMessages.forEach(msg => logger.error(msg));
  logger.error('\n💡 Run "aifabrix doctor" for environment diagnostics.\n');
}

/**
 * Handles command errors with user-friendly messages
 * @param {Error} error - The error that occurred
 * @param {string} command - Command that failed
 */
function handleCommandError(error, command) {
  const errorMessages = formatError(error);
  logError(command, errorMessages);
}

module.exports = {
  validateCommand,
  handleCommandError
};

