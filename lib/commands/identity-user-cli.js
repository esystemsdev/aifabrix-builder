/**
 * @fileoverview Identity user subcommands
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { formatBlockingError, formatSuccessLine, headerKeyValue } = require('../utils/cli-layout-chalk');
const {
  resolveControllerAndAuth,
  requireNonEmpty,
  unwrapControllerData,
  throwIfApiFailed
} = require('./identity-shared');
const {
  listUsers,
  getUser,
  createUser,
  listUserGroups
} = require('../api/users.api');

function printJson(data) {
  logger.log(JSON.stringify(data, null, 2));
}

function registerUserCreate(userCmd) {
  userCmd
    .command('create')
    .description('Create a user on the controller')
    .requiredOption('--email <email>', 'User email')
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
    .option('--display-name <name>', 'Display name')
    .option('--username <name>', 'Username')
    .action(async(options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await createUser(controllerUrl, authConfig, {
          email: requireNonEmpty(options.email, 'email'),
          firstName: options.firstName,
          lastName: options.lastName,
          displayName: options.displayName,
          username: options.username,
          status: 'active'
        });
        throwIfApiFailed(res);
        const row = unwrapControllerData(res);
        logger.log(formatSuccessLine(`User created: ${row.id} (${row.email})`));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function registerUserList(userCmd) {
  userCmd
    .command('list')
    .description('List users')
    .option('--page <n>', 'Page', (v) => parseInt(v, 10))
    .option('--page-size <n>', 'Page size', (v) => parseInt(v, 10))
    .option('--search <text>', 'Search users')
    .option('--json', 'JSON output')
    .action(async(options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await listUsers(controllerUrl, authConfig, {
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
        logger.log(chalk.bold(`\nUsers (${items.length} shown):\n`));
        items.forEach((u) => logger.log(`  ${u.id}  ${u.email}`));
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function registerUserGet(userCmd) {
  userCmd
    .command('get <idOrEmail>')
    .description('Get user by id or email')
    .option('--json', 'JSON output')
    .action(async(idOrEmail, options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await getUser(controllerUrl, authConfig, requireNonEmpty(idOrEmail, 'idOrEmail'));
        throwIfApiFailed(res);
        const row = unwrapControllerData(res);
        if (options.json) {
          printJson(row);
          return;
        }
        logger.log(headerKeyValue('Id:', row.id));
        logger.log(headerKeyValue('Email:', row.email));
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

function registerUserGroups(userCmd) {
  userCmd
    .command('groups <idOrEmail>')
    .description('List groups for a user')
    .option('--json', 'JSON output')
    .action(async(idOrEmail, options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await listUserGroups(
          controllerUrl,
          authConfig,
          requireNonEmpty(idOrEmail, 'idOrEmail')
        );
        throwIfApiFailed(res);
        const data = unwrapControllerData(res);
        if (options.json) {
          printJson(data);
          return;
        }
        const items = Array.isArray(data) ? data : data?.data || [];
        items.forEach((g) => logger.log(`  ${g.id || g.groupId}  ${g.name || ''}`));
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} userCmd
 */
function setupIdentityUserCommands(userCmd) {
  registerUserCreate(userCmd);
  registerUserList(userCmd);
  registerUserGet(userCmd);
  registerUserGroups(userCmd);
}

module.exports = {
  setupIdentityUserCommands
};
