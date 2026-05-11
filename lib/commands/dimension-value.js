/**
 * Dimension value commands (Controller).
 *
 * Commands:
 * - aifabrix dimension-value create
 * - aifabrix dimension-value list
 * - aifabrix dimension-value delete
 *
 * @fileoverview Dimension value CLI commands
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { normalizeControllerUrl } = require('../core/config');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { formatBlockingError, formatSuccessLine, headerKeyValue } = require('../utils/cli-layout-chalk');
const {
  listDimensionValues,
  createDimensionValue,
  deleteDimensionValue
} = require('../api/dimension-values.api');

const DIMENSION_VALUE_CREATE_HELP_AFTER = `

Examples:
  $ aifabrix dimension-value create customerRegion --value emea --display-name "EMEA"
  $ aifabrix dimension-value create customerRegion --value na --display-name "North America"

`;

const DIMENSION_VALUE_LIST_HELP_AFTER = `

Examples:
  $ aifabrix dimension-value list customerRegion
  $ aifabrix dimension-value list customerRegion --page 1 --page-size 50
  $ aifabrix dimension-value list customerRegion --search emea

`;

const DIMENSION_VALUE_DELETE_HELP_AFTER = `

Examples:
  $ aifabrix dimension-value delete clx1234567890abcdef

Tip: Find ids via "aifabrix dimension get <key>" (it prints values) or "aifabrix dimension-value list <key>".

`;

/**
 * @param {string} raw
 * @param {string} label
 * @returns {string}
 */
function requireNonEmpty(raw, label) {
  const s = String(raw || '').trim();
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

async function resolveControllerAndAuth() {
  const controllerUrl = await resolveControllerUrl();
  if (!controllerUrl) {
    throw new Error('Controller URL is required. Run "aifabrix login" first.');
  }
  const normalized = normalizeControllerUrl(controllerUrl);
  const deviceToken = await getOrRefreshDeviceToken(normalized);
  if (!deviceToken || !deviceToken.token) {
    throw new Error(`Not authenticated for controller: ${controllerUrl}. Run "aifabrix login" and try again.`);
  }
  return {
    controllerUrl: deviceToken.controller || normalized,
    authConfig: { type: 'bearer', token: deviceToken.token }
  };
}

function unwrapControllerData(response) {
  return response?.data?.data ?? response?.data ?? response;
}

function setupDimensionValueCreateCommand(cmd) {
  cmd
    .command('create <dimensionIdOrKey>')
    .description('Create a value under a dimension')
    .addHelpText('after', DIMENSION_VALUE_CREATE_HELP_AFTER)
    .requiredOption('--value <value>', 'Value (unique within the dimension)')
    .option('--display-name <name>', 'Display name')
    .option('--description <text>', 'Description')
    .action(async(dimensionIdOrKey, options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const dimKey = requireNonEmpty(dimensionIdOrKey, 'dimensionIdOrKey');
        const value = requireNonEmpty(options.value, 'value');
        const res = await createDimensionValue(controllerUrl, authConfig, dimKey, {
          value,
          displayName: options.displayName,
          description: options.description
        });
        const row = unwrapControllerData(res);
        logger.log(formatSuccessLine(`Dimension value created: ${dimKey}.${row.value}`));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function setupDimensionValueListCommand(cmd) {
  cmd
    .command('list <dimensionIdOrKey>')
    .description('List values for a dimension')
    .addHelpText('after', DIMENSION_VALUE_LIST_HELP_AFTER)
    .option('--page <n>', 'Page', (v) => parseInt(v, 10))
    .option('--page-size <n>', 'Page size', (v) => parseInt(v, 10))
    .option('--search <text>', 'Search by value/displayName/description')
    .action(async(dimensionIdOrKey, options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const dimKey = requireNonEmpty(dimensionIdOrKey, 'dimensionIdOrKey');
        const res = await listDimensionValues(controllerUrl, authConfig, dimKey, {
          page: options.page,
          pageSize: options.pageSize,
          search: options.search
        });
        const payload = unwrapControllerData(res);
        const items = payload?.data ?? payload ?? [];
        logger.log(chalk.bold('\n🏷 Dimension values:\n'));
        logger.log(headerKeyValue('Dimension:', dimKey));
        logger.log('');
        if (!Array.isArray(items) || items.length === 0) {
          logger.log(chalk.gray('  No values found.\n'));
          return;
        }
        items.forEach((v) => {
          const value = v?.value ? String(v.value) : '—';
          const display = v?.displayName ? String(v.displayName) : '';
          logger.log(`  ${chalk.white(value)}${display ? ` ${chalk.gray(`(${display})`)}` : ''}`);
        });
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function setupDimensionValueDeleteCommand(cmd) {
  cmd
    .command('delete <dimensionValueId>')
    .description('Delete a dimension value by id')
    .addHelpText('after', DIMENSION_VALUE_DELETE_HELP_AFTER)
    .action(async(dimensionValueId) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const id = requireNonEmpty(dimensionValueId, 'dimensionValueId');
        await deleteDimensionValue(controllerUrl, authConfig, id);
        logger.log(formatSuccessLine(`Dimension value deleted: ${id}`));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function setupDimensionValueCommands(program) {
  const cmd = program.command('dimension-value').description('Manage dimension values (static dimensions)');
  setupDimensionValueCreateCommand(cmd);
  setupDimensionValueListCommand(cmd);
  setupDimensionValueDeleteCommand(cmd);
}

module.exports = {
  setupDimensionValueCommands
};

