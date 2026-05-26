/**
 * @fileoverview aifabrix secret get – read one secret (local user file or shared-only)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const { getAifabrixSecretsPath } = require('../core/config');
const { decryptSecretsObject } = require('../core/secrets-load');
const { loadPrimaryUserSecrets } = require('../utils/secrets-utils');
const { loadConfiguredSharedSecretsStore } = require('../utils/remote-secrets-loader');
const remoteDevAuth = require('../utils/remote-dev-auth');
const devApi = require('../api/dev.api');
const logger = require('../utils/logger');

const REMOTE_NOT_CONFIGURED_MSG =
  'Remote server is not configured. Set remote-server and run "aifabrix dev init" first.';

/**
 * Human-readable label for which store(s) were queried (paths included for file stores).
 * @param {{ shared?: boolean }} options
 * @returns {Promise<string>}
 */
async function resolveSecretsScopeLabel(options) {
  const useSharedOnly = Boolean(options.shared || options['shared']);
  const generalSecretsPath = await getAifabrixSecretsPath();

  if (useSharedOnly) {
    if (!generalSecretsPath) {
      return 'shared secrets (aifabrix-secrets not configured; run aifabrix secret set-secrets-file <path>)';
    }
    const target = await remoteDevAuth.resolveSharedSecretsEndpoint(generalSecretsPath);
    if (remoteDevAuth.isRemoteSecretsUrl(target)) {
      const host = remoteDevAuth.getSharedSecretsRemoteHostname(target) || target;
      return `shared secrets API (${host})`;
    }
    const resolved = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
    return `shared secrets file ${resolved}`;
  }

  const pathsUtil = require('../utils/paths');
  const userPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  return `local secrets file ${userPath}`;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isSecretPresent(value) {
  if (value === undefined || value === null) {
    return false;
  }
  return String(value).trim() !== '';
}

/**
 * @param {Array<{ name?: string, key?: string, value?: unknown }>} items
 * @returns {Record<string, string>}
 */
function remoteSecretItemsToMap(items) {
  const raw = {};
  for (const item of items) {
    const name = item?.name || item?.key;
    if (typeof name === 'string' && item.value !== undefined) {
      raw[name] = String(item.value);
    }
  }
  return raw;
}

/**
 * @param {string} target
 * @returns {Promise<Record<string, string>>}
 */
async function loadRemoteSharedSecretsDecrypted(target) {
  const auth = await remoteDevAuth.getRemoteDevAuth();
  if (!auth) {
    throw new Error(REMOTE_NOT_CONFIGURED_MSG);
  }
  const items = await devApi.listSecrets(
    auth.serverUrl,
    auth.clientCertPem,
    auth.serverCaPem || undefined,
    target
  );
  const label = remoteDevAuth.getSharedSecretsRemoteHostname(target) || 'shared secrets API';
  return decryptSecretsObject(remoteSecretItemsToMap(items), { defaultSourceLabel: label });
}

/**
 * Load shared secrets (file or remote), decrypted.
 * @returns {Promise<Record<string, string>>}
 */
async function loadSharedSecretsDecrypted() {
  const generalSecretsPath = await getAifabrixSecretsPath();
  if (!generalSecretsPath) {
    throw new Error('Shared secrets not configured. Set aifabrix-secrets in config.yaml.');
  }

  const target = await remoteDevAuth.resolveSharedSecretsEndpoint(generalSecretsPath);
  if (remoteDevAuth.isRemoteSecretsUrl(target)) {
    return loadRemoteSharedSecretsDecrypted(target);
  }

  const raw = await loadConfiguredSharedSecretsStore();
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const resolvedPath = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
  return decryptSecretsObject(raw, { defaultSourceLabel: resolvedPath });
}

/**
 * Load and decrypt the primary user secrets file only (not aifabrix-secrets / shared).
 * @returns {Promise<Record<string, string>>}
 */
async function loadLocalUserSecretsDecrypted() {
  const pathsUtil = require('../utils/paths');
  const userPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  const raw = loadPrimaryUserSecrets();
  return decryptSecretsObject(raw || {}, { defaultSourceLabel: userPath });
}

/**
 * Load secrets for lookup: local user file (default) or shared store only (--shared).
 * @param {{ shared?: boolean }} options
 * @returns {Promise<Record<string, string>>}
 */
async function loadSecretsForGet(options) {
  if (options.shared || options['shared']) {
    return loadSharedSecretsDecrypted();
  }
  return loadLocalUserSecretsDecrypted();
}

/**
 * Handle secret get command.
 * @param {string} key - Secret key (no kv:// prefix)
 * @param {Object} options
 * @param {boolean} [options.shared] - Shared store only (aifabrix-secrets); default is local user file only
 * @param {boolean} [options.exists] - Exit 0 when present; no stdout (script-friendly)
 * @param {boolean} [options.json] - JSON { key, exists, value }
 * @returns {Promise<{ key: string, exists: boolean, value?: string }>}
 */
async function handleSecretsGet(key, options = {}) {
  if (!key || typeof key !== 'string') {
    throw new Error('Secret key is required and must be a string');
  }
  if (key.startsWith('kv://')) {
    throw new Error(
      'Secret key must not start with kv://. Use the key path without the prefix (e.g. hubspot-demo/apiKey).'
    );
  }

  const secrets = await loadSecretsForGet(options);
  const value = secrets[key];
  const present = isSecretPresent(value);

  if (!present) {
    const scope = await resolveSecretsScopeLabel(options);
    throw new Error(`Secret '${key}' is missing or empty in ${scope}.`);
  }

  if (options.exists || options['exists']) {
    return { key, exists: true };
  }

  if (options.json || options['json']) {
    logger.log(JSON.stringify({ key, exists: true, value: String(value) }));
    return { key, exists: true, value: String(value) };
  }

  logger.log(String(value));
  return { key, exists: true, value: String(value) };
}

module.exports = {
  handleSecretsGet,
  isSecretPresent,
  loadSecretsForGet,
  loadLocalUserSecretsDecrypted,
  resolveSecretsScopeLabel
};
