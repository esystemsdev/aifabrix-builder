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
const { getConfig } = require('./config');
const { getOrRefreshDeviceToken } = require('./utils/token-manager');
const { authenticatedApiCall } = require('./utils/api');
const { formatApiError } = require('./utils/api-error-handler');
const logger = require('./utils/logger');
const { saveLocalSecret, isLocalhost } = require('./utils/local-secrets');
const { updateEnvTemplate } = require('./utils/env-template');
const { getEnvironmentPrefix } = require('./app-register');

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
 * Validate API response structure
 * @param {Object} response - API response
 * @throws {Error} If response structure is invalid
 */
function validateResponse(response) {
  if (!response.data || typeof response.data !== 'object') {
    throw new Error('Invalid response: missing data');
  }

  const credentials = response.data.credentials;
  if (!credentials || typeof credentials !== 'object' || typeof credentials.clientId !== 'string' || typeof credentials.clientSecret !== 'string') {
    throw new Error('Invalid response: missing or invalid credentials');
  }
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
  logger.log(`   Environment: ${environment}\n`);

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
 * Rotate secret for an application
 * @async
 * @param {string} appKey - Application key
 * @param {Object} options - Command options
 * @param {string} options.environment - Environment ID or key
 * @throws {Error} If rotation fails
 */
async function rotateSecret(appKey, options) {
  logger.log(chalk.yellow('⚠️  This will invalidate the old ClientSecret!\n'));

  const config = await getConfig();

  // Try to get device token
  let controllerUrl = null;
  let token = null;

  if (config.device) {
    const deviceUrls = Object.keys(config.device);
    if (deviceUrls.length > 0) {
      controllerUrl = deviceUrls[0];
      const deviceToken = await getOrRefreshDeviceToken(controllerUrl);
      if (deviceToken && deviceToken.token) {
        token = deviceToken.token;
        controllerUrl = deviceToken.controller;
      }
    }
  }

  if (!token || !controllerUrl) {
    logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
    logger.error(chalk.gray('   Use device code flow: aifabrix login --method device --controller <url>'));
    process.exit(1);
  }

  // Validate environment
  validateEnvironment(options.environment);

  // OpenAPI spec: POST /api/v1/environments/{envKey}/applications/{appKey}/rotate-secret
  // Path parameters: envKey, appKey (no query parameters)
  const response = await authenticatedApiCall(
    `${controllerUrl}/api/v1/environments/${encodeURIComponent(options.environment)}/applications/${encodeURIComponent(appKey)}/rotate-secret`,
    {
      method: 'POST'
    },
    token
  );

  if (!response.success) {
    const formattedError = response.formattedError || formatApiError(response);
    logger.error(formattedError);
    process.exit(1);
  }

  // Validate response structure
  validateResponse(response);

  const credentials = response.data.credentials;
  const message = response.data.message;

  // Save credentials to local secrets (always save when rotating)
  const clientIdKey = `${appKey}-client-idKeyVault`;
  const clientSecretKey = `${appKey}-client-secretKeyVault`;

  try {
    await saveLocalSecret(clientIdKey, credentials.clientId);
    await saveLocalSecret(clientSecretKey, credentials.clientSecret);

    // Update env.template if localhost
    if (isLocalhost(controllerUrl)) {
      await updateEnvTemplate(appKey, clientIdKey, clientSecretKey, controllerUrl);
      logger.log(chalk.green('\n✓ Credentials saved to ~/.aifabrix/secrets.local.yaml'));
      logger.log(chalk.green('✓ env.template updated with MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL\n'));
    } else {
      logger.log(chalk.green('\n✓ Credentials saved to ~/.aifabrix/secrets.local.yaml\n'));
    }
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Could not save credentials locally: ${error.message}`));
  }

  // Display results
  displayRotationResults(appKey, options.environment, credentials, controllerUrl, message);
}

module.exports = { rotateSecret };

