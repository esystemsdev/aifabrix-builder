/**
 * Login Credentials Handling
 *
 * Handles credentials-based authentication flow
 *
 * @fileoverview Credentials login handling for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const { getToken } = require('../api/auth.api');
const { formatApiError } = require('../utils/api-error-handler');
const { loadClientCredentials } = require('../utils/token-manager');
const logger = require('../utils/logger');

/**
 * Tries to load credentials from secrets file
 * @async
 * @function tryLoadCredentialsFromSecrets
 * @param {string} appName - Application name
 * @returns {Promise<Object|null>} Credentials or null
 */
async function tryLoadCredentialsFromSecrets(appName) {
  if (!appName) {
    return null;
  }
  const credentials = await loadClientCredentials(appName);
  if (!credentials) {
    logger.log(chalk.yellow(`⚠️  Credentials not found in secrets.local.yaml for app '${appName}'`));
    logger.log(chalk.gray(`   Looking for: '${appName}-client-idKeyVault' and '${appName}-client-secretKeyVault'`));
    logger.log(chalk.gray('   Prompting for credentials...\n'));
  }
  return credentials;
}

/**
 * Prompt for credentials if not provided
 * @async
 * @param {string} [clientId] - Existing client ID
 * @param {string} [clientSecret] - Existing client secret
 * @returns {Promise<{clientId: string, clientSecret: string}>} Credentials
 */
async function promptForCredentials(clientId, clientSecret) {
  if (clientId && clientSecret) {
    return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
  }

  const credentials = await inquirer.prompt([
    {
      type: 'input',
      name: 'clientId',
      message: 'Client ID:',
      default: clientId || '',
      validate: (input) => {
        const value = input ? input.trim() : '';
        if (!value || value.length === 0) {
          return 'Client ID is required';
        }
        return true;
      }
    },
    {
      type: 'password',
      name: 'clientSecret',
      message: 'Client Secret:',
      default: clientSecret || '',
      mask: '*',
      validate: (input) => {
        const value = input ? input.trim() : '';
        if (!value || value.length === 0) {
          return 'Client Secret is required';
        }
        return true;
      }
    }
  ]);

  return {
    clientId: (credentials.clientId || '').trim(),
    clientSecret: (credentials.clientSecret || '').trim()
  };
}

/**
 * Gets credentials from secrets or prompts user
 * @async
 * @function getCredentialsForLogin
 * @param {string} appName - Application name
 * @param {string} clientId - Optional client ID
 * @param {string} clientSecret - Optional client secret
 * @returns {Promise<Object>} Credentials object
 */
async function getCredentialsForLogin(appName, clientId, clientSecret) {
  let credentials = null;

  // Try to load from secrets.local.yaml if appName provided and credentials not provided
  if (appName && !clientId && !clientSecret) {
    credentials = await tryLoadCredentialsFromSecrets(appName);
  }

  // If still no credentials, prompt for them
  if (!credentials) {
    credentials = await promptForCredentials(clientId, clientSecret);
  }

  return credentials;
}

/**
 * Handles login error response
 * @function handleLoginError
 * @param {Object} response - API response
 * @param {string} appName - Application name
 */
function handleLoginError(response, appName) {
  const formattedError = response.formattedError || formatApiError(response);
  logger.error(formattedError);

  // Provide additional context for login failures
  if (response.status === 401) {
    logger.log(chalk.gray('\n💡 Tip: Verify your client credentials are correct.'));
    logger.log(chalk.gray('   Check secrets.local.yaml for:'));
    logger.log(chalk.gray(`   - ${appName}-client-idKeyVault`));
    logger.log(chalk.gray(`   - ${appName}-client-secretKeyVault`));
  }

  process.exit(1);
}

/**
 * Extracts token data from API response
 * @function extractTokenData
 * @param {Object} response - API response
 * @returns {Object} Token data object
 */
function extractTokenData(response) {
  // OpenAPI spec response: { success: boolean, token: string, expiresIn: number, expiresAt: string, ... }
  // Handle both flat and nested response structures (some APIs wrap in data field)
  // If response.data exists, use it; otherwise use response directly
  const apiResponse = response.data || response;
  const responseData = apiResponse.data || apiResponse;

  if (!responseData || !responseData.token) {
    logger.error(chalk.red('❌ Invalid response: missing token'));
    if (responseData) {
      logger.error(chalk.gray(`Response structure: ${JSON.stringify(responseData, null, 2)}`));
    }
    process.exit(1);
  }

  return responseData;
}

/**
 * Calculates token expiration timestamp
 * @function calculateTokenExpiration
 * @param {Object} responseData - Response data with expiration info
 * @returns {string} ISO timestamp
 */
function calculateTokenExpiration(responseData) {
  // Calculate expiration (use expiresAt if provided, otherwise calculate from expiresIn, default to 24 hours)
  if (responseData.expiresAt) {
    return responseData.expiresAt;
  }
  if (responseData.expiresIn) {
    return new Date(Date.now() + responseData.expiresIn * 1000).toISOString();
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Handle credentials-based login
 * Uses OpenAPI /api/v1/auth/token endpoint with x-client-id and x-client-secret headers
 * Reads credentials from secrets.local.yaml using pattern <app-name>-client-idKeyVault
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} appName - Application name
 * @param {string} [clientId] - Client ID from options (optional, overrides secrets.local.yaml)
 * @param {string} [clientSecret] - Client Secret from options (optional, overrides secrets.local.yaml)
 * @returns {Promise<{token: string, expiresAt: string}>} Authentication token and expiration
 */
async function handleCredentialsLogin(controllerUrl, appName, clientId, clientSecret) {
  const credentials = await getCredentialsForLogin(appName, clientId, clientSecret);

  // Use centralized API client for token generation
  const response = await getToken(credentials.clientId, credentials.clientSecret, controllerUrl);

  if (!response.success) {
    handleLoginError(response, appName);
  }

  const responseData = extractTokenData(response);
  const expiresAt = calculateTokenExpiration(responseData);

  return {
    token: responseData.token,
    expiresAt: expiresAt
  };
}

module.exports = {
  handleCredentialsLogin,
  getCredentialsForLogin,
  promptForCredentials,
  tryLoadCredentialsFromSecrets
};

