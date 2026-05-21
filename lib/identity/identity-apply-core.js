/**
 * @fileoverview Shared helpers for identity apply
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { getUser, listUsers } = require('../api/users.api');

/**
 * @param {Object} response
 * @returns {any}
 */
function unwrapControllerData(response) {
  if (!response || response.success === false) {
    return null;
  }
  return response?.data?.data ?? response?.data ?? response;
}

/**
 * @param {Object} response
 * @returns {string}
 */
function apiErrorMessage(response) {
  if (!response) {
    return 'Request failed';
  }
  const err = response.error;
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object') {
    return err.formattedError || err.message || err.error || 'Request failed';
  }
  return response.formattedError || response.message || 'Request failed';
}

/**
 * @param {Object} response
 * @throws {Error}
 */
function throwIfApiFailed(response) {
  if (!response || response.success === false) {
    throw new Error(apiErrorMessage(response));
  }
}

/**
 * @param {Object|null|undefined} stats
 * @param {{ allowEmptySync?: boolean }} [opts]
 * @throws {Error}
 */
function assertSyncStatsOk(stats, opts = {}) {
  const syncErrors = Number(stats?.errors ?? 0);
  if (syncErrors > 0) {
    throw new Error(
      `Dataplane full sync reported ${syncErrors} error(s). ` +
        `usersProcessed=${stats?.usersProcessed ?? 0} groupsProcessed=${stats?.groupsProcessed ?? 0}. ` +
        'Check miso-controller logs for the sync request.'
    );
  }
  const processed = Number(stats?.usersProcessed ?? 0);
  if (processed === 0 && !opts.allowEmptySync) {
    throw new Error(
      'Dataplane full sync completed with usersProcessed=0. Use --allow-empty-sync to accept, or fix identity on the controller.'
    );
  }
}

/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {{ csvId?: string, email: string }} userSpec
 * @returns {Promise<Object|null>}
 */
async function findExistingUser(controllerUrl, authConfig, userSpec) {
  const csvId = String(userSpec.csvId || '').trim();
  if (csvId) {
    const byId = await getUser(controllerUrl, authConfig, csvId);
    const row = unwrapControllerData(byId);
    if (row && row.id) {
      return row;
    }
  }
  const email = String(userSpec.email || '').trim();
  const listed = await listUsers(controllerUrl, authConfig, {
    search: email,
    pageSize: 10,
    page: 1
  });
  const items = unwrapControllerData(listed);
  const list = Array.isArray(items) ? items : items?.data;
  if (!Array.isArray(list)) {
    return null;
  }
  return list.find((u) => String(u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

module.exports = {
  unwrapControllerData,
  apiErrorMessage,
  throwIfApiFailed,
  assertSyncStatsOk,
  findExistingUser
};
