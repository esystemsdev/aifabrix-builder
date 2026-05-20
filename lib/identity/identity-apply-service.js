/**
 * @fileoverview Bulk identity apply (CSV) against miso-controller
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { parseUsersCsvFile, buildApplyPlanFromRows } = require('./identity-csv-parser');
const {
  applyGroupsPhase,
  applyUsersPhase,
  applyMembershipsPhase,
  maybePurgeAndSync
} = require('./identity-apply-phases');

const {
  unwrapControllerData,
  apiErrorMessage,
  throwIfApiFailed,
  findExistingUser
} = require('./identity-apply-core');

/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function runIdentityApply(controllerUrl, authConfig, options) {
  const { rows } = parseUsersCsvFile(options.filePath, options.filterPrefix);
  if (!rows.length) {
    throw new Error('No data rows to apply after parsing CSV');
  }
  const plan = buildApplyPlanFromRows(rows);
  const dryRun = Boolean(options.dryRun);

  const groupPhase = await applyGroupsPhase(controllerUrl, authConfig, plan.groups, dryRun);
  const userPhase = await applyUsersPhase(controllerUrl, authConfig, plan.users, dryRun);
  const memPhase = await applyMembershipsPhase(
    controllerUrl,
    authConfig,
    plan.memberships,
    userPhase.map,
    groupPhase.map,
    dryRun
  );

  const syncStats = await maybePurgeAndSync(controllerUrl, authConfig, {
    dryRun,
    purgeCache: Boolean(options.purgeCache),
    sync: Boolean(options.sync),
    envKey: options.envKey,
    allowEmptySync: Boolean(options.allowEmptySync)
  });

  return {
    groupsProcessed: groupPhase.processed,
    groupsCreated: groupPhase.created,
    usersProcessed: userPhase.processed,
    usersCreated: userPhase.created,
    membershipsProcessed: memPhase.processed,
    membershipsCreated: memPhase.created,
    membershipsSkipped: memPhase.skipped,
    dryRun,
    syncStats
  };
}

module.exports = {
  unwrapControllerData,
  apiErrorMessage,
  throwIfApiFailed,
  runIdentityApply,
  findExistingUser
};
