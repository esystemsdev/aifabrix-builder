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
const { findDataplaneServiceAppKey } = require('./wizard-dataplane');
const { getDataplaneUrl } = require('../datasource/deploy');
const { checkDataplaneHealth } = require('../utils/dataplane-health');

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

  logger.log(`  Status: ${statusIcon} ${statusText}`);
  logger.log(`  Token Type: ${chalk.cyan(tokenInfo.type)}`);

  if (tokenInfo.appName) {
    logger.log(`  Application: ${chalk.cyan(tokenInfo.appName)}`);
  }

  if (tokenInfo.expiresAt) {
    logger.log(`  Expires: ${chalk.gray(formatExpiration(tokenInfo.expiresAt))}`);
  }

  if (tokenInfo.error) {
    logger.log(`Error: ${chalk.red(tokenInfo.error)}`);
  }

  displayUserInfo(tokenInfo.user);
}

/**
 * Resolve dataplane URL from controller without progress logs (for auth status display)
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<string|null>} Dataplane URL or null if not discoverable
 */
async function resolveDataplaneUrlSilent(controllerUrl, environment, authConfig) {
  try {
    const dataplaneAppKey = await findDataplaneServiceAppKey(controllerUrl, environment, authConfig);
    if (dataplaneAppKey) {
      return await getDataplaneUrl(controllerUrl, dataplaneAppKey, environment, authConfig);
    }
    return await getDataplaneUrl(controllerUrl, 'dataplane', environment, authConfig);
  } catch {
    return null;
  }
}

/**
 * Display dataplane section when authenticated
 * @param {string|null} dataplaneUrl - Dataplane URL or null
 * @param {boolean} dataplaneConnected - Whether dataplane health check passed
 */
function displayDataplaneSection(dataplaneUrl, dataplaneConnected) {
  logger.log('');
  if (dataplaneUrl) {
    logger.log(`Dataplane: ${chalk.cyan(dataplaneUrl)}`);
    const statusIcon = dataplaneConnected ? chalk.green('✓') : chalk.red('✗');
    const statusText = dataplaneConnected ? 'Connected' : 'Not reachable';
    displayOpenApiDocs(null, dataplaneUrl);
    logger.log('');
    logger.log(`  Status: ${statusIcon} ${statusText}`);
  } else {
    logger.log(`Dataplane: ${chalk.gray('—')}`);
    logger.log('');
    logger.log(`  Status: ${chalk.gray('Not discovered')}`);
  }
}

/**
 * Normalize base URL (no trailing slash) for docs path
 * @param {string} url - Base URL
 * @returns {string} URL without trailing slash
 */
function normalizeBaseUrl(url) {
  return (url || '').replace(/\/$/, '');
}

/**
 * Display Open API documentation links (Controller and Dataplane)
 * @param {string} controllerUrl - Controller URL
 * @param {string|null} dataplaneUrl - Dataplane URL or null
 */
function displayOpenApiDocs(controllerUrl, dataplaneUrl) {
  const controllerBase = normalizeBaseUrl(controllerUrl);
  if (controllerBase) {
    logger.log(`  Open API docs: ${chalk.cyan(controllerBase + '/api/docs')}`);
  }
  if (dataplaneUrl) {
    const dataplaneBase = normalizeBaseUrl(dataplaneUrl);
    logger.log(`  Open API docs: ${chalk.cyan(dataplaneBase + '/api/docs')}`);
  }
}

/**
 * Display authentication status
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object|null} tokenInfo - Token information
 * @param {Object} [dataplaneInfo] - Optional dataplane URL and health
 * @param {string|null} [dataplaneInfo.url] - Dataplane URL
 * @param {boolean} [dataplaneInfo.connected] - Whether dataplane is reachable
 */
function displayStatus(controllerUrl, environment, tokenInfo, dataplaneInfo) {
  logger.log(chalk.bold('\n🔐 Authentication Status\n'));
  logger.log(`Controller: ${chalk.cyan(controllerUrl)}`);
  displayOpenApiDocs(controllerUrl, null);
  logger.log(`  Environment: ${chalk.cyan(environment || 'Not specified')}\n`);

  if (!tokenInfo) {
    logger.log(`  Status: ${chalk.red('✗ Not authenticated')}`);
    logger.log(`  Token Type: ${chalk.gray('None')}\n`);
    logger.log(chalk.yellow('💡 Run "aifabrix login" to authenticate\n'));
    return;
  }

  displayTokenInfo(tokenInfo);

  if (tokenInfo.authenticated && dataplaneInfo) {
    displayDataplaneSection(dataplaneInfo.url, dataplaneInfo.connected);
  }

  logger.log('');
}

/**
 * Handle auth status command
 * Controller and environment come from config.yaml (set via aifabrix login or aifabrix auth config).
 * @async
 * @function handleAuthStatus
 * @param {Object} options - Command options
 * @param {boolean} [options.validate] - If true, exit with code 1 when not authenticated
 * @returns {Promise<void>} Resolves when status is displayed
 */
async function handleAuthStatus(options = {}) {
  const { resolveEnvironment } = require('../core/config');
  const controllerUrl = await resolveControllerUrl();
  const environment = await resolveEnvironment();

  // Check device token first (preferred)
  let tokenInfo = await checkDeviceToken(controllerUrl);

  // If no device token, check client token
  if (!tokenInfo) {
    tokenInfo = await checkClientToken(controllerUrl, environment);
  }

  let dataplaneInfo = null;
  if (tokenInfo && tokenInfo.authenticated && tokenInfo.token) {
    const authConfig = { type: 'bearer', token: tokenInfo.token };
    const dataplaneUrl = await resolveDataplaneUrlSilent(controllerUrl, environment, authConfig);
    const connected = dataplaneUrl ? await checkDataplaneHealth(dataplaneUrl, 5000) : false;
    dataplaneInfo = { url: dataplaneUrl, connected };
  }

  displayStatus(controllerUrl, environment, tokenInfo, dataplaneInfo);

  if (options.validate && (!tokenInfo || !tokenInfo.authenticated)) {
    process.exit(1);
  }
}

/**
 * Get resolved auth context (controller URL, environment, authConfig) for use after validation.
 * Call only when auth status --validate has already passed (e.g. in manual tests).
 * @async
 * @function getValidatedAuthContext
 * @returns {Promise<{controllerUrl: string, environment: string, authConfig: Object, dataplaneUrl: string|null}>}
 * @throws {Error} If not authenticated
 */
async function getValidatedAuthContext() {
  const { resolveEnvironment } = require('../core/config');
  const controllerUrl = await resolveControllerUrl();
  const environment = await resolveEnvironment();

  let tokenInfo = await checkDeviceToken(controllerUrl);
  if (!tokenInfo) {
    tokenInfo = await checkClientToken(controllerUrl, environment);
  }

  if (!tokenInfo || !tokenInfo.authenticated || !tokenInfo.token) {
    throw new Error('Not authenticated. Run "aifabrix login" or configure client credentials.');
  }

  const authConfig = { type: 'bearer', token: tokenInfo.token };
  const dataplaneUrl = await resolveDataplaneUrlSilent(controllerUrl, environment, authConfig);

  return { controllerUrl, environment, authConfig, dataplaneUrl };
}

module.exports = { handleAuthStatus, getValidatedAuthContext };
