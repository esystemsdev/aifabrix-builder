/**
 * @fileoverview Dataplane validation path for protection validate command.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const { validateProtectionManifestLocal } = require('./validate-local');
const { resolveProtectionDataplaneContext } = require('./auth-context');
const { validateProtection, simulateProtection } = require('../api/protection.api');
const { exitCodeFromProtectionReport } = require('./report-exit');
const {
  printProtectionValidateReport,
  formatProgress,
  formatSuccessLine,
  formatBlockingError,
  metadata,
  headerKeyValue,
  sectionTitle,
  SEP
} = require('./protection-display');

/**
 * @param {Object} logger
 * @param {Object} resolved
 * @param {Object} ctx
 */
function printProtectionTargetHeader(logger, resolved, ctx) {
  logger.log(sectionTitle('Target'));
  logger.log(SEP);
  logger.log(headerKeyValue('Environment:', ctx.environment));
  logger.log(headerKeyValue('Dataplane:', ctx.dataplaneUrl));
  logger.log('');
  logger.log(metadata(`Protection: work — ${resolved.manifestPath}`));
  logger.log(headerKeyValue('Datasource:', resolved.datasourceKey));
  logger.log('');
}

/**
 * @param {Object} manifest
 * @param {Object} opts
 * @param {Object} logger
 * @returns {number}
 */
function runLocalSchemaGate(manifest, opts, logger) {
  const local = validateProtectionManifestLocal(manifest);
  if (!local.valid) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ valid: false, errors: local.errors }, null, 2));
      return 1;
    }
    logger.error(formatBlockingError('Local schema check failed:'));
    local.errors.forEach((e) => logger.error(chalk.gray(`  ${e}`)));
    return 1;
  }
  if (opts.json) {
    logger.log(formatProgress('Local schema valid'));
  } else {
    logger.log(formatProgress('Local schema check...'));
    logger.log(formatSuccessLine('Local schema valid'));
  }
  return 0;
}

/**
 * @param {Object} ctx
 * @param {Object} manifest
 * @param {Object} opts
 * @param {Object} logger
 * @param {string} datasourceKey
 * @param {string} manifestPath
 * @returns {Promise<number>}
 */
async function runDataplaneProtectionValidate(ctx, manifest, opts, logger, datasourceKey, manifestPath) {
  printProtectionTargetHeader(logger, { datasourceKey, manifestPath }, ctx);
  logger.log(formatProgress('Dataplane validation...'));
  const report = await validateProtection(ctx.dataplaneUrl, ctx.authConfig, manifest, {
    strict: opts.warningsAsErrors === true
  });
  let simulationBlock = null;
  if (opts.simulate && exitCodeFromProtectionReport(report, opts) === 0) {
    const sim = await simulateProtection(ctx.dataplaneUrl, ctx.authConfig, manifest, {
      strict: opts.warningsAsErrors === true
    });
    const meta = sim?.metadata || {};
    simulationBlock = {
      recordsSampled: meta.recordsSampled,
      grantsProjected: meta.grantsProjected,
      unresolvedPrincipals: meta.unresolvedPrincipals
    };
  }
  printProtectionValidateReport(report, {
    json: opts.json,
    verbose: opts.verbose,
    warningsAsErrors: opts.warningsAsErrors,
    simulationBlock,
    logger
  });
  return exitCodeFromProtectionReport(report, opts);
}

/**
 * @param {string} datasourceKey
 * @param {Object} manifest
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<number>}
 */
async function runProtectionValidate(datasourceKey, manifest, opts, logger) {
  const localCode = runLocalSchemaGate(manifest, opts, logger);
  if (localCode !== 0) {
    return localCode;
  }
  const ctx = await resolveProtectionDataplaneContext(opts);
  return runDataplaneProtectionValidate(
    ctx,
    manifest,
    opts,
    logger,
    datasourceKey,
    opts.manifestPath
  );
}

module.exports = {
  printProtectionTargetHeader,
  runProtectionValidate
};
