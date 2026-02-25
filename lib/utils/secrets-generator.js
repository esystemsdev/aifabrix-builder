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
 * Parse key-value pairs from YAML-like lines (last occurrence wins per key).
 * @param {string} content - Raw YAML content
 * @returns {Object} Parsed object
 */
function parseYamlKeyValueLines(content) {
  const result = {};
  const keyValueRe = /^\s*([^#:]+):\s*(.*)$/;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const m = line.match(keyValueRe);
    if (!m) continue;
    const key = m[1].trim();
    let value = m[2].trim();
    if ((value.startsWith('\'') && value.endsWith('\'')) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1).replace(/\\'/g, '\'').replace(/\\"/g, '"');
    }
    result[key] = value;
  }
  return result;
}

/**
 * Parse YAML content tolerating duplicate keys (last occurrence wins).
 * Use for secrets files that may have been appended to repeatedly.
 * Tries yaml.load first; on "duplicate key" error falls back to line-by-line parse.
 *
 * @param {string} content - Raw YAML content
 * @returns {Object} Parsed object (last value wins for duplicate keys)
 */
function loadYamlTolerantOfDuplicateKeys(content) {
  if (!content || typeof content !== 'string') {
    return {};
  }
  try {
    const parsed = yaml.load(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    const msg = err.message || '';
    if (!msg.includes('duplicate') && !msg.includes('duplicated mapping')) {
      throw err;
    }
  }
  return parseYamlKeyValueLines(content);
}

/**
 * Skips commented or empty lines when scanning env.template
 * @param {string} line - Single line
 * @returns {boolean}
 */
function isCommentOrEmptyLine(line) {
  const t = line.trim();
  return t === '' || t.startsWith('#');
}

/**
 * Finds missing secret keys from template (skips commented and empty lines)
 * @function findMissingSecretKeys
 * @param {string} envTemplate - Environment template content
 * @param {Object} existingSecrets - Existing secrets object
 * @returns {string[]} Array of missing secret keys
 */
function findMissingSecretKeys(envTemplate, existingSecrets) {
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  const missingKeys = [];
  const seenKeys = new Set();
  const lines = envTemplate.split('\n');

  for (const line of lines) {
    if (isCommentOrEmptyLine(line)) continue;
    let match;
    kvPattern.lastIndex = 0;
    while ((match = kvPattern.exec(line)) !== null) {
      const secretKey = match[1];
      if (!seenKeys.has(secretKey) && !(secretKey in existingSecrets)) {
        missingKeys.push(secretKey);
        seenKeys.add(secretKey);
      }
    }
  }

  return missingKeys;
}

/**
 * Generate database password value for a key (databases-*-passwordKeyVault)
 * @param {string} key - Secret key name
 * @returns {string|null} Password string or null if key does not match
 */
function generateDbPasswordValue(key) {
  const dbPasswordMatch = key.match(/^databases-([a-z0-9-_]+)-\d+-passwordKeyVault$/i);
  if (!dbPasswordMatch) return null;
  const appName = dbPasswordMatch[1];
  if (appName === 'miso-controller') return 'miso_pass123';
  const dbName = appName.replace(/-/g, '_');
  return `${dbName}_pass123`;
}

/**
 * Generate database URL value for a key (databases-*-urlKeyVault)
 * @param {string} key - Secret key name
 * @returns {string|null} URL string or null if key does not match
 */
function generateDbUrlValue(key) {
  const dbUrlMatch = key.match(/^databases-([a-z0-9-_]+)-\d+-urlKeyVault$/i);
  if (!dbUrlMatch) return null;
  const appName = dbUrlMatch[1];
  if (appName === 'miso-controller') {
    return 'postgresql://miso_user:miso_pass123@${DB_HOST}:${DB_PORT}/miso';
  }
  const dbName = appName.replace(/-/g, '_');
  return `postgresql://${dbName}_user:${dbName}_pass123@\${DB_HOST}:\${DB_PORT}/${dbName}`;
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
    const dbPassword = generateDbPasswordValue(key);
    if (dbPassword !== null) return dbPassword;
    return crypto.randomBytes(32).toString('base64');
  }

  if (keyLower.includes('url') || keyLower.includes('uri')) {
    const dbUrl = generateDbUrlValue(key);
    if (dbUrl !== null) return dbUrl;
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
    const secrets = loadYamlTolerantOfDuplicateKeys(content);
    return typeof secrets === 'object' ? secrets : {};
  } catch (error) {
    logger.warn(`Warning: Could not read existing secrets file: ${error.message}`);
    return {};
  }
}

/**
 * Saves secrets file (full overwrite). Use appendSecretsToFile to add keys without changing existing content.
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

const YAML_DUMP_OPTS = { indent: 2, lineWidth: 120, noRefs: true, sortKeys: false };

/**
 * Appends secret keys to the end of the secrets file without modifying existing content (preserves comments and structure).
 * Creates the file if it does not exist. For existing files, new keys are appended.
 * When the file has duplicate keys, use loadExistingSecrets (tolerant parse) to read; last occurrence wins.
 *
 * @function appendSecretsToFile
 * @param {string} resolvedPath - Path to secrets file
 * @param {Object} secrets - Key-value object to append (only these keys are written)
 * @throws {Error} If write fails
 */
function appendSecretsToFile(resolvedPath, secrets) {
  if (!secrets || typeof secrets !== 'object' || Object.keys(secrets).length === 0) {
    return;
  }
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const appendContent = yaml.dump(secrets, YAML_DUMP_OPTS);

  if (!fs.existsSync(resolvedPath)) {
    fs.writeFileSync(resolvedPath, appendContent, { mode: 0o600 });
    return;
  }

  let existing = '';
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    existing = typeof raw === 'string' ? raw : '';
  } catch (err) {
    logger.warn(`Could not read existing secrets file: ${err.message}; appending new keys only.`);
  }
  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(resolvedPath, existing + separator + appendContent, { mode: 0o600 });
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

  appendSecretsToFile(resolvedPath, newSecrets);

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
redis-url: "redis://\${REDIS_HOST}:\${REDIS_PORT}"

# Keycloak Secrets
keycloak-admin-passwordKeyVault: "admin123"
keycloak-server-url: "http://\${KEYCLOAK_HOST}:\${KEYCLOAK_PORT}"
`;

  fs.writeFileSync(resolvedPath, defaultSecrets, { mode: 0o600 });
}

module.exports = {
  findMissingSecretKeys,
  generateSecretValue,
  loadYamlTolerantOfDuplicateKeys,
  loadExistingSecrets,
  saveSecretsFile,
  appendSecretsToFile,
  generateMissingSecrets,
  createDefaultSecrets
};

