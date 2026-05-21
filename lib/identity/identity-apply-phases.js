/**
 * @fileoverview Phased execution for identity apply
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { getGroup, createGroup } = require('../api/groups.api');
const { createUser } = require('../api/users.api');
const { addUserToGroup } = require('../api/user-groups.api');
const { clearAuthCache } = require('../api/auth-cache.api');
const { fullSyncToDataplane } = require('../api/dataplane-sync.api');
const {
  unwrapControllerData,
  throwIfApiFailed,
  assertSyncStatsOk,
  apiErrorMessage,
  findExistingUser
} = require('./identity-apply-core');

/**
 * @param {string} msg
 * @returns {boolean}
 */
function isAlreadyMemberError(msg) {
  return /already a member|409|Conflict/i.test(String(msg || ''));
}

/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {{ name: string, displayName: string }} spec
 * @param {boolean} dryRun
 * @returns {Promise<{ id: string, created: boolean }>}
 */
async function ensureGroup(controllerUrl, authConfig, spec, dryRun) {
  const name = spec.name;
  const existingRes = await getGroup(controllerUrl, authConfig, name);
  const existing = unwrapControllerData(existingRes);
  if (existing && existing.id) {
    return { id: existing.id, created: false };
  }
  if (dryRun) {
    return { id: `(dry-run:${name})`, created: true };
  }
  const createdRes = await createGroup(controllerUrl, authConfig, {
    name,
    displayName: spec.displayName || name
  });
  throwIfApiFailed(createdRes);
  const created = unwrapControllerData(createdRes);
  return { id: created.id, created: true };
}

/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} userSpec
 * @param {boolean} dryRun
 * @returns {Promise<{ id: string, created: boolean }>}
 */
async function ensureUser(controllerUrl, authConfig, userSpec, dryRun) {
  const existing = await findExistingUser(controllerUrl, authConfig, userSpec);
  if (existing && existing.id) {
    return { id: existing.id, created: false };
  }
  if (dryRun) {
    return { id: `(dry-run:${userSpec.email})`, created: true };
  }
  const body = {
    email: userSpec.email,
    firstName: userSpec.firstName,
    lastName: userSpec.lastName,
    displayName: userSpec.displayName,
    username: userSpec.username,
    status: 'active'
  };
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined || body[k] === '') {
      delete body[k];
    }
  });
  const createdRes = await createUser(controllerUrl, authConfig, body);
  throwIfApiFailed(createdRes);
  const created = unwrapControllerData(createdRes);
  return { id: created.id, created: true };
}

/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Map} groups
 * @param {boolean} dryRun
 * @returns {Promise<{ map: Map<string, string>, created: number, processed: number }>}
 */
async function applyGroupsPhase(controllerUrl, authConfig, groups, dryRun) {
  const map = new Map();
  let created = 0;
  let processed = 0;
  for (const spec of groups.values()) {
    const out = await ensureGroup(controllerUrl, authConfig, spec, dryRun);
    map.set(spec.name, out.id);
    processed += 1;
    if (out.created) {
      created += 1;
    }
  }
  return { map, created, processed };
}

/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Map} users
 * @param {boolean} dryRun
 * @returns {Promise<{ map: Map<string, string>, created: number, processed: number }>}
 */
async function applyUsersPhase(controllerUrl, authConfig, users, dryRun) {
  const map = new Map();
  let created = 0;
  let processed = 0;
  for (const [userKey, userSpec] of users.entries()) {
    const out = await ensureUser(controllerUrl, authConfig, userSpec, dryRun);
    map.set(userKey, out.id);
    processed += 1;
    if (out.created) {
      created += 1;
    }
  }
  return { map, created, processed };
}

/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object[]} memberships
 * @param {Map<string, string>} userIdByKey
 * @param {Map<string, string>} groupIdByName
 * @param {boolean} dryRun
 * @returns {Promise<{ created: number, processed: number, skipped: number }>}
 */
/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} m
 * @param {Map<string, string>} userIdByKey
 * @param {Map<string, string>} groupIdByName
 * @param {boolean} dryRun
 * @returns {Promise<'created'|'skipped'|'dry'>}
 */
async function applyOneMembership(controllerUrl, authConfig, m, userIdByKey, groupIdByName, dryRun) {
  const userId = userIdByKey.get(m.userKey);
  const groupId = groupIdByName.get(m.groupName);
  if (!userId || !groupId) {
    return 'skipped';
  }
  if (dryRun) {
    return 'dry';
  }
  const res = await addUserToGroup(controllerUrl, authConfig, userId, groupId, {});
  if (res && res.success !== false) {
    return 'created';
  }
  if (isAlreadyMemberError(apiErrorMessage(res))) {
    return 'skipped';
  }
  throw new Error(apiErrorMessage(res));
}

async function applyMembershipsPhase(
  controllerUrl,
  authConfig,
  memberships,
  userIdByKey,
  groupIdByName,
  dryRun
) {
  let created = 0;
  let processed = 0;
  let skipped = 0;
  for (const m of memberships) {
    const userId = userIdByKey.get(m.userKey);
    const groupId = groupIdByName.get(m.groupName);
    if (!userId || !groupId) {
      continue;
    }
    processed += 1;
    const outcome = await applyOneMembership(
      controllerUrl,
      authConfig,
      m,
      userIdByKey,
      groupIdByName,
      dryRun
    );
    if (outcome === 'created' || outcome === 'dry') {
      created += 1;
    } else if (outcome === 'skipped') {
      skipped += 1;
    }
  }
  return { created, processed, skipped };
}

/**
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} opts
 * @returns {Promise<Object|null>}
 */
async function maybePurgeAndSync(controllerUrl, authConfig, opts) {
  if (opts.dryRun) {
    return null;
  }
  if (opts.purgeCache) {
    const cacheRes = await clearAuthCache(controllerUrl, authConfig);
    throwIfApiFailed(cacheRes);
  }
  if (!opts.sync || !opts.envKey) {
    return null;
  }
  const syncRes = await fullSyncToDataplane(controllerUrl, authConfig, opts.envKey);
  throwIfApiFailed(syncRes);
  const stats = unwrapControllerData(syncRes);
  assertSyncStatsOk(stats, { allowEmptySync: opts.allowEmptySync });
  return stats;
}

module.exports = {
  ensureGroup,
  ensureUser,
  applyGroupsPhase,
  applyUsersPhase,
  applyMembershipsPhase,
  maybePurgeAndSync
};
