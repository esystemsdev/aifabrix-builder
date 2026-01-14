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
 * Format already formatted error message
 * @param {string} formatted - Formatted error message
 * @returns {string[]} Array of error message lines
 */
function formatFormattedError(formatted) {
  const messages = [];
  const lines = formatted.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      messages.push(`   ${line}`);
    }
  });
  return messages;
}

/**
 * Checks if error is about Docker image not found
 * @function isDockerImageNotFoundError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if Docker image not found error
 */
function isDockerImageNotFoundError(errorMsg) {
  return errorMsg.includes('not found locally') ||
    (errorMsg.includes('Docker image') && errorMsg.includes('not found'));
}

/**
 * Checks if error is about Docker not running/installed
 * @function isDockerNotRunningError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if Docker not running error
 */
function isDockerNotRunningError(errorMsg) {
  return errorMsg.includes('Docker') &&
    (errorMsg.includes('not running') || errorMsg.includes('not installed') || errorMsg.includes('Cannot connect'));
}

/**
 * Checks if error is about port conflict
 * @function isPortConflictError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if port conflict error
 */
function isPortConflictError(errorMsg) {
  return errorMsg.toLowerCase().includes('port') &&
    (errorMsg.includes('already in use') || errorMsg.includes('in use') || errorMsg.includes('conflict'));
}

/**
 * Checks if error is about permission denied (excluding permissions field)
 * @function isPermissionDeniedError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if permission denied error
 */
function isPermissionDeniedError(errorMsg) {
  return (errorMsg.includes('permission denied') || errorMsg.includes('EACCES') || errorMsg.includes('Permission denied')) &&
    !errorMsg.includes('permissions/') &&
    !errorMsg.includes('Field "permissions');
}

/**
 * Format Docker-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a Docker error
 */
function formatDockerError(errorMsg) {
  if (isDockerImageNotFoundError(errorMsg)) {
    return [
      '   Docker image not found.',
      '   Run: aifabrix build <app> first'
    ];
  }
  if (isDockerNotRunningError(errorMsg)) {
    return [
      '   Docker is not running or not installed.',
      '   Please start Docker Desktop and try again.'
    ];
  }
  if (isPortConflictError(errorMsg)) {
    return [
      '   Port conflict detected.',
      '   Run "aifabrix doctor" to check which ports are in use.'
    ];
  }
  if (isPermissionDeniedError(errorMsg)) {
    return [
      '   Permission denied.',
      '   Make sure you have the necessary permissions to run Docker commands.'
    ];
  }
  return null;
}

/**
 * Format Azure-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not an Azure error
 */
function formatAzureError(errorMsg) {
  if (errorMsg.includes('Azure CLI is not installed') || errorMsg.includes('az --version failed') || (errorMsg.includes('az') && errorMsg.includes('failed'))) {
    return [
      '   Azure CLI is not installed or not working properly.',
      '   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli',
      '   Run: az login'
    ];
  }
  if (errorMsg.includes('Invalid ACR URL') || errorMsg.includes('Invalid registry URL') || errorMsg.includes('Expected format')) {
    return [
      '   Invalid registry URL format.',
      '   Use format: *.azurecr.io (e.g., myacr.azurecr.io)'
    ];
  }
  if (errorMsg.includes('authenticate') || errorMsg.includes('ACR') || errorMsg.includes('Authentication required')) {
    return [
      '   Azure Container Registry authentication failed.',
      '   Run: az acr login --name <registry-name>',
      '   Or login to Azure: az login'
    ];
  }
  if (errorMsg.includes('Registry URL is required')) {
    return [
      '   Registry URL is required.',
      '   Provide via --registry flag or configure in variables.yaml under image.registry'
    ];
  }
  return null;
}

/**
 * Format secrets-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a secrets error
 */
function formatSecretsError(errorMsg) {
  if (!errorMsg.includes('Missing secrets')) {
    return null;
  }

  const messages = [];
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

  if (resolveMatch) {
    messages.push(`   Run: aifabrix resolve ${resolveMatch[1]} to generate missing secrets.`);
  } else {
    messages.push('   Run: aifabrix resolve <app-name> to generate missing secrets.');
  }

  return messages;
}

/**
 * Format deployment-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a deployment error
 */
function formatDeploymentError(errorMsg) {
  if (!errorMsg.includes('Deployment failed after')) {
    return null;
  }

  const match = errorMsg.match(/Deployment failed after \d+ attempts: (.+)/);
  if (match) {
    return [`   ${match[1]}`];
  }
  return [`   ${errorMsg}`];
}

/**
 * Format validation errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a validation error
 */
function formatValidationError(errorMsg) {
  if (errorMsg.includes('Configuration not found') ||
      errorMsg.includes('does not match schema') ||
      errorMsg.includes('Validation failed') ||
      errorMsg.includes('Field "') ||
      errorMsg.includes('Invalid format')) {
    return [`   ${errorMsg}`];
  }
  return null;
}

/**
 * Formats error message based on error type
 * @function formatError
 * @param {Error} error - The error that occurred
 * @returns {string[]} Array of error message lines
 */
/**
 * Tries to format error using specific formatters
 * @function tryFormatErrorWithFormatters
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Formatted error messages or null if no formatter matched
 */
function tryFormatErrorWithFormatters(errorMsg) {
  const formatters = [
    formatDockerError,
    formatAzureError,
    formatSecretsError,
    formatDeploymentError,
    formatValidationError
  ];

  for (const formatter of formatters) {
    const formatted = formatter(errorMsg);
    if (formatted) {
      return formatted;
    }
  }

  return null;
}

function formatError(error) {
  // If error has formatted message (from API error handler), use it directly
  if (error.formatted) {
    return formatFormattedError(error.formatted);
  }

  const errorMsg = error.message || '';

  // Try different error formatters in order of specificity
  const formatted = tryFormatErrorWithFormatters(errorMsg);
  if (formatted) {
    return formatted;
  }

  // Default: return generic error message
  return [`   ${errorMsg}`];
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

