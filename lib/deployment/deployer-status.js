/**
 * Deployment status and polling helpers for deployer.
 *
 * @fileoverview Deployment status checks and polling utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');

/**
 * Checks if deployment status is terminal
 * @param {string} status - Deployment status
 * @returns {boolean} True if status is terminal
 */
function isTerminalStatus(status) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Convert authConfig to pipeline auth config format
 * @param {Object} authConfig - Authentication configuration
 * @returns {Object} Pipeline auth config
 */
function convertToPipelineAuthConfig(authConfig) {
  return authConfig.type === 'bearer'
    ? { type: 'bearer', token: authConfig.token }
    : { type: 'client-credentials', clientId: authConfig.clientId, clientSecret: authConfig.clientSecret };
}

/**
 * Handles error response from deployment status check
 * @param {Object} response - API response
 * @param {string} deploymentId - Deployment ID
 * @throws {Error} Appropriate error message
 */
function handleDeploymentStatusError(response, deploymentId) {
  if (response.status === 404) {
    throw new Error(`Deployment ${deploymentId || response.deploymentId || 'unknown'} not found`);
  }
  throw new Error(`Status check failed: ${response.formattedError || response.error || 'Unknown error'}`);
}

/**
 * Extracts deployment data from response
 * @param {Object} response - API response
 * @returns {Object} Deployment data
 */
function extractDeploymentData(response) {
  const responseData = response.data;
  return responseData.data || responseData;
}

/**
 * Logs deployment progress
 * @param {Object} deploymentData - Deployment data
 * @param {number} attempt - Current attempt
 * @param {number} maxAttempts - Maximum attempts
 */
function logDeploymentProgress(deploymentData, attempt, maxAttempts) {
  const status = deploymentData.status;
  const progress = deploymentData.progress || 0;
  logger.log(chalk.blue(`   Status: ${status} (${progress}%) (attempt ${attempt + 1}/${maxAttempts})`));
}

/**
 * Process deployment status response
 * @param {Object} response - API response
 * @param {number} attempt - Current attempt number
 * @param {number} maxAttempts - Maximum attempts
 * @param {number} interval - Polling interval
 * @param {string} deploymentId - Deployment ID for error messages
 * @returns {Promise<Object|null>} Deployment data if terminal, null if needs to continue polling
 */
async function processDeploymentStatusResponse(response, attempt, maxAttempts, interval, deploymentId) {
  if (!response.success || !response.data) {
    handleDeploymentStatusError(response, deploymentId);
  }

  const deploymentData = extractDeploymentData(response);
  if (isTerminalStatus(deploymentData.status)) {
    return deploymentData;
  }

  logDeploymentProgress(deploymentData, attempt, maxAttempts);
  if (attempt < maxAttempts - 1) {
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return null;
}

module.exports = {
  isTerminalStatus,
  convertToPipelineAuthConfig,
  handleDeploymentStatusError,
  extractDeploymentData,
  logDeploymentProgress,
  processDeploymentStatusResponse
};
