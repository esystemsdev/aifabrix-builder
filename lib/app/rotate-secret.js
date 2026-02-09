/**
 * AI Fabrix Builder - App Rotate Secret Command
 *
 * Handles rotating pipeline ClientSecret for an application
 *
 * @fileoverview App rotate-secret command implementation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { getConfig, normalizeControllerUrl, resolveEnvironment, clearClientToken } = require('../core/config');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { rotateApplicationSecret } = require('../api/applications.api');
const { formatApiError } = require('../utils/api-error-handler');
const { formatAuthenticationError } = require('../utils/error-formatters/http-status-errors');
const logger = require('../utils/logger');
const { saveLocalSecret, isLocalhost } = require('../utils/local-secrets');
const { updateEnvTemplate } = require('../utils/env-template');
const { getEnvironmentPrefix } = require('./register');
const { generateEnvFile } = require('../core/secrets');

/**
 * Find device token from config by trying each stored URL
 * @async
 * @param {Object} deviceConfig - Device configuration object
 * @returns {Promise<Object|null>} Token result with token and controllerUrl, or null if not found
 */
async function findDeviceTokenFromConfig(deviceConfig) {
  const deviceUrls = Object.keys(deviceConfig);
  if (deviceUrls.length === 0) {
    return null;
  }

  for (const storedUrl of deviceUrls) {
    try {
      const normalizedStoredUrl = normalizeControllerUrl(storedUrl);
      const deviceToken = await getOrRefreshDeviceToken(normalizedStoredUrl);
      if (deviceToken && deviceToken.token) {
        return {
          token: deviceToken.token,
          controllerUrl: deviceToken.controller || normalizedStoredUrl
        };
      }
    } catch (error) {
      // Continue to next URL
    }
  }

  return null;
}

/**
 * Validate environment parameter
 * @param {string} environment - Environment ID or key
 * @throws {Error} If environment is invalid
 */
function validateEnvironment(environment) {
  if (!environment || environment.length < 1) {
    throw new Error('Environment is required');
  }
}

/**
 * Resolve controller URL and environment from config; exit if controller is missing.
 * @async
 * @returns {Promise<{controllerUrl: string, environment: string}>}
 */
async function resolveControllerAndEnvironment() {
  const controllerUrl = await resolveControllerUrl();
  if (!controllerUrl) {
    logger.error(chalk.red('❌ Controller URL is required. Run "aifabrix login" to set the controller URL in config.yaml'));
    process.exit(1);
  }
  const environment = await resolveEnvironment();
  validateEnvironment(environment);
  return { controllerUrl, environment };
}

/**
 * Validate credentials object structure
 * @param {Object} credentials - Credentials object to validate
 * @returns {boolean} True if credentials are valid
 */
function isValidCredentials(credentials) {
  return credentials &&
    typeof credentials === 'object' &&
    typeof credentials.clientId === 'string' &&
    typeof credentials.clientSecret === 'string';
}

/**
 * Extract credentials from API response
 * Handles multiple response formats:
 * 1. Direct format: { success: true, data: { credentials: {...} } }
 * 2. Wrapped format: { success: true, data: { success: true, data: { credentials: {...} } } }
 * @param {Object} response - API response from centralized API client
 * @returns {Object|null} Object with credentials and message, or null if not found
 */
function extractCredentials(response) {
  // Note: response.data is already validated in validateResponse
  const apiResponse = response.data;

  // Try wrapped format first: response.data.data.credentials
  if (apiResponse.data && apiResponse.data.credentials) {
    const credentials = apiResponse.data.credentials;
    if (isValidCredentials(credentials)) {
      return {
        credentials: credentials,
        message: apiResponse.data.message || apiResponse.message
      };
    }
  }

  // Try direct format: response.data.credentials
  if (apiResponse.credentials) {
    const credentials = apiResponse.credentials;
    if (isValidCredentials(credentials)) {
      return {
        credentials: credentials,
        message: apiResponse.message
      };
    }
  }

  return null;
}

/**
 * Validate API response structure
 * @param {Object} response - API response
 * @returns {Object} Object with credentials and message
 * @throws {Error} If response structure is invalid
 */
