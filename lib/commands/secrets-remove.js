/**
 * @fileoverview aifabrix secret remove – remove a secret (user file, shared file, or remote API)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getAifabrixSecretsPath } = require('../core/config');
const pathsUtil = require('../utils/paths');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../utils/remote-dev-auth');
const devApi = require('../api/dev.api');

/**
 * Remove a key from a YAML secrets file.
 * @param {string} key - Secret key
 * @param {string} filePath - Absolute path to secrets file
 * @throws {Error} If file cannot be read or written
 */
function removeKeyFromFile(key, filePath) {
  let data = {};
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    data = yaml.load(content) || {};
    if (typeof data !== 'object' || Array.isArray(data)) {
      data = {};
    }
  }
  if (!Object.prototype.hasOwnProperty.call(data, key)) {
    throw new Error(`Secret '${key}' not found.`);
  }
  delete data[key];
  const yamlContent = yaml.dump(data, { indent: 2, lineWidth: 120, noRefs: true, sortKeys: false });
  fs.writeFileSync(filePath, yamlContent, { mode: 0o600 });
}

/**
 * Remove secret from shared store (remote API or file).
 * @param {string} key - Secret key
 * @param {string} generalSecretsPath - Path or URL for shared secrets
 * @returns {Promise<void>}
 */
async function removeSharedSecret(key, generalSecretsPath) {
  if (isRemoteSecretsUrl(generalSecretsPath)) {
    const auth = await getRemoteDevAuth();
    if (!auth) {
      throw new Error('Remote server not configured or certificate missing. Run "aifabrix dev init" first.');
    }
    try {
      await devApi.deleteSecret(auth.serverUrl, auth.clientCertPem, key);
    } catch (err) {
      if (err.status === 404) {
        throw new Error(`Secret '${key}' not found.`);
      }
      throw err;
    }
    logger.log(chalk.green(`✓ Secret '${key}' removed from remote shared secrets.`));
    return;
  }
  const resolvedPath = path.isAbsolute(generalSecretsPath)
    ? generalSecretsPath
    : path.resolve(process.cwd(), generalSecretsPath);
  removeKeyFromFile(key, resolvedPath);
  logger.log(chalk.green(`✓ Secret '${key}' removed from shared secrets file.`));
}

/**
 * Handle secret remove command.
 * @param {string} key - Secret key to remove
 * @param {Object} options - Command options
 * @param {boolean} [options.shared] - If true, remove from shared secrets (file or remote API)
 * @returns {Promise<void>}
 */
async function handleSecretsRemove(key, options) {
  if (!key || typeof key !== 'string') {
    throw new Error('Secret key is required.');
  }

  const isShared = options.shared || options['shared'] || false;

  if (isShared) {
    const generalSecretsPath = await getAifabrixSecretsPath();
    if (!generalSecretsPath) {
      throw new Error('Shared secrets not configured. Set aifabrix-secrets in config.yaml.');
    }
    await removeSharedSecret(key, generalSecretsPath);
  } else {
    const userSecretsPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');
    removeKeyFromFile(key, userSecretsPath);
    logger.log(chalk.green(`✓ Secret '${key}' removed from user secrets.`));
  }
}

module.exports = { handleSecretsRemove };
