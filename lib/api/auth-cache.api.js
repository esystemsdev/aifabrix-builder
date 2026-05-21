/**
 * @fileoverview Controller auth/RBAC cache API
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { ApiClient } = require('./index');

const CLEAR_PATH = '/api/v1/auth/cache/clear';
const INVALIDATE_PATH = '/api/v1/auth/cache/invalidate';

/**
 * Clear all controller cache entries
 * @requiresPermission {Controller} cache:admin
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @returns {Promise<Object>}
 */
async function clearAuthCache(controllerUrl, authConfig) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(CLEAR_PATH);
}

/**
 * Invalidate cache entries matching a pattern
 * @requiresPermission {Controller} cache:admin
 * @async
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} pattern
 * @returns {Promise<Object>}
 */
async function invalidateAuthCache(controllerUrl, authConfig, pattern) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.post(INVALIDATE_PATH, { body: { pattern } });
}

module.exports = {
  clearAuthCache,
  invalidateAuthCache
};
