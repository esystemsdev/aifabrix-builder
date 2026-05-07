/**
 * `datasource capability dimension` command registration.
 *
 * @fileoverview dimension binding CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const logger = require('../utils/logger');
const {
  formatBlockingError,
  headerKeyValue,
  infoLine,
  formatSuccessLine,
  colorRollupPrefixedLine
} = require('../utils/cli-test-layout-chalk');
const { runCapabilityDimension } = require('../datasource/capability/run-capability-dimension');
const { printCapabilitySuccessFooter } = require('./datasource-capability-output');

const CAP_DIMENSION_HELP = `
Adds or replaces one root **dimensions.<key>** binding (metadata-only; no pipeline).

Examples:
  $ aifabrix datasource capability dimension test-e2e-hubspot-companies --dimension market --type local --field country
  $ aifabrix datasource capability dimension test-e2e-hubspot-companies --dimension owner --type fk --via hubspotOwner:owner --actor email
`;

function parseVia(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((x) => String(x).trim()).filter(Boolean);
}

function logDimensionValidationOutcome(result) {
  logger.log(formatSuccessLine('Local validation passed'));
  if (result.remoteValidation?.ok) {
    logger.log(formatSuccessLine('Remote validation passed'));
  } else {
    logger.log(colorRollupPrefixedLine('⚠ Remote validation skipped (not authenticated)'));
  }
  if (Array.isArray(result.semanticWarnings) && result.semanticWarnings.length > 0) {
    result.semanticWarnings.forEach((w) => logger.log(colorRollupPrefixedLine(`⚠ ${w}`)));
  }
  logger.log(formatSuccessLine('Dimension binding updated'));
}

/**
 * @param {string} fileOrKey
 * @param {object} options - Commander options
 * @returns {Promise<void>}
 */
async function runDimensionAction(fileOrKey, options) {
  const via = parseVia(options.via);

  const result = await runCapabilityDimension({
    fileOrKey,
    dimension: options.dimension,
    type: options.type,
    field: options.field,
    via,
    actor: options.actor,
    operator: options.operator,
    required: options.required,
    dryRun: Boolean(options.dryRun),
    noBackup: Boolean(options.noBackup),
    overwrite: Boolean(options.overwrite)
  });

  if (result.dryRun) {
    logger.log(infoLine('Dry run — planned JSON Patch operations:'));
    logger.log('');
    logger.log(JSON.stringify(result.patchOperations, null, 2));
    return;
  }

  logDimensionValidationOutcome(result);

  if (result.backupPath) {
    logger.log(headerKeyValue('Backup:', result.backupPath));
  }
  printCapabilitySuccessFooter(result.resolvedPath, result.updatedSections, 'Updated');
}

/**
 * @param {import('commander').Command} cap
 * @returns {void}
 */
function setupCapabilityDimensionCommand(cap) {
  cap
    .command('dimension <file-or-key>')
    .description('Add or replace one root dimensions binding (local or FK-backed)')
    .requiredOption('--dimension <key>', 'Dimension key (ABAC-facing key; underscores allowed)')
    .requiredOption('--type <type>', 'local | fk')
    .option('--field <name>', 'For type=local: normalized attribute name in metadataSchema.properties')
    .option(
      '--via <fk:dimension>',
      'For type=fk: hop as <fkName>:<dimensionKey>; repeat for multi-hop traversal',
      (value, prev) => {
        const list = prev || [];
        list.push(value);
        return list;
      },
      []
    )
    .option('--actor <actor>', 'For type=fk: displayName | email | userId | groups | roles')
    .option('--operator <op>', 'For type=fk: eq | in (default depends on actor)')
    .option('--required', 'Set dimensions.<key>.required=true')
    .option('--no-required', 'Set dimensions.<key>.required=false')
    .option('--dry-run', 'Print JSON Patch operations; do not write')
    .option('--overwrite', 'Replace existing dimensions.<key> binding')
    .option('--no-backup', 'Skip backup copy under integration/<app>/backup/')
    .addHelpText('after', CAP_DIMENSION_HELP)
    .action(async(fileOrKey, options) => {
      try {
        await runDimensionAction(fileOrKey, options);
      } catch (error) {
        logger.error(formatBlockingError(`capability dimension failed: ${error.message}`));
        process.exit(1);
      }
    });
}

module.exports = {
  setupCapabilityDimensionCommand,
  runDimensionAction
};

