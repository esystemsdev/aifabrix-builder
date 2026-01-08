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
const { setCurrentEnvironment, saveDeviceToken, saveClientToken } = require('../config');
const { getToken, initiateDeviceCodeFlow } = require('../api/auth.api');
const { pollDeviceCodeToken, displayDeviceCodeInfo } = require('../utils/api');
const { formatApiError } = require('../utils/api-error-handler');
const { loadClientCredentials } = require('../utils/token-manager');
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
    message: 'Environment key (e.g., miso, dev, tst, pro):',
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
 * Save device token configuration (root level, controller-specific)
 * @async
 * @param {string} controllerUrl - Controller URL (used as key)
 * @param {string} token - Authentication token
 * @param {string} refreshToken - Refresh token for token renewal
 * @param {string} expiresAt - Token expiration time
 */
async function saveDeviceLoginConfig(controllerUrl, token, refreshToken, expiresAt) {
  await saveDeviceToken(controllerUrl, token, refreshToken, expiresAt);
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
 * Handle credentials-based login
 * Uses OpenAPI /api/v1/auth/token endpoint with x-client-id and x-client-secret headers
 * Reads credentials from secrets.local.yaml using pattern <app-name>-client-idKeyVault
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} appName - Application name
 * @param {string} [clientId] - Client ID from options (optional, overrides secrets.local.yaml)
 * @param {string} [clientSecret] - Client Secret from options (optional, overrides secrets.local.yaml)
 * @returns {Promise<string>} Authentication token
 */
