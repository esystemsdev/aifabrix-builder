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
const os = require('os');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getAifabrixSecretsPath } = require('../config');
const { saveLocalSecret, saveSecret } = require('../utils/local-secrets');

/**
 * Handle secrets set command action
 * Sets a secret value in either user secrets or general secrets file
 *
 * @async
 * @function handleSecretsSet
 * @param {string} key - Secret key name
 * @param {string} value - Secret value (supports full URLs or environment variable interpolation)
 * @param {Object} options - Command options
 * @param {boolean} [options.shared] - If true, save to general secrets file
 * @returns {Promise<void>} Resolves when secret is saved
 * @throws {Error} If save fails or validation fails
 *
 * @example
 * await handleSecretsSet('keycloak-public-server-urlKeyVault', 'https://mydomain.com/keycloak', { shared: false });
 * await handleSecretsSet('keycloak-public-server-urlKeyVault', 'https://${VAR}:8182', { shared: true });
 */
async function handleSecretsSet(key, value, options) {
  if (!key || typeof key !== 'string') {
    throw new Error('Secret key is required and must be a string');
  }

  if (value === undefined || value === null || value === '') {
    throw new Error('Secret value is required');
  }

  const isShared = options.shared || options['shared'] || false;

  if (isShared) {
    // Save to general secrets file
    const generalSecretsPath = await getAifabrixSecretsPath();
    if (!generalSecretsPath) {
      throw new Error('General secrets file not configured. Set aifabrix-secrets in config.yaml or use without --shared flag for user secrets.');
    }

    // Resolve path (handle absolute vs relative)
    const resolvedPath = path.isAbsolute(generalSecretsPath)
      ? generalSecretsPath
      : path.resolve(process.cwd(), generalSecretsPath);

    await saveSecret(key, value, resolvedPath);
    logger.log(chalk.green(`✓ Secret '${key}' saved to general secrets file: ${resolvedPath}`));
  } else {
    // Save to user secrets file
    await saveLocalSecret(key, value);
    const userSecretsPath = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');
    logger.log(chalk.green(`✓ Secret '${key}' saved to user secrets file: ${userSecretsPath}`));
  }
}

module.exports = { handleSecretsSet };

