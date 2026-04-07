/**
 * Read and decrypt admin-secrets.env for use in Docker runs.
 * Supports plain KEY=value and secure:// encrypted values; uses config secrets-encryption key.
 * Decrypted content is for in-memory use only (e.g. to build a temporary .env for compose).
 *
 * @fileoverview Admin secrets read/decrypt for infra and application runs
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const config = require('./config');
const { decryptSecret, isEncrypted } = require('../utils/secrets-encryption');
const { ensureSecureFilePermissions } = require('../utils/secure-file-permissions');

/**
 * Parse .env-style content into key-value map (excludes comments and empty lines).
 * Values are trimmed; does not unescape quotes.
 * @param {string} content - Raw file content
 * @returns {Object.<string, string>} Map of variable name to value
 */
function parseAdminEnvContent(content) {
  const map = {};
  if (!content || typeof content !== 'string') return map;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.substring(0, eq).trim();
      let value = trimmed.substring(eq + 1);
      if (value.length >= 2 && (value.startsWith('"') && value.endsWith('"') || value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1);
      }
      map[key] = value.trim();
    }
  }
  return map;
}

/**
 * Read admin-secrets.env from disk and return decrypted key-value object.
 * Values with secure:// prefix are decrypted using config secrets-encryption key.
 * Use the returned object only in memory (e.g. to build a temporary .env for docker compose).
 *
 * @async
 * @param {string} [adminSecretsPath] - Path to admin-secrets.env; default: beside config.yaml (typically ~/.aifabrix), with legacy fallback under aifabrix-home when only that file exists
 * @returns {Promise<Object.<string, string>>} Plain object e.g. { POSTGRES_PASSWORD, PGADMIN_DEFAULT_EMAIL, ... }
 * @throws {Error} If file missing, or encrypted value and decryption fails / no key configured
 */
async function readAndDecryptAdminSecrets(adminSecretsPath) {
  const pathsUtil = require('../utils/paths');
  let resolvedPath = adminSecretsPath;
  if (!resolvedPath) {
    const systemPath = path.join(pathsUtil.getAifabrixSystemDir(), 'admin-secrets.env');
    const legacyPath = path.join(pathsUtil.getAifabrixHome(), 'admin-secrets.env');
    resolvedPath = fs.existsSync(systemPath)
      ? systemPath
      : fs.existsSync(legacyPath)
        ? legacyPath
        : systemPath;
  }
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Admin secrets file not found: ${resolvedPath}. Run 'aifabrix up-infra' or ensure admin-secrets.env exists.`);
  }
  ensureSecureFilePermissions(resolvedPath);
  const content = fs.readFileSync(resolvedPath, 'utf8');
  const raw = parseAdminEnvContent(content);
  const encryptionKey = await config.getSecretsEncryptionKey();
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value && isEncrypted(value)) {
      if (!encryptionKey) {
        throw new Error('Admin secrets contain encrypted values but no secrets-encryption key is configured. Run "aifabrix secure --secrets-encryption <key>" to set the key.');
      }
      out[key] = decryptSecret(value, encryptionKey);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Serialize a key-value object to .env file format (KEY=value, one per line).
 * @param {Object.<string, string>} obj - Decrypted admin or merged env object
 * @returns {string} .env file content
 */
function envObjectToContent(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === undefined || key === '') continue;
    const safe = String(value ?? '').replace(/\n/g, ' ').trim();
    lines.push(`${key}=${safe}`);
  }
  return lines.join('\n');
}

module.exports = {
  readAndDecryptAdminSecrets,
  parseAdminEnvContent,
  envObjectToContent
};
