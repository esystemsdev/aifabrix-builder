/**
 * Local Secrets Management Utilities
 *
 * Helper functions for managing local secrets in getPrimaryUserSecretsLocalPath() (config dir)
 *
 * @fileoverview Local secrets management utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../utils/logger');
const pathsUtil = require('./paths');
const { mergeSecretsIntoFile } = require('./secrets-generator');

/** Bootstrap key name; never encrypt this key's value when writing (key is stored in config). */
const ENCRYPTION_KEY_VAULT = 'secrets-encryptionKeyVault';

/**
 * Resolves value to write: encrypted (secure://) when encryption key is set and key is not the bootstrap key.
 * @async
 * @param {string} key - Secret key name
 * @param {string} value - Secret value
 * @returns {Promise<string>} Value to write (plaintext or secure://...)
 */
async function resolveValueForWrite(key, value) {
  const config = require('../core/config');
  const encryptionKey = await config.getSecretsEncryptionKey();
  if (!encryptionKey || key === ENCRYPTION_KEY_VAULT) {
    return typeof value === 'string' ? value : String(value);
  }
  const { encryptSecret } = require('./secrets-encryption');
  return encryptSecret(typeof value === 'string' ? value : String(value), encryptionKey);
}

/**
 * Saves a secret to the primary user secrets file (getPrimaryUserSecretsLocalPath)
 * Merges the key into the file (updates in place if key already exists, e.g. after rotate-secret).
 * Encrypts the value when a secrets-encryption key is configured (except for the bootstrap key).
 *
 * @async
 * @function saveLocalSecret
 * @param {string} key - Secret key name
 * @param {string} value - Secret value
 * @returns {Promise<void>} Resolves when secret is saved
 * @throws {Error} If save fails
 *
 * @example
 * await saveLocalSecret('myapp-client-idKeyVault', 'client-id-value');
 */
async function saveLocalSecret(key, value) {
  if (!key || typeof key !== 'string') {
    throw new Error('Secret key is required and must be a string');
  }

  if (value === undefined || value === null) {
    throw new Error('Secret value is required');
  }

  const valueToWrite = await resolveValueForWrite(key, value);
  const secretsPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  mergeSecretsIntoFile(secretsPath, { [key]: valueToWrite });
}

/**
 * Saves a secret to a specified secrets file path
 * Merges the key into the file (updates in place if key already exists)
 *
 * @async
 * @function saveSecret
 * @param {string} key - Secret key name
 * @param {string} value - Secret value
 * @param {string} secretsPath - Path to secrets file (absolute or relative)
 * @returns {Promise<void>} Resolves when secret is saved
 * @throws {Error} If save fails
 *
 * @example
 * await saveSecret('myapp-client-idKeyVault', 'client-id-value', '/path/to/secrets.yaml');
 */
/**
 * Validates save secret parameters
 * @function validateSaveSecretParams
 * @param {string} key - Secret key
 * @param {*} value - Secret value
 * @param {string} secretsPath - Secrets path
 * @throws {Error} If validation fails
 */
function validateSaveSecretParams(key, value, secretsPath) {
  if (!key || typeof key !== 'string') {
    throw new Error('Secret key is required and must be a string');
  }
  if (value === undefined || value === null) {
    throw new Error('Secret value is required');
  }
  if (!secretsPath || typeof secretsPath !== 'string') {
    throw new Error('Secrets path is required and must be a string');
  }
}

/**
 * Resolves and prepares secrets path
 * @function resolveAndPrepareSecretsPath
 * @param {string} secretsPath - Secrets path
 * @returns {string} Resolved path
 */
function resolveAndPrepareSecretsPath(secretsPath) {
  const resolvedPath = path.isAbsolute(secretsPath)
    ? secretsPath
    : path.resolve(process.cwd(), secretsPath);

  const secretsDir = path.dirname(resolvedPath);
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
  }

  return resolvedPath;
}

/**
 * Loads existing secrets from file
 * @function _loadExistingSecrets
 * @param {string} resolvedPath - Resolved secrets path
 * @returns {Object} Existing secrets object
 */
function _loadExistingSecrets(resolvedPath) {
  if (!fs.existsSync(resolvedPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const existingSecrets = yaml.load(content) || {};
    return typeof existingSecrets === 'object' ? existingSecrets : {};
  } catch (error) {
    logger.warn(`Warning: Could not read existing secrets file: ${error.message}`);
    return {};
  }
}

async function saveSecret(key, value, secretsPath) {
  validateSaveSecretParams(key, value, secretsPath);

  const valueToWrite = await resolveValueForWrite(key, value);
  const resolvedPath = resolveAndPrepareSecretsPath(secretsPath);
  mergeSecretsIntoFile(resolvedPath, { [key]: valueToWrite });
}

/**
 * Checks if a URL is localhost
 * @function isLocalhost
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is localhost
 */
function isLocalhost(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const urlLower = url.toLowerCase();
  return urlLower.includes('localhost') || urlLower.includes('127.0.0.1');
}

module.exports = { saveLocalSecret, saveSecret, isLocalhost };

