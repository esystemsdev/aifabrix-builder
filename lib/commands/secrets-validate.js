const { formatBlockingError, formatSuccessLine } = require('../utils/cli-test-layout-chalk');
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
const logger = require('../utils/logger');
const { validateSecretsFile } = require('../utils/secrets-validation');
const { validateDataplaneSecrets } = require('../utils/token-manager');
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
      filePath = pathsUtil.getPrimaryUserSecretsLocalPath();
    }
  }

  const result = validateSecretsFile(filePath, { checkNaming: Boolean(options.naming) });
  const dataplaneResult = validateDataplaneSecrets(filePath);
  const allValid = result.valid && dataplaneResult.valid;
  if (result.valid) {
    logger.log(formatSuccessLine(`Secrets file is valid: ${result.path}`));
  } else {
    logger.log(formatBlockingError(`Validation failed: ${result.path}`));
    result.errors.forEach((err) => logger.log(chalk.yellow(`  • ${err}`)));
  }
  if (!dataplaneResult.valid) {
    logger.log(chalk.yellow(`⚠ ${dataplaneResult.hint}`));
    if (result.valid) {
      logger.log(chalk.yellow('  Wizard/dataplane calls may fail until dataplane credentials are present.'));
    }
  }
  return {
    valid: allValid,
    errors: allValid ? [] : [...result.errors, ...(dataplaneResult.valid ? [] : [dataplaneResult.hint])],
    dataplaneValid: dataplaneResult.valid
  };
}

module.exports = { handleSecretsValidate };
