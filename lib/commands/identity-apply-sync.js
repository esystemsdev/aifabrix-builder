/**
 * @fileoverview Identity apply and sync commands
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
  unwrapControllerData,
  throwIfApiFailed,
  assertSyncStatsOk
} = require('./identity-shared');
const { clearAuthCache } = require('../api/auth-cache.api');
const { fullSyncToDataplane } = require('../api/dataplane-sync.api');
const { runIdentityApply } = require('../identity/identity-apply-service');

function printJson(data) {
  logger.log(JSON.stringify(data, null, 2));
}

/**
 * @param {import('commander').Command} identityCmd
 */
function setupIdentityApplyCommand(identityCmd) {
  identityCmd
    .command('apply')
    .description('Apply users/groups/memberships from a CSV file (users.csv shape)')
    .requiredOption('--file <path>', 'CSV file path')
    .option('-e, --env <key>', 'Environment for --sync')
    .option('--filter-prefix <prefix>', 'Only rows whose Id starts with this prefix')
    .option('--dry-run', 'Parse and plan only; no writes')
    .option('--sync', 'Run dataplane full sync after apply')
    .option('--purge-cache', 'Clear controller cache before sync')
    .option('--allow-empty-sync', 'Do not fail when sync reports usersProcessed=0')
    .option('--json', 'JSON summary')
    .action(async(options) => {
      try {
        const { controllerUrl, authConfig } = await resolveControllerAndAuth();
        const envKey = options.sync ? await resolveEnvKey(options) : undefined;
        const summary = await runIdentityApply(controllerUrl, authConfig, {
          filePath: requireNonEmpty(options.file, 'file'),
          filterPrefix: options.filterPrefix,
          dryRun: Boolean(options.dryRun),
          purgeCache: Boolean(options.purgeCache),
          sync: Boolean(options.sync),
          envKey,
          allowEmptySync: Boolean(options.allowEmptySync)
        });
        if (options.json) {
          printJson(summary);
          return;
        }
        logger.log(formatSuccessLine('Identity apply finished'));
        logger.log(
          `  groups: ${summary.groupsProcessed} processed (${summary.groupsCreated} created)`
        );
        logger.log(`  users: ${summary.usersProcessed} processed (${summary.usersCreated} created)`);
        logger.log(
          `  memberships: ${summary.membershipsProcessed} processed (${summary.membershipsCreated} created, ${summary.membershipsSkipped} skipped)`
        );
        if (summary.syncStats) {
          logger.log(
            `  sync: usersProcessed=${summary.syncStats.usersProcessed ?? 0} groupsProcessed=${summary.syncStats.groupsProcessed ?? 0}`
          );
        }
      } catch (e) {
        logger.error(formatBlockingError(e.message));
        process.exit(1);
      }
    });
}

/**
 * @param {import('commander').Command} identityCmd
 */
function setupIdentitySyncCommand(identityCmd) {
  identityCmd
    .command('sync')
    .description('Full identity sync from controller to dataplane')
    .option('-e, --env <key>', 'Environment key')
    .option('--purge-cache', 'Clear controller cache before sync')
    .option('--allow-empty-sync', 'Do not fail when usersProcessed=0')
    .option('--json', 'JSON stats')
    .action(async(options) => runIdentitySyncAction(options));
}

/**
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function maybePurgeCache(controllerUrl, authConfig, purgeCache) {
  if (!purgeCache) {
    return;
  }
  const cacheRes = await clearAuthCache(controllerUrl, authConfig);
  throwIfApiFailed(cacheRes);
  logger.log(formatSuccessLine('Controller cache cleared'));
}

async function runIdentitySyncAction(options) {
  try {
    const { controllerUrl, authConfig } = await resolveControllerAndAuth();
    const envKey = await resolveEnvKey(options);
    await maybePurgeCache(controllerUrl, authConfig, options.purgeCache);
    const res = await fullSyncToDataplane(controllerUrl, authConfig, envKey);
    throwIfApiFailed(res);
    const stats = unwrapControllerData(res);
    assertSyncStatsOk(stats, { allowEmptySync: options.allowEmptySync });
    if (options.json) {
      printJson(stats);
      return;
    }
    logger.log(formatSuccessLine(`Identity synced to dataplane (${envKey})`));
    logger.log(`  usersProcessed=${stats?.usersProcessed ?? 0}`);
    logger.log(`  groupsProcessed=${stats?.groupsProcessed ?? 0}`);
  } catch (e) {
    logger.error(formatBlockingError(e.message));
    process.exit(1);
  }
}

module.exports = {
  setupIdentityApplyCommand,
  setupIdentitySyncCommand
};
