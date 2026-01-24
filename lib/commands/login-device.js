/**
 * Login Device Code Flow Handling
 *
 * Handles device code flow authentication
 *
 * @fileoverview Device code login handling for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { setCurrentEnvironment, saveDeviceToken, setControllerUrl } = require('../core/config');
const { initiateDeviceCodeFlow } = require('../api/auth.api');
const { pollDeviceCodeToken, displayDeviceCodeInfo } = require('../utils/api');
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
 * Save token configuration and display success message
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} token - Access token
 * @param {string} refreshToken - Refresh token
 * @param {string} expiresAt - Token expiration time
 * @param {string} envKey - Environment key
 * @returns {Promise<void>}
 */
async function saveTokenAndDisplaySuccess(controllerUrl, token, refreshToken, expiresAt, envKey) {
  await saveDeviceLoginConfig(controllerUrl, token, refreshToken, expiresAt);
  await setControllerUrl(controllerUrl);
  if (envKey) {
    await setCurrentEnvironment(envKey);
  }
  logger.log(chalk.green('\n✅ Successfully logged in!'));
  logger.log(chalk.gray(`Controller: ${controllerUrl}`));
  if (envKey) {
    logger.log(chalk.gray(`Environment: ${envKey}`));
  }
  logger.log(chalk.gray('Token stored securely in ~/.aifabrix/config.yaml\n'));
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

    await saveTokenAndDisplaySuccess(controllerUrl, token, refreshToken, expiresAt, envKey);
    return { token, environment: envKey };
  } catch (pollError) {
    spinner.fail('Authentication failed');
    throw pollError;
  }
}

/**
 * Build scope string from options
 * @param {boolean} [online] - Whether to exclude offline_access (default: false, meaning offline tokens are default)
 * @param {string} [customScope] - Custom scope string
 * @returns {string} Scope string
 */
function buildScope(online, customScope) {
  const defaultScope = 'openid profile email';

  if (customScope) {
    // If custom scope provided, use it as-is
    // If --online flag is used and scope contains offline_access, remove it
    if (online && customScope.includes('offline_access')) {
      return customScope.replace(/\s*offline_access\s*/g, ' ').trim().replace(/\s+/g, ' ');
    }
    // If not --online and scope doesn't have offline_access, add it (default behavior)
    if (!online && !customScope.includes('offline_access')) {
      return `${customScope} offline_access`;
    }
    return customScope;
  }

  // Default scope: include offline_access unless --online is specified
  if (online) {
    return defaultScope;
  }

  return `${defaultScope} offline_access`;
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
 * @param {boolean} [online] - Whether to exclude offline_access scope (default: false, meaning offline tokens are default)
 * @param {string} [scope] - Custom scope string
 * @returns {Promise<{token: string, environment: string}>} Token and environment
 */
async function handleDeviceCodeLogin(controllerUrl, environment, online, scope) {
  const envKey = await getEnvironmentKey(environment);
  const requestScope = buildScope(online, scope);

  logger.log(chalk.blue('\n📱 Initiating device code flow...\n'));
  if (!online && requestScope.includes('offline_access')) {
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

module.exports = {
  handleDeviceCodeLogin,
  getEnvironmentKey,
  validateEnvironmentKey
};

