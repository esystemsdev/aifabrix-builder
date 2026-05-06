const {
  formatBlockingError,
  formatIssue,
  formatSuccessLine,
  sectionTitle
} = require('../utils/cli-test-layout-chalk');
/**
 * @fileoverview CLI handler: parameters validate (kv:// vs infra.parameter.yaml)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

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

function _loadCatalog(catalogPath) {
  try {
    const catalog = catalogPath
      ? loadInfraParameterCatalog(catalogPath)
      : getInfraParameterCatalog();
    return { catalog, catalogPath: catalogPath || 'lib/schema/infra.parameter.yaml' };
  } catch (e) {
    logger.log(formatBlockingError(`Could not load infra parameter catalog: ${e.message}`));
    return null;
  }
}

function _printScanSummary(kv) {
  logger.log(sectionTitle('Scan summary:'));
  logger.log(
    `  Apps scanned: ${kv.summary.scannedApps.length} (builder/* only; integration/* is skipped)`
  );
  logger.log(`  env.template files: ${kv.summary.scannedEnvTemplates.length}`);
  logger.log(`  kv:// keys (unique): ${kv.summary.kvKeysCount}`);
}

function _printCatalogHint(catalogPath) {
  logger.log(
    formatIssue(
      `Catalog: ${catalogPath}`,
      'Use --catalog to validate against a different infra.parameter.yaml.'
    )
  );
}

function _printKvErrors(kv) {
  logger.log(sectionTitle('Missing catalog entries:'));
  kv.errors.forEach((err) => {
    if (err.key === '__read_error__') {
      logger.log(
        formatIssue(
          `Could not read ${err.envTemplatePath}`,
          err.message || 'Check file permissions and retry.'
        )
      );
      return;
    }
    logger.log(
      formatIssue(
        `Unknown kv:// key "${err.key}" in ${err.envTemplatePath}`,
        'Add a matching entry (or keyPattern) in lib/schema/infra.parameter.yaml.'
      )
    );
  });
}

function _printSuccess(kv, catalogPath, verbose) {
  logger.log(formatSuccessLine('parameters validate: catalog OK; workspace kv:// keys covered.'));
  logger.log(`  Catalog: ${catalogPath}`);
  _printScanSummary(kv);
  if (verbose) {
    logger.log(sectionTitle('Files scanned:'));
    kv.summary.scannedEnvTemplates.forEach((p) => logger.log(`  - ${p}`));
  }
}

/**
 * Run catalog + workspace kv:// validation.
 * @param {Object} [options] - CLI options
 * @returns {Promise<{ valid: boolean }>}
 */
async function handleParametersValidate(options = {}) {
  const loaded = _loadCatalog(options.catalogPath);
  if (!loaded) {
    return { valid: false };
  }
  const { catalog, catalogPath } = loaded;

  const reqGen = validateCatalogRequiredGenerators(catalog.data);
  if (!reqGen.valid) {
    logger.log(formatBlockingError('Catalog requiredForLocal / generator issues:'));
    reqGen.errors.forEach((err) =>
      logger.log(formatIssue(err, 'Fix infra.parameter.yaml generator for requiredForLocal entry.'))
    );
    return { valid: false };
  }

  const kv = validateWorkspaceKvRefsAgainstCatalog(catalog, pathsUtil);
  if (!kv.valid) {
    logger.log(formatBlockingError('Missing infra.parameter.yaml coverage for kv:// keys.'));
    _printCatalogHint(catalogPath);
    _printScanSummary(kv);
    _printKvErrors(kv);
    return { valid: false };
  }

  _printSuccess(kv, catalogPath, Boolean(options.verbose));
  return { valid: true };
}

module.exports = { handleParametersValidate };
