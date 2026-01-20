/**
 * AI Fabrix Builder - Login Command
 *
 * Handles authentication with Miso Controller
 * Supports device code flow and credentials authentication
 *
 * @fileoverview Login command implementation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const { setCurrentEnvironment, saveClientToken } = require('../core/config');
const logger = require('../utils/logger');
const { handleCredentialsLogin } = require('./login-credentials');
const { handleDeviceCodeLogin } = require('./login-device');
const { getDefaultControllerUrl } = require('../utils/controller-url');

/**
 * Determine and validate authentication method
 * @async
 * @param {string} [method] - Method provided via options
 * @returns {Promise<string>} Validated method ('device' or 'credentials')
 */
async function determineAuthMethod(method) {
  if (method) {
    if (method !== 'device' && method !== 'credentials') {
      logger.error(chalk.red(`❌ Invalid method: ${method}. Must be 'device' or 'credentials'`));
      process.exit(1);
    }
    return method;
  }

  const authMethod = await inquirer.prompt([{
    type: 'list',
    name: 'method',
    message: 'Choose authentication method:',
    choices: [
      { name: 'ClientId + ClientSecret', value: 'credentials' },
      { name: 'Device Code Flow (environment only)', value: 'device' }
    ]
  }]);
  return authMethod.method;
}

/**
 * Save client credentials token configuration
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} token - Authentication token
 * @param {string} expiresAt - Token expiration time
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 */
async function saveCredentialsLoginConfig(controllerUrl, token, expiresAt, environment, appName) {
  await saveClientToken(environment, appName, controllerUrl, token, expiresAt);
}

/**
 * Handle login command action
 * @async
 * @function handleLogin
 * @param {Object} options - Login options
 * @param {string} [options.controller] - Controller URL (default: calculated based on developer ID, e.g., 'http://localhost:3000' for dev ID 0, 'http://localhost:3100' for dev ID 1)
 * @param {string} [options.method] - Authentication method ('device' or 'credentials', default: 'device')
 * @param {string} [options.app] - Application name (for credentials method, reads from secrets.local.yaml)
 * @param {string} [options.clientId] - Client ID (for credentials method, overrides secrets.local.yaml)
 * @param {string} [options.clientSecret] - Client Secret (for credentials method, overrides secrets.local.yaml)
 * @param {string} [options.environment] - Environment key (updates root-level environment in config.yaml)
 * @returns {Promise<void>} Resolves when login completes
 * @throws {Error} If login fails
 */
/**
 * Normalizes and logs controller URL
 * Calculates default URL based on developer ID if not provided
 * @async
 * @function normalizeControllerUrl
 * @param {Object} options - Login options
 * @returns {Promise<string>} Normalized controller URL
 */
async function normalizeControllerUrl(options) {
  let controllerUrl = options.controller || options.url;
  if (!controllerUrl) {
    controllerUrl = await getDefaultControllerUrl();
  }
  controllerUrl = controllerUrl.replace(/\/$/, '');
  logger.log(chalk.gray(`Controller URL: ${controllerUrl}`));
  return controllerUrl;
}

/**
 * Handles environment configuration
 * @async
 * @function handleEnvironmentConfig
 * @param {Object} options - Login options
 * @returns {Promise<string>} Environment key
 */
async function handleEnvironmentConfig(options) {
  if (options.environment) {
    const environment = options.environment.trim();
    await setCurrentEnvironment(environment);
    logger.log(chalk.gray(`Environment: ${environment}`));
    return environment;
  }
  // Get current environment from config
  const { getCurrentEnvironment } = require('../core/config');
  return await getCurrentEnvironment();
}

/**
 * Validates scope options for credentials method
 * @function validateScopeOptions
 * @param {string} method - Authentication method
 * @param {Object} options - Login options
 */
function validateScopeOptions(method, options) {
  if (method === 'credentials' && (options.online || options.scope)) {
    logger.log(chalk.yellow('⚠️  Warning: --online and --scope options are only available for device flow'));
    logger.log(chalk.gray('   These options will be ignored for credentials method\n'));
  }
}

/**
 * Handles credentials login flow
 * @async
 * @function handleCredentialsLoginFlow
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object} options - Login options
 * @returns {Promise<void>}
 */
async function handleCredentialsLoginFlow(controllerUrl, environment, options) {
  if (!options.app) {
    logger.error(chalk.red('❌ --app is required for credentials login method'));
    process.exit(1);
  }
  const loginResult = await handleCredentialsLogin(controllerUrl, options.app, options.clientId, options.clientSecret);
  await saveCredentialsLoginConfig(controllerUrl, loginResult.token, loginResult.expiresAt, environment, options.app);
}

/**
 * Handles device code login flow
 * @async
 * @function handleDeviceCodeLoginFlow
 * @param {string} controllerUrl - Controller URL
 * @param {Object} options - Login options
 * @returns {Promise<{token: string, environment: string}>} Login result
 */
async function handleDeviceCodeLoginFlow(controllerUrl, options) {
  return await handleDeviceCodeLogin(controllerUrl, options.environment, options.online, options.scope);
}

async function handleLogin(options) {
  logger.log(chalk.blue('\n🔐 Logging in to Miso Controller...\n'));

  const controllerUrl = await normalizeControllerUrl(options);
  const environment = await handleEnvironmentConfig(options);
  const method = await determineAuthMethod(options.method);

  validateScopeOptions(method, options);

  if (method === 'credentials') {
    await handleCredentialsLoginFlow(controllerUrl, environment, options);
  } else if (method === 'device') {
    await handleDeviceCodeLoginFlow(controllerUrl, options);
    return; // Early return for device flow (already saved config)
  }

  logger.log(chalk.green('\n✅ Successfully logged in!'));
  logger.log(chalk.gray(`Controller: ${controllerUrl}`));
  logger.log(chalk.gray(`Environment: ${environment}`));
  if (options.app) {
    logger.log(chalk.gray(`App: ${options.app}`));
  }
  logger.log(chalk.gray('Token stored securely in ~/.aifabrix/config.yaml\n'));
}

module.exports = { handleLogin };

