/**
 * Load shared secrets from Builder Server when aifabrix-secrets is an http(s) URL,
 * or from the configured shared YAML path when it targets a local file.
 *
 * @fileoverview Remote shared secrets loader for .env generation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { readYamlAtPath } = require('./secrets-canonical');
const { ensureSecureFilePermissions } = require('./secure-file-permissions');

/**
 * Fetches shared secrets from Builder Server when aifabrix-secrets is an http(s) URL.
 * @returns {Promise<Object|null>} Key-value secrets from API or null
 */
async function loadRemoteSharedSecrets() {
  const remoteDevAuth = require('./remote-dev-auth');
  const devApi = require('../api/dev.api');
  const configSecretsPath = await config.getSecretsPath();
  if (!configSecretsPath) {
    return null;
  }
  const endpoint = await remoteDevAuth.resolveSharedSecretsEndpoint(configSecretsPath);
  if (!remoteDevAuth.isRemoteSecretsUrl(endpoint)) {
    return null;
  }
  const auth = await remoteDevAuth.getRemoteDevAuth();
  if (!auth) return null;
  try {
    const items = await devApi.listSecrets(
      auth.serverUrl,
      auth.clientCertPem,
      auth.serverCaPem || undefined,
      endpoint
    );
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
 * @param {Record<string, string>} [keySources] - Mutated: winning file/API label per key (decrypt hints)
 * @param {string} [remoteSourceLabel] - Human-readable source for keys taken from remote
 * @returns {Object} Merged object
 */
function mergeUserWithRemoteSecrets(userSecrets, remoteSecrets, keySources, remoteSourceLabel) {
  const merged = { ...userSecrets };
  if (!remoteSecrets || typeof remoteSecrets !== 'object') return merged;
  const label = remoteSourceLabel || 'shared secrets API';
  for (const key of Object.keys(remoteSecrets)) {
    if (!(key in merged) || merged[key] === undefined || merged[key] === null || merged[key] === '') {
      merged[key] = remoteSecrets[key];
      if (keySources) {
        keySources[key] = label;
      }
    }
  }
  return merged;
}

/**
 * Raw secrets from the configured shared store only (`aifabrix-secrets`): remote Builder API or shared YAML file.
 * Does not include primary user secrets or builder merges. Used to avoid duplicating shared keys into ~/.aifabrix.
 *
 * @returns {Promise<Object|null>} Key-value map or null when unavailable / not configured
 */
async function loadConfiguredSharedSecretsStore() {
  const remoteDevAuth = require('./remote-dev-auth');
  const configSecretsPath = await config.getSecretsPath();
  if (!configSecretsPath) {
    return null;
  }
  const endpoint = await remoteDevAuth.resolveSharedSecretsEndpoint(configSecretsPath);
  if (remoteDevAuth.isRemoteSecretsUrl(endpoint)) {
    return loadRemoteSharedSecrets();
  }
  const resolvedFile = path.isAbsolute(endpoint)
    ? endpoint
    : path.resolve(process.cwd(), endpoint);
  if (!fs.existsSync(resolvedFile)) {
    return null;
  }
  try {
    ensureSecureFilePermissions(resolvedFile);
    const data = readYamlAtPath(resolvedFile);
    if (!data || typeof data !== 'object') {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

module.exports = {
  loadRemoteSharedSecrets,
  mergeUserWithRemoteSecrets,
  loadConfiguredSharedSecretsStore
};
