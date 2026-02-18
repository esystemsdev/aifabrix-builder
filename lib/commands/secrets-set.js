/**
 * AI Fabrix Builder - Secrets Set Command
 *
 * Handles setting secret values in secrets files
 * Supports both user secrets and general secrets files
 *
 * @fileoverview Secrets set command implementation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getAifabrixSecretsPath } = require('../core/config');
const { saveLocalSecret, saveSecret } = require('../utils/local-secrets');
const pathsUtil = require('../utils/paths');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../utils/remote-dev-auth');
const devApi = require('../api/dev.api');

/**
 * Handle secret set command action
 * Sets a secret value in either user secrets, general secrets file, or remote API (when aifabrix-secrets is http(s) URL).
 *
 * @async
 * @function handleSecretsSet
 * @param {string} key - Secret key name
 * @param {string} value - Secret value (supports full URLs or environment variable interpolation)
 * @param {Object} options - Command options
 * @param {boolean} [options.shared] - If true, save to general secrets file or remote API
 * @returns {Promise<void>} Resolves when secret is saved
 * @throws {Error} If save fails or validation fails
 */
/**
 * Save secret to shared store (remote API or file).
 * @param {string} key - Secret key
 * @param {string} value - Secret value
 * @param {string} generalSecretsPath - Path or URL for shared secrets
 * @returns {Promise<void>}
 */
async function setSharedSecret(key, value, generalSecretsPath) {
  if (isRemoteSecretsUrl(generalSecretsPath)) {
    const auth = await getRemoteDevAuth();
    if (!auth) {
      throw new Error('Remote server not configured or certificate missing. Run "aifabrix dev init" first.');
    }
    await devApi.addSecret(auth.serverUrl, auth.clientCertPem, { key, value });
    logger.log(chalk.green(`✓ Secret '${key}' saved to remote secrets (shared).`));
    return;
  }
  const resolvedPath = path.isAbsolute(generalSecretsPath)
    ? generalSecretsPath
    : path.resolve(process.cwd(), generalSecretsPath);
  await saveSecret(key, value, resolvedPath);
  logger.log(chalk.green(`✓ Secret '${key}' saved to general secrets file: ${resolvedPath}`));
}

async function handleSecretsSet(key, value, options) {
  if (!key || typeof key !== 'string') {
    throw new Error('Secret key is required and must be a string');
  }

  if (value === undefined || value === null || value === '') {
    throw new Error('Secret value is required');
  }

  const isShared = options.shared || options['shared'] || false;

  if (isShared) {
    const generalSecretsPath = await getAifabrixSecretsPath();
    if (!generalSecretsPath) {
      throw new Error('General secrets file not configured. Set aifabrix-secrets in config.yaml or use without --shared flag for user secrets.');
    }
    await setSharedSecret(key, value, generalSecretsPath);
  } else {
    await saveLocalSecret(key, value);
    const userSecretsPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');
    logger.log(chalk.green(`✓ Secret '${key}' saved to user secrets file: ${userSecretsPath}`));
  }
}

module.exports = { handleSecretsSet };