function validateResponse(response) {
  if (!response.data || typeof response.data !== 'object') {
    logger.error(chalk.red('❌ Invalid response: missing data'));
    logger.error(chalk.gray('\nAPI response type:'), typeof response.data);
    logger.error(chalk.gray('API response:'), JSON.stringify(response.data, null, 2));
    logger.error(chalk.gray('\nFull response for debugging:'));
    logger.error(chalk.gray(JSON.stringify(response, null, 2)));
    throw new Error('Invalid response: missing data');
  }

  const result = extractCredentials(response);

  if (!result) {
    logger.error(chalk.red('❌ Invalid response: missing or invalid credentials'));
    logger.error(chalk.gray('\nAPI response type:'), typeof response.data);
    logger.error(chalk.gray('API response:'), JSON.stringify(response.data, null, 2));
    logger.error(chalk.gray('\nFull response for debugging:'));
    logger.error(chalk.gray(JSON.stringify(response, null, 2)));
    throw new Error('Invalid response: missing or invalid credentials');
  }

  return result;
}

/**
 * Display rotation results
 * @param {string} appKey - Application key
 * @param {string} environment - Environment ID or key
 * @param {Object} credentials - New credentials
 * @param {string} apiUrl - API URL
 * @param {string} [message] - Optional message from API
 */
function displayRotationResults(appKey, environment, credentials, apiUrl, message) {
  logger.log(chalk.green('✅ Secret rotated successfully!\n'));
  logger.log(chalk.bold('📋 Application Details:'));
  logger.log(`   Key:         ${appKey}`);
  logger.log(`   Environment: ${environment}`);
  logger.log(`   Controller:  ${apiUrl}\n`);

  logger.log(chalk.bold.yellow('🔑 NEW CREDENTIALS:'));
  logger.log(chalk.yellow(`   Client ID:     ${credentials.clientId}`));
  logger.log(chalk.yellow(`   Client Secret: ${credentials.clientSecret}\n`));

  const envPrefix = getEnvironmentPrefix(environment);
  logger.log(chalk.bold('📝 Update GitHub Secrets:'));
  logger.log(chalk.cyan('   Repository level:'));
  logger.log(chalk.cyan(`     MISO_CONTROLLER_URL = ${apiUrl}`));
  logger.log(chalk.cyan(`\n   Environment level (${environment}):`));
  logger.log(chalk.cyan(`     ${envPrefix}_MISO_CLIENTID = ${credentials.clientId}`));
  logger.log(chalk.cyan(`     ${envPrefix}_MISO_CLIENTSECRET = ${credentials.clientSecret}\n`));

  if (message) {
    logger.log(chalk.gray(`   ${message}\n`));
  }
}

/**
 * Get device token from provided controller URL
 * @async
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<Object|null>} Object with token and controllerUrl, or null if failed
 */
