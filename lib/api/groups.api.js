/**
 * @fileoverview Groups API (Controller /api/v1/groups)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { ApiClient } = require('./index');

const BASE = '/api/v1/groups';

/**
 * List groups (paginated)
 * @requiresPermission {Controller} groups:read
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function listGroups(controllerUrl, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(BASE, { params: options });
}

/**
 * Get group by id or name
 * @requiresPermission {Controller} groups:read
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} groupIdOrName
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function getGroup(controllerUrl, authConfig, groupIdOrName, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  const params = {};
  if (options.includeMembers) {
    params.includeMembers = 'true';
  }
  return await client.get(`${BASE}/${encodeURIComponent(groupIdOrName)}`, { params });
}

/**
 * Create group
 * @requiresPermission {Controller} groups:create
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function createGroup(controllerUrl, authConfig, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(BASE, { body });
}

/**
 * List group members
 * @requiresPermission {Controller} groups:read
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} groupIdOrName
 * @returns {Promise<Object>}
 */
async function listGroupMembers(controllerUrl, authConfig, groupIdOrName) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`${BASE}/${encodeURIComponent(groupIdOrName)}/members`);
}

module.exports = {
  listGroups,
  getGroup,
  createGroup,
  listGroupMembers
};
