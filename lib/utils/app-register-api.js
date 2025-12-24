/**
 * AI Fabrix Builder - App Register API Utilities
 *
 * API call utilities for application registration
 *
 * @fileoverview API utilities for app registration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');
const { registerApplication } = require('../api/applications.api');
const { formatApiError } = require('./api-error-handler');

/**
 * Call registration API
 * @async
 * @param {string} apiUrl - API URL
 * @param {string} token - Authentication token
 * @param {string} environment - Environment ID
 * @param {Object} registrationData - Registration data
 * @returns {Promise<Object>} API response
 */
async function callRegisterApi(apiUrl, token, environment, registrationData) {
  // Use centralized API client
  const authConfig = { type: 'bearer', token: token };
  const response = await registerApplication(apiUrl, environment, authConfig, registrationData);

  if (!response.success) {
    const formattedError = response.formattedError || formatApiError(response);
    logger.error(formattedError);

    // For validation errors (400, 422), show the request payload for debugging
    if (response.status === 400 || response.status === 422) {
      logger.error(chalk.gray('\nRequest payload:'));
      logger.error(chalk.gray(JSON.stringify(registrationData, null, 2)));
      logger.error('');
      logger.error(chalk.gray('Check your variables.yaml file and ensure all required fields are correctly set.'));
    }

    process.exit(1);
  }

  // Handle API response structure:
  // registerApplication returns: { success: true, data: <API response> }
  // API response can be:
  // 1. Direct format: { application: {...}, credentials: {...} }
  // 2. Wrapped format: { success: true, data: { application: {...}, credentials: {...} } }
  const apiResponse = response.data;
  if (apiResponse && apiResponse.data && apiResponse.data.application) {
    // Wrapped format: use apiResponse.data
    return apiResponse.data;
  } else if (apiResponse && apiResponse.application) {
    // Direct format: use apiResponse directly
    return apiResponse;
  }
  // Fallback: return apiResponse as-is (shouldn't happen, but handle gracefully)
  logger.error(chalk.red('❌ Invalid response: missing application data'));
  logger.error(chalk.gray('\nFull response for debugging:'));
  logger.error(chalk.gray(JSON.stringify(response, null, 2)));
  process.exit(1);
}

module.exports = { callRegisterApi };

