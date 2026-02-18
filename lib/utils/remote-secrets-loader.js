/**
 * Load shared secrets from Builder Server when aifabrix-secrets is an http(s) URL.
 * Used for .env resolution only; values are never persisted to disk.
 *
 * @fileoverview Remote shared secrets loader for .env generation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const config = require('../core/config');

/**
 * Fetches shared secrets from Builder Server when aifabrix-secrets is an http(s) URL.
 * @returns {Promise<Object|null>} Key-value secrets from API or null
 */
async function loadRemoteSharedSecrets() {
  const { isRemoteSecretsUrl, getRemoteDevAuth } = require('./remote-dev-auth');
  const devApi = require('../api/dev.api');
  const configSecretsPath = await config.getSecretsPath();
  if (!configSecretsPath || !isRemoteSecretsUrl(configSecretsPath)) {
    return null;
  }
  const auth = await getRemoteDevAuth();
  if (!auth) return null;
  try {
    const items = await devApi.listSecrets(auth.serverUrl, auth.clientCertPem);
    if (!Array.isArray(items)) return null;
    const obj = {};
    for (const item of items) {
      if (item && typeof item.name === 'string' && item.value !== undefined) {
        obj[item.name] = String(item.value);
      }
    }
    return obj;
  } catch {
    return null;
  }
}

/**
 * Merges remote shared secrets with user secrets. User wins on same key.
 * @param {Object} userSecrets - User secrets object
 * @param {Object} remoteSecrets - Remote API secrets (key-value)
 * @returns {Object} Merged object
 */
function mergeUserWithRemoteSecrets(userSecrets, remoteSecrets) {
  const merged = { ...userSecrets };
  if (!remoteSecrets || typeof remoteSecrets !== 'object') return merged;
  for (const key of Object.keys(remoteSecrets)) {
    if (!(key in merged) || merged[key] === undefined || merged[key] === null || merged[key] === '') {
      merged[key] = remoteSecrets[key];
    }
  }
  return merged;
}

module.exports = {
  loadRemoteSharedSecrets,
  mergeUserWithRemoteSecrets
};
