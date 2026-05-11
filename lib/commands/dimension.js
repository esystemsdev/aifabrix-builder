/**
 * Dimension catalog commands (Controller).
 *
 * Commands:
 * - aifabrix dimension create
 * - aifabrix dimension get
 * - aifabrix dimension list
 *
 * @fileoverview Dimension CLI commands
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { normalizeControllerUrl, resolveEnvironment } = require('../core/config');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { readDimensionCreateFile } = require('../resolvers/dimension-file');
const {
  formatBlockingError,
  formatSuccessLine,
  infoLine,
  headerKeyValue
} = require('../utils/cli-layout-chalk');
const {
  listDimensions,
  getDimension,
  createDimensionIdempotent
} = require('../api/dimensions.api');
const { createDimensionValue } = require('../api/dimension-values.api');

const DIMENSION_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9-_]*$/;
const DATA_TYPES = new Set(['string', 'number', 'boolean']);

const DIMENSION_CREATE_HELP_AFTER = `

Examples:
  $ aifabrix dimension create --key customerRegion --display-name "Customer Region" --data-type string
  $ aifabrix dimension create --key dataClassification --display-name "Data Classification" --data-type string --required
  $ aifabrix dimension create --file ./customer-region.json

`;

const DIMENSION_GET_HELP_AFTER = `

Examples:
  $ aifabrix dimension get customerRegion
  $ aifabrix dimension get clx1234567890abcdef

`;

const DIMENSION_LIST_HELP_AFTER = `

Examples:
  $ aifabrix dimension list
  $ aifabrix dimension list --page 1 --page-size 50
  $ aifabrix dimension list --search region

`;

/**
 * @param {string} raw
 * @returns {string}
 */
function requireDimensionKey(raw) {
  const key = String(raw || '').trim();
  if (!key) {
    throw new Error('Dimension key is required (--key <key> or --file <path>).');
  }
  if (!DIMENSION_KEY_PATTERN.test(key)) {
    throw new Error(
      'Dimension key must start with a letter and contain only letters, numbers, hyphens, and underscores.'
    );
  }
  return key;
}

/**
 * @param {string} raw
 * @returns {'string'|'number'|'boolean'}
 */
function requireDataType(raw) {
  const dt = String(raw || '').trim();
  if (!dt) {
    throw new Error('dataType is required (--data-type string|number|boolean or in --file).');
  }
  if (!DATA_TYPES.has(dt)) {
    throw new Error('--data-type must be one of: string, number, boolean');
  }
  return /** @type {any} */ (dt);
}

/**
 * @param {Object} options
 * @returns {Promise<{ controllerUrl: string, authConfig: Object }>}
 */
async function resolveControllerAndAuth(_options) {
  const controllerUrl = await resolveControllerUrl();
  if (!controllerUrl) {
    throw new Error('Controller URL is required. Run "aifabrix login" first.');
  }
  const normalized = normalizeControllerUrl(controllerUrl);
  const deviceToken = await getOrRefreshDeviceToken(normalized);
  if (!deviceToken || !deviceToken.token) {
    throw new Error(
      `Not authenticated for controller: ${controllerUrl}. ` +
        'Run "aifabrix login" and try again.'
    );
  }
  return {
    controllerUrl: deviceToken.controller || normalized,
    authConfig: { type: 'bearer', token: deviceToken.token }
  };
}

async function resolveHeaderContext() {
  const env = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const normalized = normalizeControllerUrl(controllerUrl);
  return { environment: env || 'dev', controllerUrl: normalized };
}

/**
 * @param {Object} options
 * @returns {Object}
 */
function buildCreatePayload(options) {
  let base = {};
  if (options.file) {
    base = readDimensionCreateFile(options.file);
  }
  const payload = {
    ...base
  };
  if (options.key) payload.key = options.key;
  if (options.displayName) payload.displayName = options.displayName;
  if (options.description !== undefined) payload.description = options.description;
  if (options.dataType) payload.dataType = options.dataType;
  if (options.required !== undefined && options.required !== null) {
    payload.isRequired = Boolean(options.required);
  }
  payload.key = requireDimensionKey(payload.key);
  if (!payload.displayName) {
    throw new Error('displayName is required (--display-name <name> or in --file).');
  }
  payload.dataType = requireDataType(payload.dataType);
  return payload;
}

async function maybeCreateValuesFromFile(controllerUrl, authConfig, payload) {
  const values = payload?.values;
  if (!Array.isArray(values) || values.length === 0) return;
  const dimKey = String(payload.key || '').trim();
  for (const v of values) {
    const value = String(v?.value || '').trim();
    if (!value) {
      throw new Error('values[].value must be a non-empty string');
    }
    try {
      await createDimensionValue(controllerUrl, authConfig, dimKey, {
        value,
        displayName: v?.displayName,
        description: v?.description
      });
    } catch (e) {
      // Idempotent behavior: if the value already exists (409), treat as success.
      const msg = e?.message || String(e);
      if (/409|Conflict/i.test(msg)) {
        continue;
      }
      throw e;
    }
  }
}

/**
 * @param {Object} response
 * @returns {any}
 */
function unwrapControllerData(response) {
  return response?.data?.data ?? response?.data ?? response;
}

/**
 * @param {import('commander').Command} dim
 */
