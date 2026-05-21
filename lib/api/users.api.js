/**
 * @fileoverview Users API (Controller /api/v1/users)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { ApiClient } = require('./index');

const BASE = '/api/v1/users';

/**
 * List users (paginated)
 * @requiresPermission {Controller} users:read
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function listUsers(controllerUrl, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(BASE, { params: options });
}

/**
 * Get user by id
 * @requiresPermission {Controller} users:read
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} userId
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function getUser(controllerUrl, authConfig, userId, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  const params = {};
  if (options.includeGroups) {
    params.includeGroups = 'true';
  }
  return await client.get(`${BASE}/${encodeURIComponent(userId)}`, { params });
}

/**
 * Create user
 * @requiresPermission {Controller} users:create
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function createUser(controllerUrl, authConfig, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(BASE, { body });
}

/**
 * Patch user
 * @requiresPermission {Controller} users:update
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} userId
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function updateUser(controllerUrl, authConfig, userId, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.patch(`${BASE}/${encodeURIComponent(userId)}`, { body });
}

/**
 * List groups for a user
 * @requiresPermission {Controller} users:read
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function listUserGroups(controllerUrl, authConfig, userId) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`${BASE}/${encodeURIComponent(userId)}/groups`);
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  listUserGroups
};
