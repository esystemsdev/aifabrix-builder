/**
 * Service user create command – create service user and get one-time secret
 * POST /api/v1/service-users. Used by `aifabrix service-user create`.
 *
 * @fileoverview Service user create command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { normalizeControllerUrl } = require('../core/config');
const { createServiceUser } = require('../api/service-users.api');

const ONE_TIME_WARNING =
  'Save this secret now; it will not be shown again.';

/**
 * Get auth token for service-user (device token from config)
 * @async
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<{token: string, controllerUrl: string}|null>}
 */
async function getServiceUserAuth(controllerUrl) {
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
 * Extract clientId and clientSecret from API response.
 * Controller returns { data: { user, clientSecret } }; API client puts body in response.data.
 * So payload is at response.data.data. clientId may be on user.clientId or user.federatedIdentity.keycloakClientId.
 * @param {Object} response - API response (success: true, data: body)
 * @returns {{ clientId: string, clientSecret: string }}
 */
function extractCreateResponse(response) {
  const payload = response?.data?.data ?? response?.data ?? response;
  const user = payload?.user;
  const clientId =
    user?.clientId ??
    user?.federatedIdentity?.keycloakClientId ??
    payload?.clientId ??
    '';
  const clientSecret = payload?.clientSecret ?? '';
  return { clientId, clientSecret };
}

/**
 * Log error for failed create response and exit
 * @param {Object} response - API response with success: false
 */
function handleCreateError(response) {
  const status = response.status;
  const msg = response.formattedError || response.error || 'Request failed';
  if (status === 400) {
    logger.error(chalk.red(`❌ Validation error: ${msg}`));
  } else if (status === 401) {
    logger.error(chalk.red('❌ Unauthorized. Run "aifabrix login" and try again.'));
  } else if (status === 403) {
    logger.error(chalk.red('❌ Missing permission: service-user:create'));
    logger.error(chalk.gray('Your account needs the service-user:create permission on the controller.'));
  } else {
    logger.error(chalk.red(`❌ Failed to create service user: ${msg}`));
  }
  process.exit(1);
}

/**
 * Display success output with clientId, clientSecret and one-time warning
 * @param {string} clientId - Service user client ID
 * @param {string} clientSecret - One-time client secret
 */
function displayCreateSuccess(clientId, clientSecret) {
  logger.log(chalk.bold('\n✓ Service user created\n'));
  logger.log(chalk.cyan('  clientId:    ') + clientId);
  logger.log(chalk.cyan('  clientSecret: ') + clientSecret);
  logger.log('');
  logger.log(chalk.yellow('⚠ ' + ONE_TIME_WARNING));
  logger.log('');
}

/**
 * Parse comma-separated string into non-empty trimmed array
 * @param {string} [val] - Comma-separated value
 * @returns {string[]}
 */
function parseList(val) {
  if (val === undefined || val === null || String(val).trim() === '') {
    return [];
  }
  return String(val)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Validate username, email, redirectUris, groupIds; exit on failure
 * @param {Object} options - CLI options
 * @returns {{ username: string, email: string, redirectUris: string[], groupNames: string[], description?: string }}
 */
function validateServiceUserOptions(options) {
  const username = options.username?.trim();
  const email = options.email?.trim();
  const redirectUris = parseList(options.redirectUris);
  const groupNames = parseList(options.groupNames);
  if (!username) {
    logger.error(chalk.red('❌ Username is required. Use --username <username>.'));
    process.exit(1);
  }
  if (!email) {
    logger.error(chalk.red('❌ Email is required. Use --email <email>.'));
    process.exit(1);
  }
  if (redirectUris.length === 0) {
    logger.error(chalk.red('❌ At least one redirect URI is required. Use --redirect-uris <uri1,uri2,...>.'));
    process.exit(1);
  }
  if (groupNames.length === 0) {
    logger.error(chalk.red('❌ At least one group name is required. Use --group-names <name1,name2,...>.'));
    process.exit(1);
  }
  return {
    username,
    email,
    redirectUris,
    groupNames,
    description: options.description?.trim() || undefined
  };
}

/**
 * Resolve controller URL and auth; exit on failure
 * @async
 * @param {Object} options - CLI options
 * @returns {Promise<{ username: string, email: string, redirectUris: string[], groupNames: string[], description?: string, controllerUrl: string, authConfig: Object }>}
 */
async function resolveOptionsAndAuth(options) {
  const validated = validateServiceUserOptions(options);
  const controllerUrl = options.controller || (await resolveControllerUrl());
  if (!controllerUrl) {
    logger.error(chalk.red('❌ Controller URL is required. Run "aifabrix login" first.'));
    process.exit(1);
  }
  const authResult = await getServiceUserAuth(controllerUrl);
  if (!authResult || !authResult.token) {
    logger.error(chalk.red(`❌ No authentication token for controller: ${controllerUrl}`));
    logger.error(chalk.gray('Run: aifabrix login'));
    process.exit(1);
  }
  return {
    ...validated,
    controllerUrl: authResult.controllerUrl,
    authConfig: { type: 'bearer', token: authResult.token }
  };
}

/**
 * Run service-user create: call POST /api/v1/service-users and display one-time secret with warning
 * @async
 * @param {Object} options - CLI options
 * @param {string} [options.controller] - Controller URL override
 * @param {string} options.username - Username (required)
 * @param {string} options.email - Email (required)
 * @param {string} options.redirectUris - Comma-separated redirect URIs (required, min 1)
 * @param {string} options.groupNames - Comma-separated group names (required, e.g. AI-Fabrix-Developers)
 * @param {string} [options.description] - Optional description
 * @returns {Promise<void>}
 */
async function runServiceUserCreate(options = {}) {
  const ctx = await resolveOptionsAndAuth(options);
  const body = {
    username: ctx.username,
    email: ctx.email,
    redirectUris: ctx.redirectUris,
    groupNames: ctx.groupNames,
    description: ctx.description
  };
  const response = await createServiceUser(ctx.controllerUrl, ctx.authConfig, body);
  if (!response.success) {
    handleCreateError(response);
    return;
  }
  const { clientId, clientSecret } = extractCreateResponse(response);
  displayCreateSuccess(clientId, clientSecret);
}

module.exports = {
  runServiceUserCreate
};
