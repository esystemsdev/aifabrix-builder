const { formatBlockingError, formatSuccessLine } = require('../utils/cli-test-layout-chalk');
/**
 * Integration client commands — OAuth/API clients on the Controller.
 *
 * @fileoverview integration-client command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { normalizeControllerUrl } = require('../core/config');
const {
  createIntegrationClient,
  listIntegrationClients,
  regenerateIntegrationClientSecret,
  deleteIntegrationClient,
  updateIntegrationClientGroups,
  updateIntegrationClientRedirectUris
} = require('../api/integration-clients.api');

const ONE_TIME_WARNING =
  'Save this secret now; it will not be shown again.';

/** Controller-valid key: lowercase letter/digit start, then alphanumeric + hyphens */
const INTEGRATION_CLIENT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * @param {string|undefined} key - Raw key from CLI
 * @returns {string} Trimmed key
 */
function requireValidIntegrationClientKey(key) {
  const trimmed = key?.trim();
  if (!trimmed) {
    logger.error(formatBlockingError('Key is required. Use --key <key>.'));
    process.exit(1);
  }
  if (!INTEGRATION_CLIENT_KEY_PATTERN.test(trimmed)) {
    logger.error(
      formatBlockingError(
        'Key must start with a letter or digit and contain only lowercase letters, digits, and hyphens (e.g. my-ci-client).'
      )
    );
    process.exit(1);
  }
  return trimmed;
}

/**
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<{token: string, controllerUrl: string}|null>}
 */