async function handleCredentialsLogin(controllerUrl, appName, clientId, clientSecret) {
  let credentials;

  // Try to load from secrets.local.yaml if appName provided and credentials not provided
  if (appName && !clientId && !clientSecret) {
    credentials = await loadClientCredentials(appName);
    if (!credentials) {
      logger.log(chalk.yellow(`⚠️  Credentials not found in secrets.local.yaml for app '${appName}'`));
      logger.log(chalk.gray(`   Looking for: '${appName}-client-idKeyVault' and '${appName}-client-secretKeyVault'`));
      logger.log(chalk.gray('   Prompting for credentials...\n'));
    }
  }

  // If still no credentials, prompt for them
  if (!credentials) {
    credentials = await promptForCredentials(clientId, clientSecret);
  }

  // Use centralized API client for token generation
  const response = await getToken(credentials.clientId, credentials.clientSecret, controllerUrl);

  if (!response.success) {
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

  // OpenAPI spec response: { success: boolean, token: string, expiresIn: number, expiresAt: string, ... }
  // Handle both flat and nested response structures (some APIs wrap in data field)
  const apiResponse = response.data;
  const responseData = apiResponse.data || apiResponse;

  if (!responseData || !responseData.token) {
    logger.error(chalk.red('❌ Invalid response: missing token'));
    if (responseData) {
      logger.error(chalk.gray(`Response structure: ${JSON.stringify(responseData, null, 2)}`));
    }
    process.exit(1);
  }

  // Calculate expiration (use expiresAt if provided, otherwise calculate from expiresIn, default to 24 hours)
  let expiresAt;
  if (responseData.expiresAt) {
    expiresAt = responseData.expiresAt;
  } else if (responseData.expiresIn) {
    expiresAt = new Date(Date.now() + responseData.expiresIn * 1000).toISOString();
  } else {
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  return {
    token: responseData.token,
    expiresAt: expiresAt
  };
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
    const refreshToken = tokenResponse.refresh_token;
    const expiresAt = new Date(Date.now() + (tokenResponse.expires_in * 1000)).toISOString();

    // Save device token at root level (controller-specific, not environment-specific)
    await saveDeviceLoginConfig(controllerUrl, token, refreshToken, expiresAt);

    // Still set current environment if provided (for other purposes)
    if (envKey) {
      await setCurrentEnvironment(envKey);
    }

    logger.log(chalk.green('\n✅ Successfully logged in!'));
    logger.log(chalk.gray(`Controller: ${controllerUrl}`));
    if (envKey) {
      logger.log(chalk.gray(`Environment: ${envKey}`));
    }
    logger.log(chalk.gray('Token stored securely in ~/.aifabrix/config.yaml\n'));

    return { token, environment: envKey };

  } catch (pollError) {
    spinner.fail('Authentication failed');
    throw pollError;
  }
}

/**
 * Build scope string from options
 * @param {boolean} [offline] - Whether to request offline_access
 * @param {string} [customScope] - Custom scope string
 * @returns {string} Scope string
 */
function buildScope(offline, customScope) {
  const defaultScope = 'openid profile email';

  if (customScope) {
    // If custom scope provided, use it and optionally add offline_access
    if (offline && !customScope.includes('offline_access')) {
      return `${customScope} offline_access`;
    }
    return customScope;
  }

  // Default scope with optional offline_access
  if (offline) {
    return `${defaultScope} offline_access`;
  }

  return defaultScope;
}

/**
 * Validate device code API response
 * @param {Object} deviceCodeApiResponse - API response
 * @throws {Error} If response is invalid
 */
function validateDeviceCodeResponse(deviceCodeApiResponse) {
  if (!deviceCodeApiResponse) {
    throw new Error('Device code flow initiation returned no response');
  }

  if (!deviceCodeApiResponse.success) {
    const errorMessage = deviceCodeApiResponse.formattedError ||
                        deviceCodeApiResponse.error ||
                        'Device code flow initiation failed';
    const error = new Error(errorMessage);
    if (deviceCodeApiResponse.formattedError) {
      error.formattedError = deviceCodeApiResponse.formattedError;
    }
    throw error;
  }

  if (!deviceCodeApiResponse.data) {
    throw new Error('Device code flow initiation returned no data');
  }
}

/**
 * Convert API response to device code format
 * @param {Object} apiResponse - API response data
 * @returns {Object} Device code response in snake_case format
 */
function convertDeviceCodeResponse(apiResponse) {
  const deviceCodeData = apiResponse.data || apiResponse;
  return {
    device_code: deviceCodeData.deviceCode || deviceCodeData.device_code,
    user_code: deviceCodeData.userCode || deviceCodeData.user_code,
    verification_uri: deviceCodeData.verificationUri || deviceCodeData.verification_uri,
    expires_in: deviceCodeData.expiresIn || deviceCodeData.expires_in || 600,
    interval: deviceCodeData.interval || 5
  };
}

/**
 * Handle device code flow login
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} [environment] - Environment key from options
 * @param {boolean} [offline] - Whether to request offline_access scope
 * @param {string} [scope] - Custom scope string
 * @returns {Promise<{token: string, environment: string}>} Token and environment
 */
async function handleDeviceCodeLogin(controllerUrl, environment, offline, scope) {
  const envKey = await getEnvironmentKey(environment);
  const requestScope = buildScope(offline, scope);

  logger.log(chalk.blue('\n📱 Initiating device code flow...\n'));
  if (offline) {
    logger.log(chalk.gray(`Requesting offline token (scope: ${requestScope})\n`));
  }

  try {
    // Use centralized API client for device code flow initiation
    const deviceCodeApiResponse = await initiateDeviceCodeFlow(controllerUrl, envKey, requestScope);

    // Validate response structure
    validateDeviceCodeResponse(deviceCodeApiResponse);

    // Convert API response to device code format
    const apiResponse = deviceCodeApiResponse.data;
    const deviceCodeResponse = convertDeviceCodeResponse(apiResponse);

    displayDeviceCodeInfo(deviceCodeResponse.user_code, deviceCodeResponse.verification_uri, logger, chalk);

    return await pollAndSaveDeviceCodeToken(
      controllerUrl,
      deviceCodeResponse.device_code,
      deviceCodeResponse.interval,
      deviceCodeResponse.expires_in,
      envKey
    );

  } catch (deviceError) {
    // Display formatted error if available (includes detailed validation info)
    if (deviceError.formattedError) {
      logger.error(chalk.red('\n❌ Device code flow failed:'));
      logger.log(deviceError.formattedError);
    } else {
      logger.error(chalk.red(`\n❌ Device code flow failed: ${deviceError.message}`));
    }
    process.exit(1);
  }
}

/**
 * Handle login command action
 * @async
 * @function handleLogin
 * @param {Object} options - Login options
 * @param {string} [options.controller] - Controller URL (default: 'http://localhost:3000')
 * @param {string} [options.method] - Authentication method ('device' or 'credentials')
 * @param {string} [options.app] - Application name (for credentials method, reads from secrets.local.yaml)
 * @param {string} [options.clientId] - Client ID (for credentials method, overrides secrets.local.yaml)
 * @param {string} [options.clientSecret] - Client Secret (for credentials method, overrides secrets.local.yaml)
 * @param {string} [options.environment] - Environment key (updates root-level environment in config.yaml)
 * @returns {Promise<void>} Resolves when login completes
 * @throws {Error} If login fails
 */
async function handleLogin(options) {
  logger.log(chalk.blue('\n🔐 Logging in to Miso Controller...\n'));

  const controllerUrl = (options.controller || options.url || 'http://localhost:3000').replace(/\/$/, '');
  logger.log(chalk.gray(`Controller URL: ${controllerUrl}`));

  // Update root-level environment if provided
  let environment = null;
  if (options.environment) {
    environment = options.environment.trim();
    await setCurrentEnvironment(environment);
    logger.log(chalk.gray(`Environment: ${environment}`));
  } else {
    // Get current environment from config
    const { getCurrentEnvironment } = require('../config');
    environment = await getCurrentEnvironment();
  }

  const method = await determineAuthMethod(options.method);
  let token;
  let expiresAt;

  // Validate scope options - only applicable to device flow
  if (method === 'credentials' && (options.offline || options.scope)) {
    logger.log(chalk.yellow('⚠️  Warning: --offline and --scope options are only available for device flow'));
    logger.log(chalk.gray('   These options will be ignored for credentials method\n'));
  }

  if (method === 'credentials') {
    if (!options.app) {
      logger.error(chalk.red('❌ --app is required for credentials login method'));
      process.exit(1);
    }
    const loginResult = await handleCredentialsLogin(controllerUrl, options.app, options.clientId, options.clientSecret);
    token = loginResult.token;
    expiresAt = loginResult.expiresAt;
    await saveCredentialsLoginConfig(controllerUrl, token, expiresAt, environment, options.app);
  } else if (method === 'device') {
    const result = await handleDeviceCodeLogin(controllerUrl, options.environment, options.offline, options.scope);
    token = result.token;
    environment = result.environment;
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

