/**
 * Secrets loading cascade (user file, aifabrix-secrets file or remote API, builder YAML, defaults).
 *
 * @fileoverview Split from secrets.js for module size limits
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { readYamlAtPath, applyCanonicalSecretsOverride } = require('../utils/secrets-canonical');
const { ensureSecureFilePermissions } = require('../utils/secure-file-permissions');
const {
  resolveSecretsPath
} = require('../utils/secrets-path');
const {
  loadUserSecrets,
  loadPrimaryUserSecrets,
  loadDefaultSecrets,
  ensurePrimaryUserSecretsFileExists
} = require('../utils/secrets-utils');
const { decryptSecret, isEncrypted } = require('../utils/secrets-encryption');
const pathsUtil = require('../utils/paths');

/**
 * Decrypts encrypted values in secrets object
 *
 * @async
 * @param {Object} secrets - Secrets object with potentially encrypted values
 * @returns {Promise<Object>} Secrets object with decrypted values
 */
async function decryptSecretsObject(secrets) {
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

  const decryptedSecrets = {};
  for (const [key, value] of Object.entries(secrets)) {
    if (isEncrypted(value)) {
      try {
        decryptedSecrets[key] = decryptSecret(value, encryptionKey);
      } catch (error) {
        throw new Error(`Failed to decrypt secret '${key}': ${error.message}`);
      }
    } else {
      decryptedSecrets[key] = value;
    }
  }

  return decryptedSecrets;
}

/**
 * Merges config file secrets into user secrets (user wins). Returns null if path missing or config empty.
 */
function mergeUserWithConfigFile(userSecrets, resolvedConfigPath) {
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

async function mergeFromConfiguredSecretsPath(configSecretsPath, userSecrets, helpers) {
  const remoteDevAuth = require('../utils/remote-dev-auth');
  const effectiveShared = await remoteDevAuth.resolveSharedSecretsEndpoint(configSecretsPath);

  if (remoteDevAuth.isRemoteSecretsUrl(effectiveShared)) {
    const { loadRemoteSharedSecrets, mergeUserWithRemoteSecrets } = require('../utils/remote-secrets-loader');
    const remoteSecrets = await loadRemoteSharedSecrets();
    const merged = mergeUserWithRemoteSecrets(userSecrets, remoteSecrets);
    return helpers.hasKeys(merged) ? merged : helpers.userOrNull();
  }

  const resolvedConfigPath = path.isAbsolute(configSecretsPath)
    ? configSecretsPath
    : path.resolve(process.cwd(), configSecretsPath);
  const merged = mergeUserWithConfigFile(userSecrets, resolvedConfigPath);
  return merged !== null ? merged : helpers.userOrNull();
}

async function loadMergedConfigAndUserSecrets() {
  const userSecrets = loadPrimaryUserSecrets();
  const helpers = createMergeHelpers(userSecrets);

  try {
    const configSecretsPath = await config.getSecretsPath();
    if (!configSecretsPath) {
      return helpers.userOrNull();
    }
    return await mergeFromConfiguredSecretsPath(configSecretsPath, userSecrets, helpers);
  } catch (error) {
    if (error.message && error.message.startsWith('Failed to load secrets file')) {
      throw error;
    }
    return null;
  }
}

function collectBuilderSecretsYamlPaths() {
  const projectRoot = pathsUtil.getProjectRoot();
  const candidates = [];
  if (projectRoot) {
    candidates.push(path.join(projectRoot, 'builder', 'secrets.local.yaml'));
  }
  try {
    const alt = path.join(pathsUtil.getBuilderRoot(), 'secrets.local.yaml');
    if (!candidates.length || path.resolve(candidates[0]) !== path.resolve(alt)) {
      candidates.push(alt);
    }
  } catch {
    /* ignore */
  }
  return candidates;
}

function mergeBuilderSecretsLocalFiles(merged) {
  try {
    const seen = new Set();
    let out = merged;
    for (const builderPath of collectBuilderSecretsYamlPaths()) {
      if (!builderPath || seen.has(path.resolve(builderPath))) {
        continue;
      }
      seen.add(path.resolve(builderPath));
      if (fs.existsSync(builderPath)) {
        ensureSecureFilePermissions(builderPath);
        const builderSecrets = mergeUserWithConfigFile(out || {}, builderPath);
        if (builderSecrets) out = builderSecrets;
      }
    }
    return out;
  } catch {
    return merged;
  }
}

async function loadSecretsWithFallbacks() {
  let merged = await loadMergedConfigAndUserSecrets();
  if (!merged || Object.keys(merged).length === 0) {
    merged = loadPrimaryUserSecrets();
    if (Object.keys(merged).length === 0) {
      merged = loadUserSecrets();
    }
    merged = await applyCanonicalSecretsOverride(merged);
  }
  merged = mergeBuilderSecretsLocalFiles(merged);
  if (Object.keys(merged).length === 0) {
    merged = loadDefaultSecrets();
  }
  return merged;
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
    return await decryptSecretsObject(explicitSecrets);
  }
  let mergedSecrets = await loadSecretsWithFallbacks();
  if (!mergedSecrets || Object.keys(mergedSecrets).length === 0) {
    ensurePrimaryUserSecretsFileExists();
    mergedSecrets = await loadSecretsWithFallbacks();
  }
  return await decryptSecretsObject(mergedSecrets || {});
}

module.exports = {
  loadSecrets,
  decryptSecretsObject
};
