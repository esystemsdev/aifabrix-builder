/**
 * Secrets path config helpers.
 *
 * @fileoverview Keeps lib/core/config.js under max-lines
 */

'use strict';

const os = require('os');
const path = require('path');

/**
 * Expand leading ~ to home directory so config paths like ~/.aifabrix/secrets.local.yaml resolve correctly.
 * @param {string} filePath - Path that may start with ~ or ~/
 * @returns {string} Path with ~ expanded, or unchanged if no leading ~
 */
function expandTilde(filePath) {
  if (!filePath || typeof filePath !== 'string') return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~' + path.sep)) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function createSecretsPathFunctions(getConfig, saveConfig) {
  async function getSecretsPath() {
    const cfg = await getConfig();
    const raw = cfg['aifabrix-secrets'] || cfg['secrets-path'] || null;
    return raw ? expandTilde(raw) : null;
  }

  async function setSecretsPath(secretsPath) {
    if (typeof secretsPath !== 'string') {
      throw new Error('Secrets path is required and must be a string');
    }
    const cfg = await getConfig();
    cfg['aifabrix-secrets'] = secretsPath.trim() || undefined;
    await saveConfig(cfg);
  }

  return { getSecretsPath, setSecretsPath };
}

module.exports = { createSecretsPathFunctions };

