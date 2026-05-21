/**
 * @fileoverview Identity group subcommands
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { formatBlockingError, formatSuccessLine, headerKeyValue } = require('../utils/cli-layout-chalk');
const {
  resolveControllerAndAuth,
  requireNonEmpty,
  unwrapControllerData,
  throwIfApiFailed
} = require('./identity-shared');
const { listGroups, getGroup, createGroup, listGroupMembers } = require('../api/groups.api');

function printJson(data) {
  logger.log(JSON.stringify(data, null, 2));
}

function registerGroupCreate(groupCmd) {
  groupCmd
    .command('create')
    .description('Create a group')
    .requiredOption('--name <name>', 'Group name (unique key)')
    .requiredOption('--display-name <name>', 'Display name')
    .option('--description <text>', 'Description')
    .action(async(options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await createGroup(controllerUrl, authConfig, {
          name: requireNonEmpty(options.name, 'name'),
          displayName: requireNonEmpty(options.displayName, 'display-name'),
          description: options.description
        });
        throwIfApiFailed(res);
        const row = unwrapControllerData(res);
        logger.log(formatSuccessLine(`Group created: ${row.id} (${row.name})`));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function registerGroupList(groupCmd) {
  groupCmd
    .command('list')
    .description('List groups')
    .option('--page <n>', 'Page', (v) => parseInt(v, 10))
    .option('--page-size <n>', 'Page size', (v) => parseInt(v, 10))
    .option('--search <text>', 'Search groups')
    .option('--json', 'JSON output')
    .action(async(options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await listGroups(controllerUrl, authConfig, {
          page: options.page,
          pageSize: options.pageSize,
          search: options.search
        });
        throwIfApiFailed(res);
        const data = unwrapControllerData(res);
        if (options.json) {
          printJson(data);
          return;
        }
        const items = Array.isArray(data) ? data : data?.data || [];
        items.forEach((g) => logger.log(`  ${g.id}  ${g.name}`));
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function registerGroupGet(groupCmd) {
  groupCmd
    .command('get <idOrName>')
    .description('Get group by id or name')
    .option('--json', 'JSON output')
    .action(async(idOrName, options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await getGroup(controllerUrl, authConfig, requireNonEmpty(idOrName, 'idOrName'));
        throwIfApiFailed(res);
        const row = unwrapControllerData(res);
        if (options.json) {
          printJson(row);
          return;
        }
        logger.log(headerKeyValue('Id:', row.id));
        logger.log(headerKeyValue('Name:', row.name));
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function registerGroupMembers(groupCmd) {
  groupCmd
    .command('members <idOrName>')
    .description('List members of a group')
    .option('--json', 'JSON output')
    .action(async(idOrName, options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await listGroupMembers(
          controllerUrl,
          authConfig,
          requireNonEmpty(idOrName, 'idOrName')
        );
        throwIfApiFailed(res);
        const data = unwrapControllerData(res);
        if (options.json) {
          printJson(data);
          return;
        }
        const items = Array.isArray(data) ? data : data?.data || [];
        items.forEach((m) => logger.log(`  ${m.userId || m.id}  ${m.email || ''}`));
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} groupCmd
 */
function setupIdentityGroupCommands(groupCmd) {
  registerGroupCreate(groupCmd);
  registerGroupList(groupCmd);
  registerGroupGet(groupCmd);
  registerGroupMembers(groupCmd);
}

module.exports = {
  setupIdentityGroupCommands
};
