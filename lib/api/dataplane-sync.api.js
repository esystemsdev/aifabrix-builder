/**
 * @fileoverview Dataplane sync API (Controller)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { ApiClient } = require('./index');

/**
 * Trigger full identity sync to dataplane for an environment
 * @requiresPermission {Controller} admin:sync
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} envKey
 * @returns {Promise<Object>}
 */
async function fullSyncToDataplane(controllerUrl, authConfig, envKey) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(`/api/v1/sync/dataplane/${encodeURIComponent(envKey)}/full`);
}

module.exports = {
  fullSyncToDataplane
};
