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

  // If error has formatted message (from API error handler), use it directly
  if (error.formatted) {
    // Split formatted message into lines and add proper indentation
    const lines = error.formatted.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        messages.push(`   ${line}`);
      }
    });
    return messages;
  }

  const errorMsg = error.message || '';

  // Check for specific error patterns first (most specific to least specific)
  if (errorMsg.includes('Configuration not found')) {
    messages.push(`   ${errorMsg}`);
  } else if (errorMsg.includes('does not match schema') || errorMsg.includes('Validation failed') || errorMsg.includes('Field "') || errorMsg.includes('Invalid format')) {
    // Schema validation errors - show the actual error message
    messages.push(`   ${errorMsg}`);
  } else if (errorMsg.includes('not found locally') || (errorMsg.includes('Docker image') && errorMsg.includes('not found'))) {
    messages.push('   Docker image not found.');
    messages.push('   Run: aifabrix build <app> first');
  } else if (errorMsg.includes('Docker') && (errorMsg.includes('not running') || errorMsg.includes('not installed') || errorMsg.includes('Cannot connect'))) {
    messages.push('   Docker is not running or not installed.');
    messages.push('   Please start Docker Desktop and try again.');
  } else if (errorMsg.toLowerCase().includes('port') && (errorMsg.includes('already in use') || errorMsg.includes('in use') || errorMsg.includes('conflict'))) {
    messages.push('   Port conflict detected.');
    messages.push('   Run "aifabrix doctor" to check which ports are in use.');
  } else if ((errorMsg.includes('permission denied') || errorMsg.includes('EACCES') || errorMsg.includes('Permission denied')) && !errorMsg.includes('permissions/') && !errorMsg.includes('Field "permissions')) {
    // Only match actual permission denied errors, not validation errors about permissions fields
    messages.push('   Permission denied.');
    messages.push('   Make sure you have the necessary permissions to run Docker commands.');
  } else if (errorMsg.includes('Azure CLI is not installed') || errorMsg.includes('az --version failed') || (errorMsg.includes('az') && errorMsg.includes('failed'))) {
    // Specific error for missing Azure CLI installation or Azure CLI command failures
    messages.push('   Azure CLI is not installed or not working properly.');
    messages.push('   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
    messages.push('   Run: az login');
  } else if (errorMsg.includes('Invalid ACR URL') || errorMsg.includes('Invalid registry URL') || errorMsg.includes('Expected format')) {
    messages.push('   Invalid registry URL format.');
    messages.push('   Use format: *.azurecr.io (e.g., myacr.azurecr.io)');
  } else if (errorMsg.includes('authenticate') || errorMsg.includes('ACR') || errorMsg.includes('Authentication required')) {
    messages.push('   Azure Container Registry authentication failed.');
    messages.push('   Run: az acr login --name <registry-name>');
    messages.push('   Or login to Azure: az login');
  } else if (errorMsg.includes('Registry URL is required')) {
    messages.push('   Registry URL is required.');
    messages.push('   Provide via --registry flag or configure in variables.yaml under image.registry');
  } else if (errorMsg.includes('Missing secrets')) {
    // Extract the missing secrets list and file info from the error message
    const missingSecretsMatch = errorMsg.match(/Missing secrets: ([^\n]+)/);
    const fileInfoMatch = errorMsg.match(/Secrets file location: ([^\n]+)/);
    const resolveMatch = errorMsg.match(/Run "aifabrix resolve ([^"]+)"/);

    if (missingSecretsMatch) {
      messages.push(`   Missing secrets: ${missingSecretsMatch[1]}`);
    } else {
      messages.push('   Missing secrets in secrets file.');
    }

    if (fileInfoMatch) {
      messages.push(`   Secrets file location: ${fileInfoMatch[1]}`);
    }

    // Always show resolve command suggestion
    if (resolveMatch) {
      // Extract app name from error message if available
      messages.push(`   Run: aifabrix resolve ${resolveMatch[1]} to generate missing secrets.`);
    } else {
      // Generic suggestion if app name not in error message
      messages.push('   Run: aifabrix resolve <app-name> to generate missing secrets.');
    }
  } else if (errorMsg.includes('Deployment failed after')) {
    // Handle deployment retry errors - extract the actual error message
    const match = errorMsg.match(/Deployment failed after \d+ attempts: (.+)/);
    if (match) {
      messages.push(`   ${match[1]}`);
    } else {
      messages.push(`   ${errorMsg}`);
    }
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

