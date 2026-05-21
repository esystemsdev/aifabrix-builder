/**
 * @fileoverview Identity membership, role, and cache subcommands
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { formatBlockingError, formatSuccessLine } = require('../utils/cli-layout-chalk');
const {
  resolveControllerAndAuth,
  resolveEnvKey,
  requireNonEmpty,
  parseGroupsList,
  unwrapControllerData,
  throwIfApiFailed
} = require('./identity-shared');
const { addUserToGroup, removeUserFromGroup } = require('../api/user-groups.api');
const { listEnvironmentRoles, updateRoleGroups } = require('../api/environments.api');
const { clearAuthCache, invalidateAuthCache } = require('../api/auth-cache.api');

function printJson(data) {
  logger.log(JSON.stringify(data, null, 2));
}

/**
 * @param {import('commander').Command} memCmd
 */
function setupIdentityMembershipCommands(memCmd) {
  memCmd
    .command('add <userId> <groupId>')
    .description('Add user to group (controller ids)')
    .action(async(userId, groupId) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await addUserToGroup(
          controllerUrl,
          authConfig,
          requireNonEmpty(userId, 'userId'),
          requireNonEmpty(groupId, 'groupId'),
          {}
        );
        throwIfApiFailed(res);
        logger.log(formatSuccessLine(`Membership created: ${userId} → ${groupId}`));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });

  memCmd
    .command('remove <userId> <groupId>')
    .description('Remove user from group')
    .action(async(userId, groupId) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await removeUserFromGroup(
          controllerUrl,
          authConfig,
          requireNonEmpty(userId, 'userId'),
          requireNonEmpty(groupId, 'groupId')
        );
        throwIfApiFailed(res);
        logger.log(formatSuccessLine(`Membership removed: ${userId} → ${groupId}`));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} roleCmd
 */
function setupIdentityRoleCommands(roleCmd) {
  roleCmd
    .command('list')
    .description('List roles and group mappings for an environment')
    .requiredOption('-e, --env <key>', 'Environment key (dev, tst, pro)')
    .option('--json', 'JSON output')
    .action(async(options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const envKey = await resolveEnvKey(options);
        const res = await listEnvironmentRoles(controllerUrl, envKey, authConfig);
        throwIfApiFailed(res);
        const data = unwrapControllerData(res);
        if (options.json) {
          printJson(data);
          return;
        }
        const items = Array.isArray(data) ? data : data?.data || data?.roles || [];
        (items || []).forEach((r) => {
          const groups = Array.isArray(r.groups) ? r.groups.join(', ') : '';
          logger.log(`  ${r.value || r.role || r.name}  →  ${groups || '—'}`);
        });
        logger.log('');
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });

  roleCmd
    .command('set-groups <roleValue>')
    .description('Map role to groups in an environment')
    .requiredOption('-e, --env <key>', 'Environment key')
    .requiredOption('--groups <names>', 'Comma-separated group names')
    .action(async(roleValue, options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const envKey = await resolveEnvKey(options);
        const groups = parseGroupsList(options.groups);
        const res = await updateRoleGroups(
          controllerUrl,
          envKey,
          requireNonEmpty(roleValue, 'roleValue'),
          authConfig,
          groups
        );
        throwIfApiFailed(res);
        logger.log(formatSuccessLine(`Role ${roleValue} mapped to ${groups.length} group(s) in ${envKey}`));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} cacheCmd
 */
function setupIdentityCacheCommands(cacheCmd) {
  cacheCmd
    .command('clear')
    .description('Clear all controller auth/RBAC cache entries')
    .action(async() => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await clearAuthCache(controllerUrl, authConfig);
        throwIfApiFailed(res);
        logger.log(formatSuccessLine('Controller cache cleared'));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });

  cacheCmd
    .command('invalidate')
    .description('Invalidate controller cache entries by pattern')
    .requiredOption('--pattern <pattern>', 'Cache key pattern (e.g. permissions:*)')
    .action(async(options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const res = await invalidateAuthCache(
          controllerUrl,
          authConfig,
          requireNonEmpty(options.pattern, 'pattern')
        );
        throwIfApiFailed(res);
        logger.log(formatSuccessLine(`Cache invalidated for pattern: ${options.pattern}`));
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

module.exports = {
  setupIdentityMembershipCommands,
  setupIdentityRoleCommands,
  setupIdentityCacheCommands
};
