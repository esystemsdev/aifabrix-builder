/**
 * AI Fabrix Builder – Secrets validate command
 *
 * Validates a secrets file (structure and optional naming convention).
 *
 * @fileoverview Secrets validate command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const path = require('path');
const logger = require('../utils/logger');
const { validateSecretsFile } = require('../utils/secrets-validation');
const pathsUtil = require('../utils/paths');
const secretsEnsure = require('../core/secrets-ensure');

/**
 * Handle secret validate command action.
 * Validates secrets file at given path or at resolved write target from config.
 *
 * @async
 * @function handleSecretsValidate
 * @param {string} [pathArg] - Optional path to secrets file
 * @param {Object} options - Command options
 * @param {boolean} [options.naming] - Check key names against *KeyVault convention
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
async function handleSecretsValidate(pathArg, options = {}) {
  let filePath = pathArg;
  if (!filePath) {
    const target = await secretsEnsure.resolveWriteTarget();
    if (target.type === 'file' && target.filePath) {
      filePath = target.filePath;
    } else {
      filePath = path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');
    }
  }

  const result = validateSecretsFile(filePath, { checkNaming: Boolean(options.naming) });
  if (result.valid) {
    logger.log(chalk.green(`✓ Secrets file is valid: ${result.path}`));
    return { valid: true, errors: [] };
  }
  logger.log(chalk.red(`✗ Validation failed: ${result.path}`));
  result.errors.forEach((err) => logger.log(chalk.yellow(`  • ${err}`)));
  return { valid: false, errors: result.errors };
}

module.exports = { handleSecretsValidate };
