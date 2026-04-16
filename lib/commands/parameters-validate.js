const { formatBlockingError, formatSuccessLine } = require('../utils/cli-test-layout-chalk');
/**
 * @fileoverview CLI handler: parameters validate (kv:// vs infra.parameter.yaml)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const pathsUtil = require('../utils/paths');
const {
  getInfraParameterCatalog,
  loadInfraParameterCatalog
} = require('../parameters/infra-parameter-catalog');
const {
  validateWorkspaceKvRefsAgainstCatalog,
  validateCatalogRequiredGenerators
} = require('../parameters/infra-parameter-validate');

/**
 * Run catalog + workspace kv:// validation.
 * @param {Object} [options] - CLI options
 * @returns {Promise<{ valid: boolean }>}
 */
async function handleParametersValidate(options = {}) {
  let catalog;
  try {
    catalog = options.catalogPath
      ? loadInfraParameterCatalog(options.catalogPath)
      : getInfraParameterCatalog();
  } catch (e) {
    logger.log(formatBlockingError(`Could not load infra parameter catalog: ${e.message}`));
    return { valid: false };
  }

  const reqGen = validateCatalogRequiredGenerators(catalog.data);
  if (!reqGen.valid) {
    logger.log(formatBlockingError('Catalog requiredForLocal / generator issues:'));
    reqGen.errors.forEach((err) => logger.log(chalk.yellow(`  • ${err}`)));
    return { valid: false };
  }

  const kv = validateWorkspaceKvRefsAgainstCatalog(catalog, pathsUtil);
  if (!kv.valid) {
    logger.log(formatBlockingError('env.template kv:// keys not covered by infra.parameter.yaml:'));
    kv.errors.forEach((err) => logger.log(chalk.yellow(`  • ${err}`)));
    return { valid: false };
  }

  logger.log(formatSuccessLine('parameters validate: catalog OK; workspace kv:// keys covered.'));
  return { valid: true };
}

module.exports = { handleParametersValidate };
