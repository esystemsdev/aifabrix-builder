/**
 * AI Fabrix Builder - App Register Command
 *
 * Handles application registration and credential generation
 *
 * @fileoverview App register command implementation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');
const { getConfig } = require('./config');
const { authenticatedApiCall } = require('./utils/api');
const { formatApiError } = require('./utils/api-error-handler');
const logger = require('./utils/logger');
const { saveLocalSecret, isLocalhost } = require('./utils/local-secrets');
const { updateEnvTemplate } = require('./utils/env-template');
const { getOrRefreshDeviceToken } = require('./utils/token-manager');
const { detectAppType } = require('./utils/paths');

// Import createApp to auto-generate config if missing
let createApp;
try {
  createApp = require('./app').createApp;
} catch {
  createApp = null;
}

/**
 * Validation schema for application registration
 */
const registerApplicationSchema = {
  environmentId: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Invalid environment ID format');
    }
    return val;
  },
  key: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Application key is required');
    }
    if (val.length > 50) {
      throw new Error('Application key must be at most 50 characters');
    }
    if (!/^[a-z0-9-]+$/.test(val)) {
      throw new Error('Application key must contain only lowercase letters, numbers, and hyphens');
    }
    return val;
  },
  displayName: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Display name is required');
    }
    if (val.length > 100) {
      throw new Error('Display name must be at most 100 characters');
    }
    return val;
  },
  description: (val) => val || undefined,
  configuration: (val) => {
    const validTypes = ['webapp', 'api', 'service', 'functionapp'];
    const validRegistryModes = ['acr', 'external', 'public'];

    if (!val || !val.type || !validTypes.includes(val.type)) {
      throw new Error('Configuration type must be one of: webapp, api, service, functionapp');
    }
    if (!val.registryMode || !validRegistryModes.includes(val.registryMode)) {
      throw new Error('Registry mode must be one of: acr, external, public');
    }
    if (val.port !== undefined) {
      if (!Number.isInteger(val.port) || val.port < 1 || val.port > 65535) {
        throw new Error('Port must be an integer between 1 and 65535');
      }
    }
    return val;
  }
};

/**
 * Load variables.yaml file for an application
 * @async
 * @param {string} appKey - Application key
 * @returns {Promise<{variables: Object, created: boolean}>} Variables and creation flag
 */
async function loadVariablesYaml(appKey) {
  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appKey);
  const variablesPath = path.join(appPath, 'variables.yaml');

  try {
    const variablesContent = await fs.readFile(variablesPath, 'utf-8');
    return { variables: yaml.load(variablesContent), created: false };
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.log(chalk.yellow(`⚠️  variables.yaml not found for ${appKey}`));
      logger.log(chalk.yellow('📝 Creating minimal configuration...\n'));
      return { variables: null, created: true };
    }
    throw new Error(`Failed to read variables.yaml: ${error.message}`);
  }
}

/**
 * Create minimal application configuration if needed
 * @async
 * @param {string} appKey - Application key
 * @param {Object} options - Registration options
 * @returns {Promise<Object>} Variables after creation
 */
async function createMinimalAppIfNeeded(appKey, options) {
  if (!createApp) {
    throw new Error('Cannot auto-create application: createApp function not available');
  }

  await createApp(appKey, {
    port: options.port,
    language: 'typescript',
    database: false,
    redis: false,
    storage: false,
    authentication: false
  });

  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appKey);
  const variablesPath = path.join(appPath, 'variables.yaml');
  const variablesContent = await fs.readFile(variablesPath, 'utf-8');
  return yaml.load(variablesContent);
}

/**
 * Extract application configuration from variables.yaml
 * @param {Object} variables - Variables from YAML file
 * @param {string} appKey - Application key
 * @param {Object} options - Registration options
 * @returns {Object} Extracted configuration
 */
function extractAppConfiguration(variables, appKey, options) {
  const appKeyFromFile = variables.app?.key || appKey;
  const displayName = variables.app?.name || options.name || appKey;
  const description = variables.app?.description || '';

  // Handle external type
  if (variables.app?.type === 'external') {
    return {
      appKey: appKeyFromFile,
      displayName,
      description,
      appType: 'external',
      registryMode: 'external',
      port: null, // External systems don't need ports
      language: null // External systems don't need language
    };
  }

  const appType = variables.build?.language === 'typescript' ? 'webapp' : 'service';
  const registryMode = 'external';
  const port = variables.build?.port || options.port || 3000;
  const language = variables.build?.language || 'typescript';

  return {
    appKey: appKeyFromFile,
    displayName,
    description,
    appType,
    registryMode,
    port,
    language
  };
}

