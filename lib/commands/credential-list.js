/**
 * Credential list command – list credentials from Dataplane
 * GET /api/v1/credential. Used by `aifabrix credential list`.
 * The Controller does not expose this endpoint; credentials are listed from the Dataplane.
 *
 * @fileoverview Credential list command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { normalizeControllerUrl, resolveEnvironment } = require('../core/config');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
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
 * Extract credentials array from API response.
 * Handles: { data: { meta, data: [...] } } (paginated), { data: [...] }, { credentials: [...] }, { items: [...] }.
 * @param {Object} response - API response (e.g. { success, data } from API client, or raw body)
 * @returns {Array}
 */
function extractCredentials(response) {
  const body = response?.data ?? response;
  const data = body?.data ?? body;
  const items = data?.credentials ?? data?.items ?? (Array.isArray(data) ? data : []);
  return Array.isArray(items) ? items : [];
}

/**
 * Display credential list to user
 * @param {Array} list - Credentials array
 * @param {string} baseUrl - Dataplane (or base) URL for header
 */
function displayCredentialList(list, baseUrl) {
  logger.log(chalk.bold(`\n🔐 Credentials (${baseUrl}):\n`));
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
 * Ensure controller URL and auth; exit on failure. Returns { controllerUrl, authConfig } when valid.
 * @async
 * @param {Object} options - CLI options with optional controller
 * @returns {Promise<{controllerUrl: string, authConfig: Object}>}
 */
async function ensureControllerAndAuth(options) {
  const controllerUrl = options.controller || (await resolveControllerUrl());
  if (!controllerUrl) {
    logger.error(chalk.red('❌ Controller URL is required. Run "aifabrix login" first.'));
    process.exit(1);
  }
  const authResult = await getCredentialListAuth(controllerUrl);
  if (!authResult || !authResult.token) {
    logger.error(chalk.red(`❌ No authentication token for controller: ${controllerUrl}`));
    logger.error(chalk.gray('Run: aifabrix login'));
    process.exit(1);
  }
  return {
    controllerUrl,
    authConfig: { type: 'bearer', token: authResult.token }
  };
}

/**
 * Resolve Dataplane URL for credential list (override or discover from controller + environment)
 * @async
 * @param {string} controllerUrl - Controller base URL
 * @param {Object} authConfig - Auth config with token
 * @param {Object} options - CLI options
 * @param {string} [options.dataplane] - Optional Dataplane URL override
 * @returns {Promise<string>} Dataplane base URL
 * @throws {Error} When resolution fails (caller should exit)
 */
async function resolveCredentialListDataplaneUrl(controllerUrl, authConfig, options) {
  if (options.dataplane) {
    return options.dataplane.replace(/\/$/, '');
  }
  const environment = await resolveEnvironment();
  return await resolveDataplaneUrl(controllerUrl, environment, authConfig);
}

/**
 * Call Dataplane credential API and display results; exits on failure
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Auth config
 * @param {Object} listOptions - pageSize, activeOnly
 */
async function fetchAndDisplayCredentials(dataplaneUrl, authConfig, listOptions) {
  const response = await listCredentials(dataplaneUrl, authConfig, listOptions);
  displayCredentialList(extractCredentials(response), dataplaneUrl);
}

/**
 * Resolve Dataplane URL or log error and exit
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {Object} authConfig - Auth config
 * @param {Object} options - CLI options
 * @returns {Promise<string>} Dataplane URL (never returns on failure; process.exit(1))
 */
async function resolveDataplaneUrlOrExit(controllerUrl, authConfig, options) {
  try {
    return await resolveCredentialListDataplaneUrl(controllerUrl, authConfig, options);
  } catch (err) {
    logger.error(chalk.red(`❌ Could not resolve Dataplane URL: ${err.message}`));
    logger.error(chalk.gray('Use --dataplane <url> to specify the Dataplane URL directly.'));
    process.exit(1);
  }
}

/**
 * Run credential list command: call GET /api/v1/credential on Dataplane and display results
 * @async
 * @param {Object} options - CLI options
 * @param {string} [options.controller] - Controller URL override
 * @param {string} [options.dataplane] - Dataplane URL override (default: resolved from controller + environment)
 * @param {boolean} [options.activeOnly] - List only active credentials
 * @param {number} [options.pageSize] - Items per page
 * @returns {Promise<void>}
 */
async function runCredentialList(options = {}) {
  const { controllerUrl, authConfig } = await ensureControllerAndAuth(options);
  const dataplaneUrl = await resolveDataplaneUrlOrExit(controllerUrl, authConfig, options);
  const listOptions = {
    pageSize: options.pageSize || DEFAULT_PAGE_SIZE,
    activeOnly: options.activeOnly
  };
  try {
    await fetchAndDisplayCredentials(dataplaneUrl, authConfig, listOptions);
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to list credentials: ${error.message}`));
    process.exit(1);
  }
}

module.exports = { runCredentialList };
