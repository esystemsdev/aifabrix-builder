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
/**
 * Handles registration API error response
 * @function handleRegistrationError
 * @param {Object} response - API response
 * @param {string} apiUrl - Controller URL
 * @param {Object} registrationData - Registration data
 */
function handleRegistrationError(response, apiUrl, registrationData) {
  const formattedError = response.formattedError || formatApiError(response, apiUrl);
  logger.error(formattedError);
  logger.error(chalk.gray(`\nController URL: ${apiUrl}`));

  // For validation errors (400, 422), show the request payload for debugging
  if (response.status === 400 || response.status === 422) {
    logger.error(chalk.gray('\nRequest payload:'));
    logger.error(chalk.gray(JSON.stringify(registrationData, null, 2)));
    logger.error('');
    logger.error(chalk.gray('Check your variables.yaml file and ensure all required fields are correctly set.'));
  }

  process.exit(1);
}

/**
 * Extracts application data from API response
 * @function extractApplicationData
 * @param {Object} response - API response
 * @param {string} apiUrl - Controller URL
 * @returns {Object} Application data
 * @throws {Error} If response format is invalid
 */
function extractApplicationData(response, apiUrl) {
  const apiResponse = response.data;

  // Handle API response structure:
  // registerApplication returns: { success: true, data: <API response> }
  // API response can be:
  // 1. Direct format: { application: {...}, credentials: {...} }
  // 2. Wrapped format: { success: true, data: { application: {...}, credentials: {...} } }
  if (apiResponse && apiResponse.data && apiResponse.data.application) {
    // Wrapped format: use apiResponse.data
    return apiResponse.data;
  }

  if (apiResponse && apiResponse.application) {
    // Direct format: use apiResponse directly
    return apiResponse;
  }

  // Fallback: return apiResponse as-is (shouldn't happen, but handle gracefully)
  logger.error(chalk.red('❌ Invalid response: missing application data'));
  logger.error(chalk.gray(`\nController URL: ${apiUrl}`));
  logger.error(chalk.gray('\nFull response for debugging:'));
  logger.error(chalk.gray(JSON.stringify(response, null, 2)));
  process.exit(1);
}

async function callRegisterApi(apiUrl, token, environment, registrationData) {
  // Use centralized API client
  const authConfig = { type: 'bearer', token: token };
  try {
    const response = await registerApplication(apiUrl, environment, authConfig, registrationData);

    if (!response.success) {
      handleRegistrationError(response, apiUrl, registrationData);
      return; // Never reached, but satisfies linter
    }

    return extractApplicationData(response, apiUrl);
  } catch (error) {
    // Include controller URL in error context
    logger.error(chalk.red('❌ Registration API call failed'));
    logger.error(chalk.gray(`Controller URL: ${apiUrl}`));
    logger.error(chalk.gray(`Error: ${error.message}`));
    throw error;
  }
}

module.exports = { callRegisterApi };

