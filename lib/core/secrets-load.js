/**
 * Secrets loading: primary user file plus configured `aifabrix-secrets` (shared YAML or remote API).
 *
 * @fileoverview Default `kv://` resolution uses only `~/.aifabrix/secrets.local.yaml` and `aifabrix-secrets`
 *   from config — not cwd-ancestor `.aifabrix/secrets.local.yaml`, not `builder/secrets.local.yaml`,
 *   and not `~/.aifabrix/secrets.yaml`.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { readYamlAtPath, applyCanonicalSecretsOverride } = require('../utils/secrets-canonical');
const { ensureSecureFilePermissions } = require('../utils/secure-file-permissions');
const { resolveSecretsPath } = require('../utils/secrets-path');
const {
  loadPrimaryUserSecrets,
  loadDefaultSecrets,
  ensurePrimaryUserSecretsFileExists
} = require('../utils/secrets-utils');
const pathsUtil = require('../utils/paths');
const { decryptSecret, isEncrypted } = require('../utils/secrets-encryption');
const logger = require('../utils/logger');
const { isSecretKeyAllowedEmpty } = require('./secrets-ensure-infra');

/** Dedupe optional decrypt warnings across repeated `loadSecrets` (and duplicate module instances). */
function optionalDecryptWarnSeen(key) {
  const g = globalThis;
  if (!g.__aifabrixOptionalDecryptWarnOnce) {
    g.__aifabrixOptionalDecryptWarnOnce = new Set();
  }
  const set = g.__aifabrixOptionalDecryptWarnOnce;
  if (set.has(key)) return true;
  set.add(key);
  return false;
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {string} encryptionKey
 * @param {Record<string, string>} decryptedSecrets
 * @param {string} [sourceHint] - File path or API label for decrypt errors / warnings
 */
function mergeDecryptedEntry(key, value, encryptionKey, decryptedSecrets, sourceHint) {
  if (!isEncrypted(value)) {
    decryptedSecrets[key] = value;
    return;
  }
  try {
    decryptedSecrets[key] = decryptSecret(value, encryptionKey);
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    if (!isSecretKeyAllowedEmpty(key)) {
      const where =
        sourceHint && String(sourceHint).trim().length > 0
          ? ` (encrypted value loaded from: ${sourceHint})`
          : ' (encrypted value source not recorded; check ~/.aifabrix/secrets.local.yaml and aifabrix-secrets)';
      throw new Error(`Failed to decrypt secret '${key}'${where}: ${msg}`);
    }
    if (!optionalDecryptWarnSeen(key)) {
      const where =
        sourceHint && String(sourceHint).trim().length > 0
          ? ` Encrypted value loaded from: ${sourceHint}.`
          : '';
      logger.warn(
        `Optional secret '${key}' could not be decrypted (${msg}). Treating as empty.${where} ` +
          'Remove the stale key from shared or local secrets, or fix secrets-encryption alignment.'
      );
    }
    decryptedSecrets[key] = '';
  }
}

/**
 * Decrypts encrypted values in secrets object
 *
 * @async
 * @param {Object} secrets - Secrets object with potentially encrypted values
 * @param {{ keySources?: Record<string, string>, defaultSourceLabel?: string }} [options] - Per-key file/API path for errors
 * @returns {Promise<Object>} Secrets object with decrypted values
 */
async function decryptSecretsObject(secrets, options) {
  if (!secrets || typeof secrets !== 'object') {
    return secrets;
  }

  const encryptionKey = await config.getSecretsEncryptionKey();
  if (!encryptionKey) {
    const hasEncrypted = Object.values(secrets).some((value) => isEncrypted(value));
    if (hasEncrypted) {
      throw new Error(
        'Encrypted secrets found but no encryption key configured. Run "aifabrix secure --secrets-encryption <key>" to set encryption key.'
      );
    }
    return secrets;
  }

  const keySources = options && options.keySources ? options.keySources : null;
  const defaultLabel = options && options.defaultSourceLabel ? options.defaultSourceLabel : '';

  const decryptedSecrets = {};
  for (const [key, value] of Object.entries(secrets)) {
    const sourceHint = (keySources && keySources[key]) || defaultLabel || '';
    mergeDecryptedEntry(key, value, encryptionKey, decryptedSecrets, sourceHint);
  }

  return decryptedSecrets;
}

/**
 * Merges config file secrets into user secrets (user wins). Returns null if path missing or config empty.
 * @param {Record<string, string>} [keySources] - Mutated: path for keys filled from this file
 */
function mergeUserWithConfigFile(userSecrets, resolvedConfigPath, keySources) {
  if (!fs.existsSync(resolvedConfigPath)) {
    return null;
  }
  ensureSecureFilePermissions(resolvedConfigPath);
  let configSecrets;
  try {
    configSecrets = readYamlAtPath(resolvedConfigPath);
  } catch (loadError) {
    throw new Error(`Failed to load secrets file ${resolvedConfigPath}: ${loadError.message}`);
  }
  if (!configSecrets || typeof configSecrets !== 'object') {
    return null;
  }
  const merged = { ...userSecrets };
  for (const key of Object.keys(configSecrets)) {
    if (!(key in merged) || merged[key] === undefined || merged[key] === null || merged[key] === '') {
      merged[key] = configSecrets[key];
      if (keySources) {
        keySources[key] = resolvedConfigPath;
      }
    }
  }
  return merged;
}

function createMergeHelpers(userSecrets) {
  const hasKeys = (obj) => obj && Object.keys(obj).length > 0;
  return {
    hasKeys,
    userOrNull: () => (hasKeys(userSecrets) ? userSecrets : null)
  };
}

async function mergeFromConfiguredSecretsPath(configSecretsPath, userSecrets, helpers, keySources) {
  const remoteDevAuth = require('../utils/remote-dev-auth');
  const effectiveShared = await remoteDevAuth.resolveSharedSecretsEndpoint(configSecretsPath);

  if (remoteDevAuth.isRemoteSecretsUrl(effectiveShared)) {
    const { loadRemoteSharedSecrets, mergeUserWithRemoteSecrets } = require('../utils/remote-secrets-loader');
    const remoteSecrets = await loadRemoteSharedSecrets();
    const remoteLabel = `shared secrets API (${effectiveShared})`;
    const merged = mergeUserWithRemoteSecrets(userSecrets, remoteSecrets, keySources, remoteLabel);
    return helpers.hasKeys(merged) ? merged : helpers.userOrNull();
  }

  const resolvedConfigPath = path.isAbsolute(configSecretsPath)
    ? configSecretsPath
    : path.resolve(process.cwd(), configSecretsPath);
  const merged = mergeUserWithConfigFile(userSecrets, resolvedConfigPath, keySources);
  return merged !== null ? merged : helpers.userOrNull();
}

async function loadMergedConfigAndUserSecrets() {
  const userSecrets = loadPrimaryUserSecrets();
  const helpers = createMergeHelpers(userSecrets);
  const userPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  /** @type {Record<string, string>} */
  const keySources = {};
  for (const k of Object.keys(userSecrets || {})) {
    keySources[k] = userPath;
  }

  try {
    const configSecretsPath = await config.getSecretsPath();
    if (!configSecretsPath) {
      return { merged: helpers.userOrNull(), keySources };
    }
    const merged = await mergeFromConfiguredSecretsPath(configSecretsPath, userSecrets, helpers, keySources);
    return { merged, keySources };
  } catch (error) {
    if (error.message && error.message.startsWith('Failed to load secrets file')) {
      throw error;
    }
    return { merged: null, keySources };
  }
}

async function loadSecretsWithFallbacks() {
  const mergedResult = await loadMergedConfigAndUserSecrets();
  let merged = mergedResult.merged;
  const keySources = mergedResult.keySources;
  if (!merged || Object.keys(merged).length === 0) {
    merged = loadPrimaryUserSecrets();
    const userPath = pathsUtil.getPrimaryUserSecretsLocalPath();
    for (const k of Object.keys(merged || {})) {
      keySources[k] = userPath;
    }
    merged = await applyCanonicalSecretsOverride(merged || {}, keySources);
  }
  const configuredShared = await config.getSecretsPath();
  if ((!merged || Object.keys(merged).length === 0) && !configuredShared) {
    merged = loadDefaultSecrets();
    const defaultPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');
    for (const k of Object.keys(merged || {})) {
      keySources[k] = defaultPath;
    }
  }
  if (!merged || Object.keys(merged).length === 0) {
    return { merged: {}, keySources };
  }
  return { merged, keySources };
}

/**
 * @param {string} [secretsPath]
 * @param {string} [_appName]
 */
async function loadSecrets(secretsPath, _appName) {
  if (secretsPath) {
    const resolvedPath = resolveSecretsPath(secretsPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Secrets file not found: ${resolvedPath}`);
    }
    ensureSecureFilePermissions(resolvedPath);
    const explicitSecrets = readYamlAtPath(resolvedPath);
    if (!explicitSecrets || typeof explicitSecrets !== 'object') {
      throw new Error(`Invalid secrets file format: ${resolvedPath}`);
    }
    return await decryptSecretsObject(explicitSecrets, { defaultSourceLabel: resolvedPath });
  }
  let { merged: mergedSecrets, keySources } = await loadSecretsWithFallbacks();
  if (!mergedSecrets || Object.keys(mergedSecrets).length === 0) {
    ensurePrimaryUserSecretsFileExists();
    const again = await loadSecretsWithFallbacks();
    mergedSecrets = again.merged;
    keySources = again.keySources;
  }
  return await decryptSecretsObject(mergedSecrets || {}, { keySources });
}

module.exports = {
  loadSecrets,
  decryptSecretsObject
};
