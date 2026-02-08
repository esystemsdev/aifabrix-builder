/**
 * Credential list command – list credentials from controller/dataplane
 * GET /api/v1/credential. Used by `aifabrix credential list`.
 *
 * @fileoverview Credential list command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { normalizeControllerUrl } = require('../core/config');
const { listCredentials } = require('../api/credentials.api');

const DEFAULT_PAGE_SIZE = 50;

/**
 * Get auth token for credential list (device token from config)
 * @async
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<{token: string, controllerUrl: string}|null>}
 */
async function getCredentialListAuth(controllerUrl) {
  const normalizedUrl = normalizeControllerUrl(controllerUrl);
  const deviceToken = await getOrRefreshDeviceToken(normalizedUrl);
  if (deviceToken && deviceToken.token) {
    return {
      token: deviceToken.token,
      controllerUrl: deviceToken.controller || normalizedUrl
    };
  }
  return null;
}

/**
 * Extract credentials array from API response
 * @param {Object} response - API response
 * @returns {Array}
 */
function extractCredentials(response) {
  const data = response?.data ?? response;
  const items = data?.credentials ?? data?.items ?? (Array.isArray(data) ? data : []);
  return Array.isArray(items) ? items : [];
}

/**
 * Display credential list to user
 * @param {Array} list - Credentials array
 * @param {string} controllerUrl - Controller URL for header
 */
function displayCredentialList(list, controllerUrl) {
  logger.log(chalk.bold(`\n🔐 Credentials (${controllerUrl}):\n`));
  if (list.length === 0) {
    logger.log(chalk.gray('  No credentials found.\n'));
    return;
  }
  list.forEach((c) => {
    const key = c.key ?? c.id ?? c.credentialKey ?? '-';
    const name = c.displayName ?? c.name ?? key;
    logger.log(`  ${chalk.cyan(key)} - ${name}`);
  });
  logger.log('');
}

/**
 * Run credential list command: call GET /api/v1/credential and display results
 * @async
 * @param {Object} options - CLI options
 * @param {string} [options.controller] - Controller URL override
 * @param {boolean} [options.activeOnly] - List only active credentials
 * @param {number} [options.pageSize] - Items per page
 * @returns {Promise<void>}
 */
async function runCredentialList(options = {}) {
  const controllerUrl = options.controller || (await resolveControllerUrl());
  if (!controllerUrl) {
    logger.error(chalk.red('❌ Controller URL is required. Run "aifabrix login" first.'));
    process.exit(1);
    return;
  }
  const authResult = await getCredentialListAuth(controllerUrl);
  if (!authResult || !authResult.token) {
    logger.error(chalk.red(`❌ No authentication token for controller: ${controllerUrl}`));
    logger.error(chalk.gray('Run: aifabrix login'));
    process.exit(1);
    return;
  }
  const authConfig = { type: 'bearer', token: authResult.token };
  const listOptions = {
    pageSize: options.pageSize || DEFAULT_PAGE_SIZE,
    activeOnly: options.activeOnly
  };
  try {
    const response = await listCredentials(authResult.controllerUrl, authConfig, listOptions);
    displayCredentialList(extractCredentials(response), authResult.controllerUrl);
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to list credentials: ${error.message}`));
    process.exit(1);
  }
}

module.exports = { runCredentialList };
