/**
 * @fileoverview `aifabrix protection create` — online probes, scaffold, write YAML.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const { resolveProtectionDataplaneContext } = require('./auth-context');
const { validateProtectionManifestLocal } = require('./validate-local');
const { buildPresetProtectionManifest } = require('./protection-create-scaffold');
const { requireProtectionPreset } = require('./protection-preset-registry');
const {
  sectionTitle,
  formatSuccessLine,
  formatNextActions,
  formatBlockingError,
  metadata
} = require('../utils/cli-test-layout-chalk');
const {
  resolveControllerAuthForDimensions,
  protectionManifestToYaml,
  resolveOutputPathOrThrow,
  writeProtectionYaml
} = require('./run-protection-create-helpers');
const { collectProtectionCreateProbeContext } = require('./run-protection-create-probes-flow');

const SEP = chalk.gray('────────────────────────────────────────');

/**
 * @param {Object} opts
 * @param {string} dsKey
 * @param {string} dimensionKey
 * @param {Object} logger
 */
function logCreateHeader(opts, dsKey, dimensionKey, logger) {
  logger.log(sectionTitle('Protection create'));
  logger.log(SEP);
  logger.log(metadata(`Environment: ${opts.environment}`));
  logger.log(metadata(`Datasource key: ${dsKey}`));
  logger.log(metadata(`Dimension key: ${dimensionKey}`));
  if (opts.type) {
    logger.log(metadata(`Type preset: ${opts.type}`));
  }
  logger.log('');
}

/**
 * @param {string} dsKey
 * @param {string} dimensionKey
 * @param {Object} opts
 * @param {Object} probeContext
 * @returns {Object}
 */
function buildManifestForCreate(dsKey, dimensionKey, opts, probeContext) {
  return buildPresetProtectionManifest({
    datasourceKey: dsKey,
    dimensionKey,
    type: opts.type,
    field: opts.field,
    fkName: opts.fkName,
    protectionKey: opts.protectionKey,
    displayName: opts.displayName,
    ruleKey: opts.ruleKey,
    principalExpression: opts.principalExpression,
    valueExpression: opts.valueExpression,
    enabled: opts.disabled !== true,
    datasource: probeContext.datasource,
    dimension: probeContext.dimension
  });
}

/**
 * @param {Object} manifest
 * @param {Object} logger
 */
function assertLocalSchemaOrThrow(manifest, logger) {
  const local = validateProtectionManifestLocal(manifest);
  if (!local.valid) {
    logger.error(formatBlockingError('Local schema validation failed after scaffold:'));
    local.errors.forEach((e) => logger.error(chalk.gray(`  ${e}`)));
    throw new Error('Scaffolded manifest failed AJV');
  }
}

/**
 * @param {Object} logger
 * @param {string[]} lines
 */
function logProbeLines(logger, lines) {
  for (const line of lines) {
    logger.log(line);
  }
}

/**
 * @param {Object} logger
 */
function logManifestSection(logger) {
  logger.log(sectionTitle('Protection manifest'));
  logger.log(SEP);
  logger.log(formatSuccessLine('Local schema check passed (AJV)'));
}

/**
 * @param {Object} args
 * @param {string} args.dsKey
 * @param {boolean} args.dryRun
 * @param {boolean} args.force
 * @param {string} args.yamlBody
 * @param {Object} args.logger
 * @returns {number}
 */
function finalizeProtectionCreateWrite({ dsKey, dryRun, force, yamlBody, logger }) {
  if (dryRun) {
    logger.log(metadata('Dry run: no file written'));
    process.stdout.write(yamlBody);
    return 0;
  }
  const outputPath = resolveOutputPathOrThrow(dsKey, force);
  writeProtectionYaml(outputPath, yamlBody);
  logger.log(formatSuccessLine(`Wrote ${outputPath}`));
  logger.log('');
  logger.log(
    formatNextActions([
      `aifabrix protection validate ${dsKey}`,
      `aifabrix protection upload ${dsKey}`
    ])
  );
  return 0;
}

/**
 * @param {string} datasourceKey
 * @param {Object} opts
 * @returns {{ dsKey: string, dimensionKey: string, preset: Object|null }}
 */
function resolveCreateKeys(datasourceKey, opts) {
  const dsKey = String(datasourceKey || '').trim();
  if (!dsKey) {
    throw new Error('Datasource key is required');
  }
  const preset = requireProtectionPreset(opts.type);
  const dimensionKey = String(opts.dimensionKey || preset?.dimensionKey || '').trim();
  if (!dimensionKey) {
    throw new Error('--dimension-key is required unless --type supplies a preset dimension');
  }
  return { dsKey, dimensionKey, preset };
}

/**
 * @param {string} datasourceKey
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<number>}
 */
async function runProtectionCreate(datasourceKey, opts, logger) {
  const { dsKey, dimensionKey, preset } = resolveCreateKeys(datasourceKey, opts);
  const dryRun = opts.dryRun === true;
  const force = opts.force === true;
  const verbose = opts.verbose === true;

  const dpCtx = await resolveProtectionDataplaneContext(opts);
  const dimCtx = await resolveControllerAuthForDimensions();

  logCreateHeader({ environment: dpCtx.environment, type: preset?.type }, dsKey, dimensionKey, logger);

  const probeContext = await collectProtectionCreateProbeContext(
    dpCtx,
    dimCtx,
    dsKey,
    dimensionKey,
    verbose
  );
  logProbeLines(logger, probeContext.lines);

  const manifest = buildManifestForCreate(dsKey, dimensionKey, opts, probeContext);
  assertLocalSchemaOrThrow(manifest, logger);
  const yamlBody = protectionManifestToYaml(manifest);

  logManifestSection(logger);

  return finalizeProtectionCreateWrite({ dsKey, dryRun, force, yamlBody, logger });
}

module.exports = {
  runProtectionCreate,
  resolveControllerAuthForDimensions: require('./run-protection-create-helpers').resolveControllerAuthForDimensions
};
