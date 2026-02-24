/**
 * AI Fabrix Builder – Ensure secrets in configured store
 *
 * Ensures missing secret keys exist in the correct store (file path, remote API, or
 * user secrets file). New values are encrypted when writing to file and
 * secrets-encryption is set. Remote write tries API first; on failure falls back
 * to user file with a warning.
 *
 * @fileoverview Central ensure-secrets service for zero-touch install
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('./config');
const pathsUtil = require('../utils/paths');
const logger = require('../utils/logger');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../utils/remote-dev-auth');
const devApi = require('../api/dev.api');
const {
  findMissingSecretKeys,
  generateSecretValue,
  loadExistingSecrets,
  saveSecretsFile
} = require('../utils/secrets-generator');
const { encryptSecret } = require('../utils/secrets-encryption');
const { loadEnvTemplate } = require('../utils/secrets-helpers');

/**
 * Expand leading ~ to home directory.
 * @param {string} filePath - Path that may start with ~
 * @returns {string} Resolved path
 */
function expandTilde(filePath) {
  if (!filePath || typeof filePath !== 'string') return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~' + path.sep)) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Resolve write target from config.
 * - File path → that path (expand ~)
 * - http(s) URL → remote (fallback: user file)
 * - No config → user file
 *
 * @returns {Promise<{ type: 'file'|'remote', filePath?: string, serverUrl?: string, clientCertPem?: string }>}
 */
async function resolveWriteTarget() {
  const secretsPath = await config.getSecretsPath();
  const userFilePath = path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');

  if (!secretsPath) {
    return { type: 'file', filePath: userFilePath };
  }
  if (isRemoteSecretsUrl(secretsPath)) {
    const auth = await getRemoteDevAuth();
    return {
      type: 'remote',
      filePath: userFilePath,
      serverUrl: secretsPath.replace(/\/+$/, ''),
      clientCertPem: auth ? auth.clientCertPem : null
    };
  }
  const filePath = path.isAbsolute(secretsPath)
    ? secretsPath
    : path.resolve(process.cwd(), expandTilde(secretsPath));
  return { type: 'file', filePath };
}

/**
 * Load existing secrets from the resolved target (file or remote).
 *
 * @param {{ type: string, filePath?: string, serverUrl?: string, clientCertPem?: string }} target
 * @returns {Promise<Object>} Existing secrets key-value object
 */
async function loadExistingFromTarget(target) {
  if (target.type === 'file' && target.filePath) {
    return loadExistingSecrets(target.filePath);
  }
  if (target.type === 'remote' && target.serverUrl && target.clientCertPem) {
    try {
      const items = await devApi.listSecrets(target.serverUrl, target.clientCertPem);
      if (!Array.isArray(items)) return {};
      const obj = {};
      for (const item of items) {
        if (item && typeof item.name === 'string' && item.value !== undefined) {
          obj[item.name] = String(item.value);
        }
      }
      return obj;
    } catch {
      return {};
    }
  }
  if (target.type === 'remote' && target.filePath) {
    return loadExistingSecrets(target.filePath);
  }
  return {};
}

/**
 * Write a single secret to file, optionally encrypting the value.
 *
 * @param {string} filePath - Resolved file path
 * @param {string} key - Secret key
 * @param {string} value - Plain value
 * @param {string|null} encryptionKey - Config secrets-encryption key or null
 * @returns {Promise<void>}
 */
async function writeSecretToFile(filePath, key, value, encryptionKey) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const existing = loadExistingSecrets(filePath);
  let valueToWrite = value;
  if (encryptionKey && value !== '') {
    try {
      valueToWrite = encryptSecret(value, encryptionKey);
    } catch {
      // Keep plaintext if encryption fails
    }
  }
  const updated = { ...existing, [key]: valueToWrite };
  saveSecretsFile(filePath, updated);
}

/**
 * Compute value for a key (suggested or generated).
 * @param {string} key - Secret key
 * @param {Object} suggested - Map of suggested values
 * @param {boolean} emptyForCredentials - Use empty string if true
 * @returns {string}
 */
function valueForKey(key, suggested, emptyForCredentials) {
  if (key in suggested) return String(suggested[key]);
  return emptyForCredentials ? '' : generateSecretValue(key);
}

/**
 * Add secrets via remote API; on failure write to local file.
 * @param {Object} target - Resolved target (remote)
 * @param {string[]} toAdd - Keys to add
 * @param {Object} suggested - Suggested values
 * @param {string[]} added - Array to push added keys to
 * @returns {Promise<string[]>}
 */
async function addSecretsRemote(target, toAdd, suggested, added) {
  const emptyForCredentials = false;
  for (const key of toAdd) {
    const value = valueForKey(key, suggested, emptyForCredentials);
    try {
      await devApi.addSecret(target.serverUrl, target.clientCertPem, { key, value });
      added.push(key);
    } catch (err) {
      logger.warn(`Remote secret "${key}" failed (${err.message}); writing to local file.`);
      await writeSecretToFile(target.filePath, key, value, null);
      added.push(key);
    }
  }
  return added;
}

/**
 * Add secrets to file (with optional encryption).
 * @param {string} filePath - File path
 * @param {string[]} toAdd - Keys to add
 * @param {Object} suggested - Suggested values
 * @param {boolean} emptyForCredentials - Use empty for new values
 * @param {string|null} encryptionKey - Encryption key or null
 * @param {string[]} added - Array to push added keys to
 * @returns {Promise<string[]>}
 */
