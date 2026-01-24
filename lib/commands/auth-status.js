/**
 * AI Fabrix Builder - Auth Status Command
 *
 * Displays authentication status for the current controller and environment
 *
 * @fileoverview Authentication status command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const { getConfig } = config;
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { getAuthUser } = require('../api/auth.api');
const { resolveControllerUrl } = require('../utils/controller-url');

/**
 * Format expiration date for display
 * @param {string} expiresAt - ISO 8601 expiration timestamp
 * @returns {string} Formatted expiration string
 */
function formatExpiration(expiresAt) {
  if (!expiresAt) {
    return 'Unknown';
  }
  try {
    const date = new Date(expiresAt);
    return date.toISOString();
  } catch {
    return expiresAt;
  }
}

/**
 * Check and validate device token
 * @async
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<Object|null>} Token validation result or null
 */
async function checkDeviceToken(controllerUrl) {
  const deviceToken = await getOrRefreshDeviceToken(controllerUrl);
  if (!deviceToken || !deviceToken.token) {
    return null;
  }

  try {
    const authConfig = { type: 'bearer', token: deviceToken.token };
    // Use getAuthUser instead of validateToken - it's more reliable and tests actual API access
    const { getAuthUser } = require('../api/auth.api');
    const response = await getAuthUser(controllerUrl, authConfig);

    if (response.success && response.data) {
      return {
        type: 'Device Token',
        token: deviceToken.token,
        authenticated: response.data.authenticated !== false,
        user: response.data.user,
        expiresAt: deviceToken.expiresAt
      };
    }

    return {
      type: 'Device Token',
      token: deviceToken.token,
      authenticated: false,
      error: response.error || response.formattedError || 'Token validation failed'
    };
  } catch (error) {
    return {
      type: 'Device Token',
      token: deviceToken.token,
      authenticated: false,
      error: error.message || 'Token validation error'
    };
  }
}

/**
 * Decrypt token if encrypted
 * @async
 * @param {string} token - Token to decrypt
 * @returns {Promise<string>} Decrypted token
 */
async function decryptTokenIfNeeded(token) {
  const { decryptToken, isTokenEncrypted } = require('../utils/token-encryption');
  const encryptionKey = await config.getSecretsEncryptionKey();

  if (encryptionKey && isTokenEncrypted(token)) {
    return await decryptToken(token, encryptionKey);
  }
  return token;
}

/**
 * Validate client token and return result
 * @async
 * @param {string} token - Token to validate
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @param {string} expiresAt - Token expiration
 * @returns {Promise<Object>} Token validation result
 */
async function validateClientToken(token, controllerUrl, environment, appName, expiresAt) {
  try {
    const authConfig = { type: 'bearer', token: token };
    // Use getAuthUser instead of validateToken - it's more reliable and tests actual API access
    const response = await getAuthUser(controllerUrl, authConfig);

    if (response.success && response.data) {
      return {
        type: 'Client Token',
        token: token,
        authenticated: response.data.authenticated !== false,
        user: response.data.user,
        expiresAt: expiresAt,
        appName: appName
      };
    }

    return {
      type: 'Client Token',
      token: token,
      authenticated: false,
      error: response.error || response.formattedError || 'Token validation failed',
      appName: appName
    };
  } catch (error) {
    return {
      type: 'Client Token',
      token: '***',
      authenticated: false,
      error: error.message || 'Token validation error',
      appName: appName
    };
  }
}

/**
 * Check and validate client token
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @returns {Promise<Object|null>} Token validation result or null
 */
async function checkClientToken(controllerUrl, environment) {
  const configData = await getConfig();
  const environments = configData.environments || {};
  const envConfig = environments[environment];

  if (!envConfig || !envConfig.clients) {
    return null;
  }

  for (const [appName, tokenData] of Object.entries(envConfig.clients)) {
    if (tokenData.controller === controllerUrl && tokenData.token) {
      const token = await decryptTokenIfNeeded(tokenData.token);
      return await validateClientToken(token, controllerUrl, environment, appName, tokenData.expiresAt);
    }
  }

  return null;
}

/**
 * Display user information
 * @param {Object} user - User object
 */
function displayUserInfo(user) {
  if (!user) {
    return;
  }

  logger.log('');
  logger.log(chalk.bold('User Information:'));
  if (user.email) {
    logger.log(`  Email: ${chalk.cyan(user.email)}`);
  }
  if (user.username) {
    logger.log(`  Username: ${chalk.cyan(user.username)}`);
  }
  if (user.id) {
    logger.log(`  ID: ${chalk.gray(user.id)}`);
  }
}

/**
 * Display token information
 * @param {Object} tokenInfo - Token information
 */
function displayTokenInfo(tokenInfo) {
  const statusIcon = tokenInfo.authenticated ? chalk.green('✓') : chalk.red('✗');
  const statusText = tokenInfo.authenticated ? 'Authenticated' : 'Not authenticated';

  logger.log(`Status: ${statusIcon} ${statusText}`);
  logger.log(`Token Type: ${chalk.cyan(tokenInfo.type)}`);

  if (tokenInfo.appName) {
    logger.log(`Application: ${chalk.cyan(tokenInfo.appName)}`);
  }

  if (tokenInfo.expiresAt) {
    logger.log(`Expires: ${chalk.gray(formatExpiration(tokenInfo.expiresAt))}`);
  }

  if (tokenInfo.error) {
    logger.log(`Error: ${chalk.red(tokenInfo.error)}`);
  }

  displayUserInfo(tokenInfo.user);
}

/**
 * Display authentication status
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object|null} tokenInfo - Token information
 */
function displayStatus(controllerUrl, environment, tokenInfo) {
  logger.log(chalk.bold('\n🔐 Authentication Status\n'));
  logger.log(`Controller: ${chalk.cyan(controllerUrl)}`);
  logger.log(`Environment: ${chalk.cyan(environment || 'Not specified')}\n`);

  if (!tokenInfo) {
    logger.log(`Status: ${chalk.red('✗ Not authenticated')}`);
    logger.log(`Token Type: ${chalk.gray('None')}\n`);
    logger.log(chalk.yellow('💡 Run "aifabrix login" to authenticate\n'));
    return;
  }

  displayTokenInfo(tokenInfo);
  logger.log('');
}

/**
 * Handle auth status command
 * Controller and environment come from config.yaml (set via aifabrix login or aifabrix auth config).
 * @async
 * @function handleAuthStatus
 * @param {Object} _options - Command options (unused; controller/environment from config only)
 * @returns {Promise<void>} Resolves when status is displayed
 */
async function handleAuthStatus(_options) {
  const { resolveEnvironment } = require('../core/config');
  const controllerUrl = await resolveControllerUrl();
  const environment = await resolveEnvironment();

  // Check device token first (preferred)
  let tokenInfo = await checkDeviceToken(controllerUrl);

  // If no device token, check client token
  if (!tokenInfo) {
    tokenInfo = await checkClientToken(controllerUrl, environment);
  }

  displayStatus(controllerUrl, environment, tokenInfo);
}

module.exports = { handleAuthStatus };
