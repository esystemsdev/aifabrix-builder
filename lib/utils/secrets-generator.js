/**
 * AI Fabrix Builder Secrets Generation Utilities
 *
 * This module handles secret generation and file management.
 * Generates default secret values and manages secrets files.
 *
 * @fileoverview Secret generation utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const crypto = require('crypto');
const logger = require('./logger');
const pathsUtil = require('./paths');

/**
 * Finds missing secret keys from template
 * @function findMissingSecretKeys
 * @param {string} envTemplate - Environment template content
 * @param {Object} existingSecrets - Existing secrets object
 * @returns {string[]} Array of missing secret keys
 */
function findMissingSecretKeys(envTemplate, existingSecrets) {
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  const missingKeys = [];
  const seenKeys = new Set();

  let match;
  while ((match = kvPattern.exec(envTemplate)) !== null) {
    const secretKey = match[1];
    if (!seenKeys.has(secretKey) && !(secretKey in existingSecrets)) {
      missingKeys.push(secretKey);
      seenKeys.add(secretKey);
    }
  }

  return missingKeys;
}

/**
 * Generates secret value based on key name
 * @function generateSecretValue
 * @param {string} key - Secret key name
 * @returns {string} Generated secret value
 */
function generateSecretValue(key) {
  const keyLower = key.toLowerCase();

  if (keyLower.includes('password')) {
    const dbPasswordMatch = key.match(/^databases-([a-z0-9-_]+)-\d+-passwordKeyVault$/i);
    if (dbPasswordMatch) {
      const appName = dbPasswordMatch[1];
      const dbName = appName.replace(/-/g, '_');
      return `${dbName}_pass123`;
    }
    return crypto.randomBytes(32).toString('base64');
  }

  if (keyLower.includes('url') || keyLower.includes('uri')) {
    const dbUrlMatch = key.match(/^databases-([a-z0-9-_]+)-\d+-urlKeyVault$/i);
    if (dbUrlMatch) {
      const appName = dbUrlMatch[1];
      const dbName = appName.replace(/-/g, '_');
      return `postgresql://${dbName}_user:${dbName}_pass123@\${DB_HOST}:\${DB_PORT}/${dbName}`;
    }
    return '';
  }

  if (keyLower.includes('key') || keyLower.includes('secret') || keyLower.includes('token')) {
    return crypto.randomBytes(32).toString('base64');
  }

  return '';
}

/**
 * Loads existing secrets from file
 * @function loadExistingSecrets
 * @param {string} resolvedPath - Path to secrets file
 * @returns {Object} Existing secrets object
 */
function loadExistingSecrets(resolvedPath) {
  if (!fs.existsSync(resolvedPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const secrets = yaml.load(content) || {};
    return typeof secrets === 'object' ? secrets : {};
  } catch (error) {
    logger.warn(`Warning: Could not read existing secrets file: ${error.message}`);
    return {};
  }
}

/**
 * Saves secrets file
 * @function saveSecretsFile
 * @param {string} resolvedPath - Path to secrets file
 * @param {Object} secrets - Secrets object to save
 * @throws {Error} If save fails
 */
function saveSecretsFile(resolvedPath, secrets) {
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const yamlContent = yaml.dump(secrets, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });

  fs.writeFileSync(resolvedPath, yamlContent, { mode: 0o600 });
}

/**
 * Generates missing secret keys in secrets file
 * Scans env.template for kv:// references and adds missing keys with secure defaults
 * Uses paths.getAifabrixHome() to respect config.yaml aifabrix-home override when path not provided
 *
 * @async
 * @function generateMissingSecrets
 * @param {string} envTemplate - Environment template content
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @returns {Promise<string[]>} Array of newly generated secret keys
 * @throws {Error} If generation fails
 *
 * @example
 * const newKeys = await generateMissingSecrets(template, '~/.aifabrix/secrets.yaml');
 * // Returns: ['new-secret-key', 'another-secret']
 */
async function generateMissingSecrets(envTemplate, secretsPath) {
  const resolvedPath = secretsPath || path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');
  const existingSecrets = loadExistingSecrets(resolvedPath);
  const missingKeys = findMissingSecretKeys(envTemplate, existingSecrets);

  if (missingKeys.length === 0) {
    return [];
  }

  const newSecrets = {};
  for (const key of missingKeys) {
    newSecrets[key] = generateSecretValue(key);
  }

  const updatedSecrets = { ...existingSecrets, ...newSecrets };
  saveSecretsFile(resolvedPath, updatedSecrets);

  logger.log(`✓ Generated ${missingKeys.length} missing secret key(s): ${missingKeys.join(', ')}`);
  return missingKeys;
}

/**
 * Creates default secrets file if it doesn't exist
 * Generates template with common secrets for local development
 *
 * @async
 * @function createDefaultSecrets
 * @param {string} secretsPath - Path where to create secrets file
 * @returns {Promise<void>} Resolves when file is created
 * @throws {Error} If file creation fails
 *
 * @example
 * await createDefaultSecrets('~/.aifabrix/secrets.yaml');
 * // Default secrets file is created
 */
async function createDefaultSecrets(secretsPath) {
  const resolvedPath = secretsPath.startsWith('~')
    ? path.join(os.homedir(), secretsPath.slice(1))
    : secretsPath;

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const defaultSecrets = `# Local Development Secrets
# Production uses Azure KeyVault

# Database Secrets
postgres-passwordKeyVault: "admin123"

# Redis Secrets
redis-passwordKeyVault: ""
redis-urlKeyVault: "redis://\${REDIS_HOST}:\${REDIS_PORT}"

# Keycloak Secrets
keycloak-admin-passwordKeyVault: "admin123"
keycloak-auth-server-urlKeyVault: "http://\${KEYCLOAK_HOST}:\${KEYCLOAK_PORT}"
`;

  fs.writeFileSync(resolvedPath, defaultSecrets, { mode: 0o600 });
}

module.exports = {
  findMissingSecretKeys,
  generateSecretValue,
  loadExistingSecrets,
  saveSecretsFile,
  generateMissingSecrets,
  createDefaultSecrets
};