/**
 * Validate application registration data
 * @async
 * @param {Object} config - Application configuration
 * @param {string} originalAppKey - Original app key for error messages
 * @throws {Error} If validation fails
 */
async function validateAppRegistrationData(config, originalAppKey) {
  const missingFields = [];
  if (!config.appKey) missingFields.push('app.key');
  if (!config.displayName) missingFields.push('app.name');

  if (missingFields.length > 0) {
    logger.error(chalk.red('❌ Missing required fields in variables.yaml:'));
    missingFields.forEach(field => logger.error(chalk.red(`   - ${field}`)));
    // Detect app type to show correct path
    const { appPath } = await detectAppType(originalAppKey);
    const relativePath = path.relative(process.cwd(), appPath);
    logger.error(chalk.red(`\n   Please update ${relativePath}/variables.yaml and try again.`));
    process.exit(1);
  }

  try {
    registerApplicationSchema.key(config.appKey);
    registerApplicationSchema.displayName(config.displayName);
    registerApplicationSchema.configuration({
      type: config.appType,
      registryMode: config.registryMode,
      port: config.port
    });
  } catch (error) {
    logger.error(chalk.red(`❌ Invalid configuration: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Check if user is authenticated and get token
 * @async
 * @param {string} [controllerUrl] - Optional controller URL from variables.yaml
 * @param {string} [environment] - Optional environment key
 * @returns {Promise<{apiUrl: string, token: string}>} Configuration with API URL and token
 */
async function checkAuthentication(controllerUrl, environment) {
  const config = await getConfig();

  // Try to get controller URL from parameter, config, or device tokens
  let finalControllerUrl = controllerUrl;
  let token = null;

  // If controller URL provided, try to get device token
  if (finalControllerUrl) {
    const deviceToken = await getOrRefreshDeviceToken(finalControllerUrl);
    if (deviceToken && deviceToken.token) {
      token = deviceToken.token;
      finalControllerUrl = deviceToken.controller;
    }
  }

  // If no token yet, try to find any device token in config
  if (!token && config.device) {
    const deviceUrls = Object.keys(config.device);
    if (deviceUrls.length > 0) {
      // Use first available device token
      finalControllerUrl = deviceUrls[0];
      const deviceToken = await getOrRefreshDeviceToken(finalControllerUrl);
      if (deviceToken && deviceToken.token) {
        token = deviceToken.token;
        finalControllerUrl = deviceToken.controller;
      }
    }
  }

  // If still no token, check for client token (requires environment and app)
  if (!token && environment) {
    // For app register, we don't have an app yet, so client tokens won't work
    // This is expected - device tokens should be used for registration
  }

  if (!token || !finalControllerUrl) {
    logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
    logger.error(chalk.gray('   Use device code flow: aifabrix login --method device --controller <url>'));
    process.exit(1);
  }

  return {
    apiUrl: finalControllerUrl,
    token: token
  };
}

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
  const response = await authenticatedApiCall(
    `${apiUrl}/api/v1/environments/${encodeURIComponent(environment)}/applications/register`,
    {
      method: 'POST',
      body: JSON.stringify(registrationData)
    },
    token
  );

  if (!response.success) {
    const formattedError = response.formattedError || formatApiError(response);
    logger.error(formattedError);
    process.exit(1);
  }

  // Handle API response structure:
  // makeApiCall returns: { success: true, data: <API response> }
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

/**
 * Get environment prefix for GitHub Secrets
 * @param {string} environment - Environment key (e.g., 'dev', 'tst', 'pro', 'miso')
 * @returns {string} Uppercase prefix (e.g., 'DEV', 'TST', 'PRO', 'MISO')
 */
function getEnvironmentPrefix(environment) {
  if (!environment) {
    return 'DEV';
  }
  // Convert to uppercase and handle common variations
  const env = environment.toLowerCase();
  if (env === 'dev' || env === 'development') {
    return 'DEV';
  }
  if (env === 'tst' || env === 'test' || env === 'staging') {
    return 'TST';
  }
  if (env === 'pro' || env === 'prod' || env === 'production') {
    return 'PRO';
  }
  // For other environments (e.g., 'miso'), uppercase the entire string
  // Use full string if 4 characters or less, otherwise use first 4 characters
  const upper = environment.toUpperCase();
  return upper.length <= 4 ? upper : upper.substring(0, 4);
}

/**
 * Display registration success and credentials
 * @param {Object} data - Registration response data
 * @param {string} apiUrl - API URL
 * @param {string} environment - Environment key
 */
function displayRegistrationResults(data, apiUrl, environment) {
  logger.log(chalk.green('✅ Application registered successfully!\n'));
  logger.log(chalk.bold('📋 Application Details:'));
  logger.log(`   ID:           ${data.application.id}`);
  logger.log(`   Key:          ${data.application.key}`);
  logger.log(`   Display Name: ${data.application.displayName}\n`);

  logger.log(chalk.bold.yellow('🔑 CREDENTIALS (save these immediately):'));
  logger.log(chalk.yellow(`   Client ID:     ${data.credentials.clientId}`));
  logger.log(chalk.yellow(`   Client Secret: ${data.credentials.clientSecret}\n`));

  logger.log(chalk.red('⚠️  IMPORTANT: Client Secret will not be shown again!\n'));

  const envPrefix = getEnvironmentPrefix(environment);
  logger.log(chalk.bold('📝 Add to GitHub Secrets:'));
  logger.log(chalk.cyan('   Repository level:'));
  logger.log(chalk.cyan(`     MISO_CONTROLLER_URL = ${apiUrl}`));
  logger.log(chalk.cyan(`\n   Environment level (${environment}):`));
  logger.log(chalk.cyan(`     ${envPrefix}_MISO_CLIENTID = ${data.credentials.clientId}`));
  logger.log(chalk.cyan(`     ${envPrefix}_MISO_CLIENTSECRET = ${data.credentials.clientSecret}\n`));
}

/**
 * Register an application
 * @async
 * @param {string} appKey - Application key
 * @param {Object} options - Registration options
 * @param {string} options.environment - Environment ID or key
 * @param {number} [options.port] - Application port
 * @param {string} [options.name] - Override display name
 * @param {string} [options.description] - Override description
 * @throws {Error} If registration fails
 */
async function registerApplication(appKey, options) {
  logger.log(chalk.blue('📋 Registering application...\n'));

  // Load variables.yaml
  const { variables, created } = await loadVariablesYaml(appKey);
  let finalVariables = variables;

  // Create minimal app if needed
  if (created) {
    finalVariables = await createMinimalAppIfNeeded(appKey, options);
  }

  // Extract configuration
  const appConfig = extractAppConfiguration(finalVariables, appKey, options);

  // Validate configuration (pass original appKey for error messages)
  await validateAppRegistrationData(appConfig, appKey);

  // Get controller URL from variables.yaml if available
  const controllerUrl = finalVariables?.deployment?.controllerUrl;

  // Check authentication (try device token first, supports registration flow)
  const authConfig = await checkAuthentication(controllerUrl, options.environment);

  // Validate environment
  const environment = registerApplicationSchema.environmentId(options.environment);

  // Prepare registration data to match OpenAPI RegisterApplicationRequest schema
  // Schema: { key, displayName, description?, configuration: { type, registryMode, port?, image? } }
  const registrationData = {
    key: appConfig.appKey,
    displayName: appConfig.displayName,
    configuration: {
      type: appConfig.appType,
      registryMode: appConfig.registryMode
    }
  };

  // Add optional fields only if they have values
  if (appConfig.description || options.description) {
    registrationData.description = appConfig.description || options.description;
  }

  if (appConfig.port) {
    registrationData.configuration.port = appConfig.port;
  }

  // Register application
  const responseData = await callRegisterApi(
    authConfig.apiUrl,
    authConfig.token,
    environment,
    registrationData
  );

  // Save credentials to local secrets if localhost
  if (isLocalhost(authConfig.apiUrl)) {
    const registeredAppKey = responseData.application.key;
    const clientIdKey = `${registeredAppKey}-client-idKeyVault`;
    const clientSecretKey = `${registeredAppKey}-client-secretKeyVault`;

    try {
      await saveLocalSecret(clientIdKey, responseData.credentials.clientId);
      await saveLocalSecret(clientSecretKey, responseData.credentials.clientSecret);

      // Update env.template
      await updateEnvTemplate(registeredAppKey, clientIdKey, clientSecretKey, authConfig.apiUrl);

      logger.log(chalk.green('\n✓ Credentials saved to ~/.aifabrix/secrets.local.yaml'));
      logger.log(chalk.green('✓ env.template updated with MISO_CLIENTID, MISO_CLIENTSECRET, and MISO_CONTROLLER_URL\n'));
    } catch (error) {
      logger.warn(chalk.yellow(`⚠️  Could not save credentials locally: ${error.message}`));
    }
  }

  // Display results
  displayRegistrationResults(responseData, authConfig.apiUrl, environment);
}

module.exports = { registerApplication, getEnvironmentPrefix };