async function getTokenFromUrl(controllerUrl) {
  try {
    const normalizedUrl = normalizeControllerUrl(controllerUrl);
    const deviceToken = await getOrRefreshDeviceToken(normalizedUrl);
    if (deviceToken && deviceToken.token) {
      return {
        token: deviceToken.token,
        controllerUrl: deviceToken.controller || normalizedUrl
      };
    }
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to authenticate with controller: ${controllerUrl}`));
    logger.error(chalk.gray(`Error: ${error.message}`));
    process.exit(1);
  }
  return null;
}

/**
 * Validate and handle missing authentication token
 * @param {string|null} token - Authentication token
 * @param {string|null} controllerUrl - Controller URL
 * @param {string} [providedUrl] - Original provided URL for error context
 */
function validateAuthToken(token, controllerUrl, providedUrl) {
  if (!token || !controllerUrl) {
    const formattedError = formatAuthenticationError({
      controllerUrl: providedUrl || undefined,
      message: 'No valid authentication found'
    });
    logger.error(formattedError);
    process.exit(1);
  }
}

/**
 * Get authentication token for rotation
 * @async
 * @param {string} [controllerUrl] - Optional controller URL
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Object with token and actualControllerUrl
 * @throws {Error} If authentication fails
 */
async function getRotationAuthToken(controllerUrl, config) {
  let token = null;
  let actualControllerUrl = null;

  // If controller URL provided, try to get device token
  if (controllerUrl) {
    const tokenResult = await getTokenFromUrl(controllerUrl);
    if (tokenResult) {
      token = tokenResult.token;
      actualControllerUrl = tokenResult.controllerUrl;
    }
  }

  // If no token yet, try to find any device token in config
  if (!token && config.device) {
    const tokenResult = await findDeviceTokenFromConfig(config.device);
    if (tokenResult) {
      token = tokenResult.token;
      actualControllerUrl = tokenResult.controllerUrl;
    }
  }

  validateAuthToken(token, actualControllerUrl, controllerUrl);
  return { token, actualControllerUrl };
}

/**
 * Save credentials locally and update env files
 * @async
 * @param {string} appKey - Application key
 * @param {Object} credentials - Credentials object
 * @param {string} actualControllerUrl - Controller URL
 * @throws {Error} If saving fails
 */
async function saveCredentialsLocally(appKey, credentials, actualControllerUrl) {
  const clientIdKey = `${appKey}-client-idKeyVault`;
  const clientSecretKey = `${appKey}-client-secretKeyVault`;

  try {
    await saveLocalSecret(clientIdKey, credentials.clientId);
    await saveLocalSecret(clientSecretKey, credentials.clientSecret);

    // Update env.template if localhost
    if (isLocalhost(actualControllerUrl)) {
      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, actualControllerUrl);

      // Regenerate .env file with updated credentials
      try {
        await generateEnvFile(appKey, null, 'local');
        logger.log(chalk.green('✓ .env file updated with new credentials'));
      } catch (error) {
        logger.warn(chalk.yellow(`⚠️  Could not regenerate .env file: ${error.message}`));
      }

      logger.log(chalk.green('\n✓ Credentials saved to ~/.aifabrix/secrets.local.yaml'));
      logger.log(chalk.green('✓ env.template updated with MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL\n'));
    } else {
      logger.log(chalk.green('\n✓ Credentials saved to ~/.aifabrix/secrets.local.yaml\n'));
    }
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Could not save credentials locally: ${error.message}`));
  }
}

/**
 * Call rotate API, validate response, save locally, and display results.
 * @async
 * @param {string} appKey - Application key
 * @param {string} actualControllerUrl - Resolved controller URL
 * @param {string} environment - Environment ID or key
 * @param {string} token - Bearer token
 */
async function executeRotation(appKey, actualControllerUrl, environment, token) {
  const authConfig = { type: 'bearer', token };
  const response = await rotateApplicationSecret(actualControllerUrl, environment, appKey, authConfig);

  if (!response.success) {
    const formattedError = response.formattedError || formatApiError(response, actualControllerUrl);
    logger.error(formattedError);
    logger.error(chalk.gray(`\nController URL: ${actualControllerUrl}`));
    process.exit(1);
  }

  const { credentials, message } = validateResponse(response);
  await saveCredentialsLocally(appKey, credentials, actualControllerUrl);
  displayRotationResults(appKey, environment, credentials, actualControllerUrl, message);
  // Clear cached client token so next deploy uses new credentials (avoids "Invalid or expired credentials" when running deploy/up-dataplane immediately after rotate)
  await clearClientToken(environment, appKey);
}

/**
 * Rotate secret for an application.
 * Controller and environment come from config.yaml (set via aifabrix login or aifabrix auth config).
 * @async
 * @param {string} appKey - Application key
 * @param {Object} [_options] - Command options (reserved)
 * @throws {Error} If rotation fails
 */
async function rotateSecret(appKey, _options = {}) {
  logger.log(chalk.yellow('⚠️  This will invalidate the old ClientSecret!\n'));

  const { controllerUrl, environment } = await resolveControllerAndEnvironment();
  const config = await getConfig();
  const { token, actualControllerUrl } = await getRotationAuthToken(controllerUrl, config);

  try {
    await executeRotation(appKey, actualControllerUrl, environment, token);
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to rotate secret via controller: ${actualControllerUrl}`));
    logger.error(chalk.gray(`Error: ${error.message}`));
    process.exit(1);
  }
}

module.exports = { rotateSecret };