async function addSecretsToFile(filePath, toAdd, suggested, emptyForCredentials, encryptionKey, added) {
  for (const key of toAdd) {
    const value = valueForKey(key, suggested, emptyForCredentials);
    await writeSecretToFile(filePath, key, value, encryptionKey);
    added.push(key);
  }
  if (added.length > 0) {
    logger.log(`✓ Ensured ${added.length} secret key(s): ${added.join(', ')}`);
  }
  return added;
}

/**
 * Ensure a list of secret keys exists in the configured store.
 * Only adds keys that are missing or empty. Uses generateSecretValue for new
 * values unless emptyValuesForCredentials is true (then empty string).
 *
 * @async
 * @function ensureSecretsForKeys
 * @param {string[]} keys - Secret keys to ensure
 * @param {Object} [options] - Options
 * @param {boolean} [options.emptyValuesForCredentials=false] - Use empty string for new values
 * @param {Object} [options.suggestedValues] - Optional map key -> value for specific keys
 * @returns {Promise<string[]>} Keys that were added (new or backfilled)
 * @throws {Error} If config or file write fails
 */
async function ensureSecretsForKeys(keys, options = {}) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return [];
  }
  const emptyForCredentials = Boolean(options.emptyValuesForCredentials);
  const suggested = options.suggestedValues && typeof options.suggestedValues === 'object'
    ? options.suggestedValues
    : {};

  const target = options._targetOverride || await resolveWriteTarget();
  const existing = await loadExistingFromTarget(target);
  const toAdd = keys.filter((k) => {
    const v = existing[k];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  });
  if (toAdd.length === 0) return [];

  const encryptionKey = await config.getSecretsEncryptionKey();
  const added = [];

  if (target.type === 'remote' && target.serverUrl && target.clientCertPem) {
    return addSecretsRemote(target, toAdd, suggested, added);
  }
  return addSecretsToFile(target.filePath, toAdd, suggested, emptyForCredentials, encryptionKey, added);
}

/**
 * Ensure secrets referenced in an env template exist in the configured store.
 * Reads template from path or uses content if content is provided (string with kv://).
 *
 * @async
 * @function ensureSecretsFromEnvTemplate
 * @param {string} envTemplatePathOrContent - Path to env.template or template content
 * @param {Object} [options] - Options
 * @param {boolean} [options.emptyValuesForCredentials=false] - Use empty string for new values
 * @returns {Promise<string[]>} Keys that were added
 * @throws {Error} If template cannot be read or ensure fails
 */
async function ensureSecretsFromEnvTemplate(envTemplatePathOrContent, options = {}) {
  let template;
  const input = typeof envTemplatePathOrContent === 'string' ? envTemplatePathOrContent : '';
  const looksLikePath = input.length > 0 && !input.includes('\n') && !input.includes('kv://');
  if (looksLikePath && fs.existsSync(input)) {
    template = loadEnvTemplate(input);
  } else if (input.includes('kv://')) {
    template = input;
  } else if (looksLikePath) {
    throw new Error(`env.template not found: ${input}`);
  } else {
    throw new Error('env.template path or content is required');
  }
  let target;
  if (options.preferredFilePath && typeof options.preferredFilePath === 'string') {
    const filePath = path.isAbsolute(options.preferredFilePath)
      ? options.preferredFilePath
      : path.resolve(process.cwd(), options.preferredFilePath);
    target = { type: 'file', filePath };
  } else {
    target = await resolveWriteTarget();
  }
  const existing = await loadExistingFromTarget(target);
  const missingKeys = findMissingSecretKeys(template, existing);
  return ensureSecretsForKeys(missingKeys, { ...options, _targetOverride: target });
}

/**
 * Infra secret keys used by createDefaultSecrets / keyvault.md for up-infra.
 * Includes miso-controller DB keys so ensureMisoInitScript can read from store.
 *
 * @type {string[]}
 */
const INFRA_SECRET_KEYS = [
  'postgres-passwordKeyVault',
  'redis-passwordKeyVault',
  'redis-url',
  'keycloak-admin-passwordKeyVault',
  'keycloak-server-url',
  'databases-miso-controller-0-passwordKeyVault',
  'databases-miso-controller-0-urlKeyVault'
];

/**
 * Ensure infra secrets exist in the configured store. Call before ensureAdminSecrets or startInfra.
 *
 * @async
 * @function ensureInfraSecrets
 * @param {Object} [options] - Options
 * @param {string} [options.adminPwd] - Override for postgres-passwordKeyVault when creating new secrets
 * @returns {Promise<string[]>} Keys that were added
 */
async function ensureInfraSecrets(options = {}) {
  const suggested = {};
  if (options.adminPwd && typeof options.adminPwd === 'string' && options.adminPwd.trim() !== '') {
    suggested['postgres-passwordKeyVault'] = options.adminPwd.trim();
  }
  return ensureSecretsForKeys(INFRA_SECRET_KEYS, { suggestedValues: suggested });
}

module.exports = {
  ensureSecretsForKeys,
  ensureSecretsFromEnvTemplate,
  ensureInfraSecrets,
  resolveWriteTarget,
  loadExistingFromTarget,
  INFRA_SECRET_KEYS
};
