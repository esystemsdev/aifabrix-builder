/**
 * Local Secrets Management Utilities
 *
 * Helper functions for managing local secrets in ~/.aifabrix/secrets.local.yaml
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

/**
 * Saves a secret to ~/.aifabrix/secrets.local.yaml
 * Uses paths.getAifabrixHome() to respect config.yaml aifabrix-home override
 * Merges with existing secrets without overwriting other keys
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

  const secretsPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');
  const secretsDir = path.dirname(secretsPath);

  // Create directory if needed
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
  }

  // Load existing secrets
  let existingSecrets = {};
  if (fs.existsSync(secretsPath)) {
    try {
      const content = fs.readFileSync(secretsPath, 'utf8');
      existingSecrets = yaml.load(content) || {};
      if (typeof existingSecrets !== 'object') {
        existingSecrets = {};
      }
    } catch (error) {
      logger.warn(`Warning: Could not read existing secrets file: ${error.message}`);
      existingSecrets = {};
    }
  }

  // Merge with new secret
  const updatedSecrets = {
    ...existingSecrets,
    [key]: value
  };

  // Save to file
  const yamlContent = yaml.dump(updatedSecrets, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });

  fs.writeFileSync(secretsPath, yamlContent, { mode: 0o600 });
}

/**
 * Saves a secret to a specified secrets file path
 * Merges with existing secrets without overwriting other keys
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
 * @function loadExistingSecrets
 * @param {string} resolvedPath - Resolved secrets path
 * @returns {Object} Existing secrets object
 */
function loadExistingSecrets(resolvedPath) {
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

  const resolvedPath = resolveAndPrepareSecretsPath(secretsPath);
  const existingSecrets = loadExistingSecrets(resolvedPath);

  const updatedSecrets = { ...existingSecrets, [key]: value };
  const yamlContent = yaml.dump(updatedSecrets, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });

  fs.writeFileSync(resolvedPath, yamlContent, { mode: 0o600 });
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

