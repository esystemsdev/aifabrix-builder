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
 * Handles command errors with user-friendly messages
 * @param {Error} error - The error that occurred
 * @param {string} command - Command that failed
 */
function handleCommandError(error, command) {
  logger.error(`\n❌ Error in ${command} command:`);

  // Provide specific error messages for common issues
  if (error.message.includes('Docker')) {
    logger.error('   Docker is not running or not installed.');
    logger.error('   Please start Docker Desktop and try again.');
  } else if (error.message.includes('port')) {
    logger.error('   Port conflict detected.');
    logger.error('   Run "aifabrix doctor" to check which ports are in use.');
  } else if (error.message.includes('permission')) {
    logger.error('   Permission denied.');
    logger.error('   Make sure you have the necessary permissions to run Docker commands.');
  } else if (error.message.includes('Azure CLI') || error.message.includes('az --version')) {
    logger.error('   Azure CLI is not installed.');
    logger.error('   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
    logger.error('   Run: az login');
  } else if (error.message.includes('authenticate') || error.message.includes('ACR')) {
    logger.error('   Azure Container Registry authentication failed.');
    logger.error('   Run: az acr login --name <registry-name>');
    logger.error('   Or login to Azure: az login');
  } else if (error.message.includes('not found locally') || error.message.includes('not found')) {
    logger.error('   Docker image not found.');
    logger.error('   Run: aifabrix build <app> first');
  } else if (error.message.includes('Invalid ACR URL') || error.message.includes('Expected format')) {
    logger.error('   Invalid registry URL format.');
    logger.error('   Use format: *.azurecr.io (e.g., myacr.azurecr.io)');
  } else if (error.message.includes('Registry URL is required')) {
    logger.error('   Registry URL is required.');
    logger.error('   Provide via --registry flag or configure in variables.yaml under image.registry');
  } else {
    logger.error(`   ${error.message}`);
  }

  logger.error('\n💡 Run "aifabrix doctor" for environment diagnostics.\n');
}

module.exports = {
  validateCommand,
  handleCommandError
};