function setupDimensionCreateCommand(dim) {
  dim
    .command('create')
    .description('Create dimension (idempotent; success if it already exists)')
    .addHelpText('after', DIMENSION_CREATE_HELP_AFTER)
    .option('--file <path>', 'Read dimension create payload from JSON file')
    .option('--key <key>', 'Dimension key (letters, digits, hyphens, underscores)')
    .option('--display-name <name>', 'Display name')
    .option('--description <text>', 'Description')
    .option('--data-type <type>', 'string | number | boolean')
    .option('--required', 'Mark dimension required (isRequired=true)')
    .option('--no-required', 'Mark dimension not required (isRequired=false)')
    .action(async(options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth(options);
        const payload = buildCreatePayload(options);
        const out = await createDimensionIdempotent(controllerUrl, authConfig, payload);
        const dimRow = unwrapControllerData(out.response);
        await maybeCreateValuesFromFile(controllerUrl, authConfig, payload);
        if (out.created) {
          logger.log(formatSuccessLine(`Dimension created: ${dimRow.key}`));
          return;
        }
        logger.log(formatSuccessLine(`Dimension exists: ${dimRow.key}`));
        logger.log(infoLine('No changes were needed.'));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function setupDimensionGetCommand(dim) {
  dim
    .command('get <dimensionIdOrKey>')
    .description('Get dimension by id or key')
    .addHelpText('after', DIMENSION_GET_HELP_AFTER)
    .action(async(dimensionIdOrKey, options) => {
      try {
        const { environment, controllerUrl: headerControllerUrl } = await resolveHeaderContext();
        const { controllerUrl, authConfig } = await resolveControllerAndAuth(options);
        const res = await getDimension(controllerUrl, authConfig, String(dimensionIdOrKey).trim(), {
          includeValues: true
        });
        const row = unwrapControllerData(res);
        logger.log(chalk.bold(`\n📏 Dimension in ${environment} environment (${headerControllerUrl}):\n`));
        logger.log(headerKeyValue('Key:', row.key || '—'));
        logger.log(headerKeyValue('Display:', row.displayName || '—'));
        logger.log(headerKeyValue('Type:', row.dataType || '—'));
        logger.log(headerKeyValue('Required:', String(row.isRequired)));
        if (row.description) {
          logger.log(headerKeyValue('Description:', row.description));
        }
        if (Array.isArray(row.dimensionValues) && row.dimensionValues.length > 0) {
          logger.log('');
          logger.log(chalk.white.bold('Values:'));
          row.dimensionValues.forEach((v) => {
            const value = v?.value ? String(v.value) : '—';
            const display = v?.displayName ? String(v.displayName) : '';
            logger.log(`  ${chalk.white(value)}${display ? ` ${chalk.gray(`(${display})`)}` : ''}`);
          });
        }
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function setupDimensionListCommand(dim) {
  function displayDimensionList(items, environment, controllerUrl) {
    logger.log(chalk.bold(`\n📏 Dimensions in ${environment} environment (${controllerUrl}):\n`));
    if (!Array.isArray(items) || items.length === 0) {
      logger.log(chalk.gray('  No dimensions found.\n'));
      return;
    }

    const KEY_WIDTH = 26;
    const DISPLAY_WIDTH = 34;
    const TYPE_WIDTH = 10;
    const REQ_WIDTH = 10;
    const SEP_LEN = KEY_WIDTH + DISPLAY_WIDTH + TYPE_WIDTH + REQ_WIDTH;

    const keyCol = 'Key'.padEnd(KEY_WIDTH);
    const displayCol = 'Display'.padEnd(DISPLAY_WIDTH);
    const typeCol = 'Type'.padEnd(TYPE_WIDTH);
    const reqCol = 'Required'.padEnd(REQ_WIDTH);
    logger.log(chalk.gray(`${keyCol}${displayCol}${typeCol}${reqCol}`));
    logger.log(chalk.gray('-'.repeat(SEP_LEN)));

    items.forEach((d) => {
      const key = (d?.key ?? '—').toString().padEnd(KEY_WIDTH);
      const displayName = (d?.displayName ?? '—').toString().padEnd(DISPLAY_WIDTH);
      const dataType = (d?.dataType ?? '—').toString().padEnd(TYPE_WIDTH);
      const required = (d?.isRequired ?? '—').toString().padEnd(REQ_WIDTH);
      logger.log(`${key}${displayName}${dataType}${required}`);
    });
    logger.log('');
  }

  dim
    .command('list')
    .description('List dimensions')
    .addHelpText('after', DIMENSION_LIST_HELP_AFTER)
    .option('--page <n>', 'Page', (v) => parseInt(v, 10))
    .option('--page-size <n>', 'Page size', (v) => parseInt(v, 10))
    .option('--search <text>', 'Search by key/displayName/description')
    .action(async(options) => {
      try {
        const { environment, controllerUrl: headerControllerUrl } = await resolveHeaderContext();
        const { controllerUrl, authConfig } = await resolveControllerAndAuth(options);
        const res = await listDimensions(controllerUrl, authConfig, {
          page: options.page,
          pageSize: options.pageSize,
          search: options.search
        });
        const payload = unwrapControllerData(res);
        const items = payload?.data ?? payload ?? [];
        displayDimensionList(items, environment, headerControllerUrl);
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} program
 */
function setupDimensionCommands(program) {
  const dim = program.command('dimension').description('Manage the Controller Dimension Catalog');
  setupDimensionCreateCommand(dim);
  setupDimensionGetCommand(dim);
  setupDimensionListCommand(dim);
}

module.exports = {
  setupDimensionCommands
};

