/**
 * AI Fabrix Builder - App Register Command
 *
 * Handles application registration and credential generation
 *
 * @fileoverview App register command implementation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { saveLocalSecret, isLocalhost } = require('../utils/local-secrets');
const { updateEnvTemplate } = require('../utils/env-template');
const { generateEnvFile } = require('../core/secrets');
const { registerApplicationSchema, validateAppRegistrationData } = require('../utils/app-register-validator');
const {
  loadVariablesYaml,
  createMinimalAppIfNeeded,
  extractAppConfiguration
} = require('../utils/app-register-config');
const { checkAuthentication } = require('../utils/app-register-auth');
const { callRegisterApi } = require('../utils/app-register-api');
const { displayRegistrationResults, getEnvironmentPrefix } = require('../utils/app-register-display');

/**
 * Build registration data payload from app configuration
 * @param {Object} appConfig - Application configuration
 * @param {Object} options - Registration options
 * @returns {Object} Registration data payload
 */
function buildRegistrationData(appConfig, options) {
  const registrationData = {
    key: appConfig.appKey,
    displayName: appConfig.displayName,
    type: appConfig.appType
  };

  // Add optional fields only if they have values
  if (appConfig.description || options.description) {
    registrationData.description = appConfig.description || options.description;
  }

  // Handle external type vs non-external types differently
  if (appConfig.appType === 'external') {
    // For external type: include externalIntegration, exclude registryMode/port/image
    if (appConfig.externalIntegration) {
      registrationData.externalIntegration = appConfig.externalIntegration;
    }
  } else {
    // For non-external types: include registryMode, port, image
    registrationData.registryMode = appConfig.registryMode;

    // Port is required for non-external types
    if (appConfig.port) {
      registrationData.port = appConfig.port;
    }

    // Image is required for non-external types
    if (appConfig.image) {
      registrationData.image = appConfig.image;
    }
  }

  return registrationData;
}

/**
 * Save credentials to local secrets if localhost
 * @async
 * @param {Object} responseData - Registration response data
 * @param {string} apiUrl - API URL
 */
async function saveLocalCredentials(responseData, apiUrl) {
  if (!isLocalhost(apiUrl)) {
    return;
  }

  const registeredAppKey = responseData.application.key;
  const clientIdKey = `${registeredAppKey}-client-idKeyVault`;
  const clientSecretKey = `${registeredAppKey}-client-secretKeyVault`;

  try {
    await saveLocalSecret(clientIdKey, responseData.credentials.clientId);
    await saveLocalSecret(clientSecretKey, responseData.credentials.clientSecret);

    // Update env.template
    await updateEnvTemplate(registeredAppKey, clientIdKey, clientSecretKey, apiUrl);

    // Regenerate .env file with updated credentials
    try {
      await generateEnvFile(registeredAppKey, null, 'local');
      logger.log(chalk.green('✓ .env file updated with new credentials'));
    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Could not regenerate .env file: ${error.message}`));
    }

    logger.log(chalk.green('\n✓ Credentials saved to ~/.aifabrix/secrets.local.yaml'));
    logger.log(chalk.green('✓ env.template updated with MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL\n'));
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Could not save credentials locally: ${error.message}`));
  }
}

/**
 * Register an application
 * @async
 * @param {string} appKey - Application key
 * @param {Object} options - Registration options
 * @param {string} options.environment - Environment ID or key
 * @param {string} [options.controller] - Controller URL (overrides variables.yaml)
 * @param {number} [options.port] - Application port
 * @param {string} [options.name] - Override display name
 * @param {string} [options.description] - Override description
 * @throws {Error} If registration fails
 */
async function registerApplication(appKey, options) {
  logger.log(chalk.blue('📋 Registering application...\n'));

  // Load variables.yaml
  const { variables, created } = await loadVariablesYaml(appKey);
  const finalVariables = created
    ? await createMinimalAppIfNeeded(appKey, options)
    : variables;

  // Extract and validate configuration
  const appConfig = await extractAppConfiguration(finalVariables, appKey, options);
  await validateAppRegistrationData(appConfig, appKey);

  // Get controller URL with priority: options.controller > variables.yaml > device tokens
  const controllerUrl = options.controller || finalVariables?.deployment?.controllerUrl;
  const authConfig = await checkAuthentication(controllerUrl, options.environment);
  const environment = registerApplicationSchema.environmentId(options.environment);

  // Register application
  const registrationData = buildRegistrationData(appConfig, options);
  const responseData = await callRegisterApi(
    authConfig.apiUrl,
    authConfig.token,
    environment,
    registrationData
  );

  // Save credentials and display results
  await saveLocalCredentials(responseData, authConfig.apiUrl);
  displayRegistrationResults(responseData, authConfig.apiUrl, environment);
}

module.exports = { registerApplication, getEnvironmentPrefix };

