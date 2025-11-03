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
const ora = require('ora');
const { saveConfig } = require('../config');
const { makeApiCall, initiateDeviceCodeFlow, pollDeviceCodeToken, displayDeviceCodeInfo } = require('../utils/api');
const logger = require('../utils/logger');

/**
 * Validate environment key format
 * @param {string} envKey - Environment key to validate
 * @throws {Error} If environment key format is invalid
 */
function validateEnvironmentKey(envKey) {
  if (!/^[a-z0-9-_]+$/i.test(envKey)) {
    throw new Error('Environment key must contain only letters, numbers, hyphens, and underscores');
  }
}

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
        const value = input.trim();
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
        const value = input.trim();
        if (!value || value.length === 0) {
          return 'Client Secret is required';
        }
        return true;
      }
    }
  ]);

  return {
    clientId: credentials.clientId.trim(),
    clientSecret: credentials.clientSecret.trim()
  };
}

/**
 * Get and validate environment key
 * @async
 * @param {string} [environment] - Environment key from options
 * @returns {Promise<string>} Validated environment key
 */
async function getEnvironmentKey(environment) {
  if (environment) {
    const envKey = environment.trim();
    validateEnvironmentKey(envKey);
    return envKey;
  }

  const envPrompt = await inquirer.prompt([{
    type: 'input',
    name: 'environment',
    message: 'Environment key (e.g., dev, tst, pro):',
    validate: (input) => {
      if (!input || input.trim().length === 0) {
        return 'Environment key is required';
      }
      validateEnvironmentKey(input.trim());
      return true;
    }
  }]);

  return envPrompt.environment.trim();
}

/**
 * Save login configuration
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} token - Authentication token
 * @param {string} expiresAt - Token expiration time
 * @param {string} [environment] - Environment key
 */
async function saveLoginConfig(controllerUrl, token, expiresAt, environment) {
  await saveConfig({
    apiUrl: controllerUrl,
    token: token,
    expiresAt: expiresAt,
    environment: environment || undefined
  });
}

/**
 * Handle credentials-based login
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} [clientId] - Client ID from options
 * @param {string} [clientSecret] - Client Secret from options
 * @returns {Promise<string>} Authentication token
 */
async function handleCredentialsLogin(controllerUrl, clientId, clientSecret) {
  const credentials = await promptForCredentials(clientId, clientSecret);

  const response = await makeApiCall(`${controllerUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret
    })
  });

  if (!response.success) {
    logger.error(chalk.red(`❌ Login failed: ${response.error}`));
    process.exit(1);
  }

  return response.data.token || response.data.accessToken;
}

/**
 * Poll for device code token and save configuration
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} deviceCode - Device code
 * @param {number} interval - Polling interval
 * @param {number} expiresIn - Expiration time
 * @param {string} envKey - Environment key
 * @returns {Promise<{token: string, environment: string}>} Token and environment
 */
async function pollAndSaveDeviceCodeToken(controllerUrl, deviceCode, interval, expiresIn, envKey) {
  const spinner = ora({
    text: 'Waiting for approval',
    spinner: 'dots'
  }).start();

  let pollCount = 0;
  const pollCallback = () => {
    pollCount++;
    spinner.text = `Waiting for approval (attempt ${pollCount})...`;
  };

  try {
    const tokenResponse = await pollDeviceCodeToken(
      controllerUrl,
      deviceCode,
      interval,
      expiresIn,
      pollCallback
    );

    spinner.succeed('Authentication approved!');

    const token = tokenResponse.access_token;
    const expiresAt = new Date(Date.now() + (tokenResponse.expires_in * 1000)).toISOString();

    await saveLoginConfig(controllerUrl, token, expiresAt, envKey);

    logger.log(chalk.green('\n✅ Successfully logged in!'));
    logger.log(chalk.gray(`Controller: ${controllerUrl}`));
    logger.log(chalk.gray('Token stored securely in ~/.aifabrix/config.yaml\n'));

    return { token, environment: envKey };

  } catch (pollError) {
    spinner.fail('Authentication failed');
    throw pollError;
  }
}

/**
 * Handle device code flow login
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} [environment] - Environment key from options
 * @returns {Promise<{token: string, environment: string}>} Token and environment
 */
async function handleDeviceCodeLogin(controllerUrl, environment) {
  const envKey = await getEnvironmentKey(environment);

  logger.log(chalk.blue('\n📱 Initiating device code flow...\n'));

  try {
    const deviceCodeResponse = await initiateDeviceCodeFlow(controllerUrl, envKey);

    displayDeviceCodeInfo(deviceCodeResponse.user_code, deviceCodeResponse.verification_uri, logger, chalk);

    return await pollAndSaveDeviceCodeToken(
      controllerUrl,
      deviceCodeResponse.device_code,
      deviceCodeResponse.interval,
      deviceCodeResponse.expires_in,
      envKey
    );

  } catch (deviceError) {
    logger.error(chalk.red(`\n❌ Device code flow failed: ${deviceError.message}`));
    process.exit(1);
  }
}

/**
 * Handle login command action
 * @async
 * @function handleLogin
 * @param {Object} options - Login options
 * @param {string} [options.url] - Controller URL (default: 'http://localhost:3000')
 * @param {string} [options.method] - Authentication method ('device' or 'credentials')
 * @param {string} [options.clientId] - Client ID (for credentials method)
 * @param {string} [options.clientSecret] - Client Secret (for credentials method)
 * @param {string} [options.environment] - Environment key (for device method)
 * @returns {Promise<void>} Resolves when login completes
 * @throws {Error} If login fails
 */
async function handleLogin(options) {
  logger.log(chalk.blue('\n🔐 Logging in to Miso Controller...\n'));

  const controllerUrl = options.url.replace(/\/$/, '');
  logger.log(chalk.gray(`Controller URL: ${controllerUrl}`));

  const method = await determineAuthMethod(options.method);
  let token;
  let environment = null;

  if (method === 'credentials') {
    token = await handleCredentialsLogin(controllerUrl, options.clientId, options.clientSecret);
  } else if (method === 'device') {
    const result = await handleDeviceCodeLogin(controllerUrl, options.environment);
    token = result.token;
    environment = result.environment;
    return; // Early return for device flow (already saved config)
  }

  // Save configuration for credentials method
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await saveLoginConfig(controllerUrl, token, expiresAt, environment);

  logger.log(chalk.green('\n✅ Successfully logged in!'));
  logger.log(chalk.gray(`Controller: ${controllerUrl}`));
  logger.log(chalk.gray('Token stored securely in ~/.aifabrix/config.yaml\n'));
}

module.exports = { handleLogin };

