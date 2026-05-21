/**
 * @fileoverview User–group membership API (Controller)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { ApiClient } = require('./index');

/**
 * Add user to group
 * @requiresPermission {Controller} users:update
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} userId
 * @param {string} groupId
 * @param {Object} [body]
 * @returns {Promise<Object>}
 */
async function addUserToGroup(controllerUrl, authConfig, userId, groupId, body = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(
    `/api/v1/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}`,
    { body }
  );
}

/**
 * Remove user from group
 * @requiresPermission {Controller} users:update
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} userId
 * @param {string} groupId
 * @returns {Promise<Object>}
 */
async function removeUserFromGroup(controllerUrl, authConfig, userId, groupId) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.delete(
    `/api/v1/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}`
  );
}

module.exports = {
  addUserToGroup,
  removeUserFromGroup
};
