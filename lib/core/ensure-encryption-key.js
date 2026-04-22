/**
 * Ensure secrets encryption key exists on empty install.
 * If missing from config and from user/project secrets, generates and saves one. Never logs the key.
 *
 * @fileoverview Encryption key bootstrap for empty installation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const crypto = require('crypto');
const pathsUtil = require('../utils/paths');

const ENCRYPTION_KEY = 'secrets-encryptionKeyVault';

function readKeyFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content);
    if (data && typeof data[ENCRYPTION_KEY] === 'string') return data[ENCRYPTION_KEY];
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Ensure secrets encryption key exists. If config already has it, do nothing.
 * If key exists in user or project secrets file, set config. Otherwise generate and store only in config (not in secrets file).
 * @param {Object} config - Config module (getSecretsEncryptionKey, setSecretsEncryptionKey, getSecretsPath)
 * @returns {Promise<void>}
 */
async function ensureSecretsEncryptionKey(config) {
  const existing = await config.getSecretsEncryptionKey();
  if (existing) return;

  const userSecretsPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  const projectSecretsPath = await config.getSecretsPath();

  let key = readKeyFromFile(userSecretsPath);
  if (!key && projectSecretsPath) key = readKeyFromFile(path.resolve(projectSecretsPath));
  if (key) {
    await config.setSecretsEncryptionKey(key);
    return;
  }

  const newKey = crypto.randomBytes(32).toString('hex');
  await config.setSecretsEncryptionKey(newKey);
}

module.exports = { ensureSecretsEncryptionKey };