async function getIntegrationClientAuth(controllerUrl) {
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
 * @param {Object} response - API response (success: true, data: body)
 * @returns {{ clientId: string, clientSecret: string }}
 */
function extractCreateResponse(response) {
  const payload = response?.data?.data ?? response?.data ?? response;
  const ic = payload?.integrationClient;
  const clientId =
    ic?.keycloakClientId ??
    ic?.key ??
    payload?.clientId ??
    '';
  const clientSecret = payload?.clientSecret ?? '';
  return { clientId, clientSecret };
}

const ID_WIDTH = 38;
const KEY_WIDTH = 22;
const DISPLAY_WIDTH = 28;
const CLIENT_ID_WIDTH = 26;
const STATUS_WIDTH = 12;
const TABLE_SEPARATOR_LENGTH =
  ID_WIDTH + KEY_WIDTH + DISPLAY_WIDTH + CLIENT_ID_WIDTH + STATUS_WIDTH;

/**
 * @param {Object} response - API response with success: false
 */
function handleCreateError(response) {
  const status = response.status;
  const msg = response.formattedError || response.error || 'Request failed';
  if (status === 400) {
    logger.error(formatBlockingError(`Validation error: ${msg}`));
  } else if (status === 401) {
    logger.error(formatBlockingError('Unauthorized. Run "aifabrix login" and try again.'));
  } else if (status === 403) {
    logger.error(formatBlockingError('Missing permission: integration-client:create'));
    logger.error(chalk.gray('Your account needs the integration-client:create permission on the controller.'));
  } else {
    logger.error(formatBlockingError(`Failed to create integration client: ${msg}`));
  }
  process.exit(1);
}

/**
 * @param {Object} response - API response with success: false
 * @param {'read'|'update'|'delete'} permissionScope - Permission hint
 */
function handleIntegrationClientApiError(response, permissionScope) {
  const status = response.status;
  const msg = response.formattedError || response.error || 'Request failed';
  if (status === 400) {
    logger.error(formatBlockingError(`Validation error: ${msg}`));
  } else if (status === 401) {
    logger.error(formatBlockingError('Unauthorized. Run "aifabrix login" and try again.'));
  } else if (status === 403) {
    logger.error(formatBlockingError(`Missing permission: integration-client:${permissionScope}`));
    logger.error(
      chalk.gray(
        `Your account needs the integration-client:${permissionScope} permission on the controller.`
      )
    );
  } else if (status === 404) {
    logger.error(formatBlockingError('Integration client not found.'));
    const detail = response.error || '';
    if (detail) {
      logger.error(chalk.gray(detail));
    }
  } else {
    logger.error(formatBlockingError(`Request failed: ${msg}`));
  }
  process.exit(1);
}

/**
 * @async
 * @param {Object} options - CLI options (controller optional)
 * @returns {Promise<{ controllerUrl: string, authConfig: Object }>}
 */
async function resolveControllerAndAuth(options) {
  const controllerUrl = options.controller || (await resolveControllerUrl());
  if (!controllerUrl) {
    logger.error(formatBlockingError('Controller URL is required. Run "aifabrix login" first.'));
    process.exit(1);
  }
  const authResult = await getIntegrationClientAuth(controllerUrl);
  if (!authResult || !authResult.token) {
    logger.error(formatBlockingError(`No authentication token for controller: ${controllerUrl}`));
    logger.error(chalk.gray('Run: aifabrix login'));
    process.exit(1);
  }
  return {
    controllerUrl: authResult.controllerUrl,
    authConfig: { type: 'bearer', token: authResult.token }
  };
}

/**
 * @param {Array<Record<string, unknown>>} items - Integration clients
 */
function displayIntegrationClientList(items) {
  logger.log(chalk.bold('\n📋 Integration clients:\n'));
  if (!items || items.length === 0) {
    logger.log(chalk.gray('  No integration clients found.\n'));
    return;
  }
  const idCol = 'Id'.padEnd(ID_WIDTH);
  const keyCol = 'Key'.padEnd(KEY_WIDTH);
  const displayCol = 'Display'.padEnd(DISPLAY_WIDTH);
  const clientIdCol = 'ClientId'.padEnd(CLIENT_ID_WIDTH);
  const statusCol = 'Status'.padEnd(STATUS_WIDTH);
  logger.log(chalk.gray(`${idCol}${keyCol}${displayCol}${clientIdCol}${statusCol}`));
  logger.log(chalk.gray('-'.repeat(TABLE_SEPARATOR_LENGTH)));
  items.forEach((row) => {
    const id = (row.id ?? '').toString().padEnd(ID_WIDTH);
    const key = (row.key ?? '—').toString().padEnd(KEY_WIDTH);
    const displayName = (row.displayName ?? '—').toString().padEnd(DISPLAY_WIDTH);
    const kcId = (row.keycloakClientId ?? '—').toString().padEnd(CLIENT_ID_WIDTH);
    const status = (row.status ?? '—').toString().padEnd(STATUS_WIDTH);
    logger.log(`${id}${key}${displayName}${kcId}${status}`);
  });
  logger.log('');
}

/**
 * @param {string} clientId - OAuth client id (Keycloak)
 * @param {string} clientSecret - One-time client secret
 */
function displayCreateSuccess(clientId, clientSecret) {
  logger.log(chalk.bold('\n✔ Integration client created\n'));
  logger.log(chalk.cyan('  clientId:    ') + clientId);
  logger.log(chalk.cyan('  clientSecret: ') + clientSecret);
  logger.log('');
  logger.log(chalk.yellow('⚠ ' + ONE_TIME_WARNING));
  logger.log('');
}

/**
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
 * @param {Object} options - CLI options
 * @returns {{ key: string, displayName: string, redirectUris: string[], groupNames: string[], description?: string, keycloakClientId?: string }}
 */
function validateIntegrationClientCreateOptions(options) {
  const key = requireValidIntegrationClientKey(options.key);
  const displayName = options.displayName?.trim();
  const redirectUris = parseList(options.redirectUris);
  const groupNames = parseList(options.groupNames);
  if (!displayName) {
    logger.error(formatBlockingError('Display name is required. Use --display-name <name>.'));
    process.exit(1);
  }
  if (redirectUris.length === 0) {
    logger.error(formatBlockingError('At least one redirect URI is required. Use --redirect-uris <uri1,uri2,...>.'));
    process.exit(1);
  }
  const out = {
    key,
    displayName,
    redirectUris,
    groupNames,
    description: options.description?.trim() || undefined
  };
  const kc = options.keycloakClientId?.trim();
  if (kc) {
    out.keycloakClientId = kc;
  }
  return out;
}

/**
 * @async
 * @param {Object} options - CLI options
 * @returns {Promise<Object>}
 */
async function resolveOptionsAndAuth(options) {
  const validated = validateIntegrationClientCreateOptions(options);
  const controllerUrl = options.controller || (await resolveControllerUrl());
  if (!controllerUrl) {
    logger.error(formatBlockingError('Controller URL is required. Run "aifabrix login" first.'));
    process.exit(1);
  }
  const authResult = await getIntegrationClientAuth(controllerUrl);
  if (!authResult || !authResult.token) {
    logger.error(formatBlockingError(`No authentication token for controller: ${controllerUrl}`));
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
 * @async
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
async function runIntegrationClientCreate(options = {}) {
  const ctx = await resolveOptionsAndAuth(options);
  const body = {
    key: ctx.key,
    displayName: ctx.displayName,
    redirectUris: ctx.redirectUris,
    groupNames: ctx.groupNames,
    description: ctx.description,
    keycloakClientId: ctx.keycloakClientId
  };
  const response = await createIntegrationClient(ctx.controllerUrl, ctx.authConfig, body);
  if (!response.success) {
    handleCreateError(response);
    return;
  }
  const { clientId, clientSecret } = extractCreateResponse(response);
  displayCreateSuccess(clientId, clientSecret);
}

/**
 * @param {string} [id]
 * @returns {string}
 */
function requireIntegrationClientId(id) {
  const trimmed = (id && typeof id === 'string' ? id.trim() : '') || '';
  if (!trimmed) {
    logger.error(formatBlockingError('Integration client ID is required. Use --id <uuid>.'));
    process.exit(1);
  }
  return trimmed;
}

/**
 * @async
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
async function runIntegrationClientList(options = {}) {
  const { controllerUrl, authConfig } = await resolveControllerAndAuth(options);
  const listOptions = {
    page: options.page,
    pageSize: options.pageSize,
    sort: options.sort,
    filter: options.filter,
    search: options.search
  };
  const response = await listIntegrationClients(controllerUrl, authConfig, listOptions);
  if (response && response.success === false) {
    handleIntegrationClientApiError(response, 'read');
    return;
  }
  const body = response?.data?.data ?? response?.data ?? response ?? {};
  const items = Array.isArray(body) ? body : (body.data ?? []);
  displayIntegrationClientList(items);
}

/**
 * @async
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
async function runIntegrationClientRotateSecret(options = {}) {
  const id = requireIntegrationClientId(options.id);
  const { controllerUrl, authConfig } = await resolveControllerAndAuth(options);
  const response = await regenerateIntegrationClientSecret(controllerUrl, authConfig, id);
  if (response && response.success === false) {
    handleIntegrationClientApiError(response, 'update');
    return;
  }
  const payload = response?.data?.data ?? response?.data ?? response ?? {};
  const clientSecret = payload?.clientSecret ?? '';
  if (response && response.success === true) {
    logger.log(chalk.bold('\n✔ Secret rotated\n'));
    logger.log(chalk.cyan('  clientSecret: ') + clientSecret);
    logger.log('');
    logger.log(chalk.yellow('⚠ ' + ONE_TIME_WARNING));
    logger.log('');
  }
}

/**
 * @async
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
async function runIntegrationClientDelete(options = {}) {
  const id = requireIntegrationClientId(options.id);
  const { controllerUrl, authConfig } = await resolveControllerAndAuth(options);
  const response = await deleteIntegrationClient(controllerUrl, authConfig, id);
  if (response && response.success === false) {
    handleIntegrationClientApiError(response, 'delete');
    return;
  }
  if (response && response.success === true) {
    logger.log(formatSuccessLine('Integration client deactivated.\n'));
  }
}

/**
 * @async
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
async function runIntegrationClientUpdateGroups(options = {}) {
  const id = requireIntegrationClientId(options.id);
  const groupNames = parseList(options.groupNames);
  if (groupNames.length === 0) {
    logger.error(formatBlockingError('At least one group name is required. Use --group-names <name1,name2,...>.'));
    process.exit(1);
  }
  const { controllerUrl, authConfig } = await resolveControllerAndAuth(options);
  const response = await updateIntegrationClientGroups(controllerUrl, authConfig, id, { groupNames });
  if (response && response.success === false) {
    handleIntegrationClientApiError(response, 'update');
    return;
  }
  if (response && response.success === true) {
    logger.log(formatSuccessLine('Integration client groups updated.\n'));
  }
}

/**
 * @async
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
async function runIntegrationClientUpdateRedirectUris(options = {}) {
  const id = requireIntegrationClientId(options.id);
  const redirectUris = parseList(options.redirectUris);
  if (redirectUris.length === 0) {
    logger.error(formatBlockingError('At least one redirect URI is required. Use --redirect-uris <uri1,uri2,...>.'));
    process.exit(1);
  }
  const { controllerUrl, authConfig } = await resolveControllerAndAuth(options);
  const response = await updateIntegrationClientRedirectUris(controllerUrl, authConfig, id, { redirectUris });
  if (response && response.success === false) {
    handleIntegrationClientApiError(response, 'update');
    return;
  }
  if (response && response.success === true) {
    logger.log(formatSuccessLine('Integration client redirect URIs updated.\n'));
  }
}

module.exports = {
  runIntegrationClientCreate,
  runIntegrationClientList,
  runIntegrationClientRotateSecret,
  runIntegrationClientDelete,
  runIntegrationClientUpdateGroups,
  runIntegrationClientUpdateRedirectUris
};
