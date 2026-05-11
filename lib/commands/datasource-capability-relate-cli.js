/**
 * `datasource capability relate` command registration.
 *
 * @fileoverview relate CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const logger = require('../utils/logger');
const {
  formatBlockingError,
  headerKeyValue,
  infoLine,
  formatSuccessLine,
  colorRollupPrefixedLine
} = require('../utils/cli-test-layout-chalk');
const { runCapabilityRelate } = require('../datasource/capability/run-capability-relate');
const { printCapabilitySuccessFooter } = require('./datasource-capability-output');

const CAP_RELATE_HELP = `
Adds or replaces one **foreignKeys[]** row (metadata-only; no pipeline). Optional **metadataSchema.properties** stub unless **--skip-metadata-property**.

  $ aifabrix datasource capability relate hubspot-deals --relation-name company --to hubspot-companies --field companyId --target-field externalId
`;

function parseTargetFields(raw) {
  const tf = raw;
  if (Array.isArray(tf) && tf.length > 0) {
    return tf.map((x) => String(x).trim()).filter(Boolean);
  }
  if (tf !== undefined && tf !== null && String(tf).trim()) {
    return [String(tf).trim()];
  }
  return undefined;
}

function logRelateValidationOutcome(result, joinLeft, joinRight) {
  logger.log(formatSuccessLine('Local validation passed'));
  if (result.remoteValidation?.ok) {
    logger.log(formatSuccessLine('Remote validation passed'));
  } else {
    logger.log(colorRollupPrefixedLine('⚠ Remote validation skipped (not authenticated)'));
  }
  if (Array.isArray(result.semanticWarnings) && result.semanticWarnings.length > 0) {
    result.semanticWarnings.forEach((w) => logger.log(colorRollupPrefixedLine(`⚠ ${w}`)));
  }
  logger.log(formatSuccessLine(`Relation created: ${joinLeft} → ${joinRight}`));
}

/**
 * @param {string} fileOrKey
 * @param {object} options - Commander options
 * @returns {Promise<void>}
 */
async function runRelateAction(fileOrKey, options) {
  const fields = [];
  if (options.field) {
    fields.push(String(options.field).trim());
  }
  const targetFields = parseTargetFields(options.targetField);

  const result = await runCapabilityRelate({
    fileOrKey,
    relationName: options.relationName,
    targetDatasource: options.to,
    fields,
    targetFields,
    required: options.required,
    description: options.description,
    dryRun: Boolean(options.dryRun),
    noBackup: Boolean(options.noBackup),
    overwrite: Boolean(options.overwrite),
    addMetadataProperty: !options.skipMetadataProperty
  });

  if (result.dryRun) {
    logger.log(infoLine('Dry run — planned JSON Patch operations:'));
    logger.log('');
    logger.log(JSON.stringify(result.patchOperations, null, 2));
    return;
  }

  const joinLeft = fields.length === 1 ? fields[0] : 'fields';
  const joinRight =
    Array.isArray(targetFields) && targetFields.length === 1
      ? `${options.to}.${targetFields[0]}`
      : options.to;
  logRelateValidationOutcome(result, joinLeft, joinRight);

  if (result.backupPath) {
    logger.log(headerKeyValue('Backup:', result.backupPath));
  }
  printCapabilitySuccessFooter(result.resolvedPath, result.updatedSections, 'Updated');
}

/**
 * @param {import('commander').Command} cap
 * @returns {void}
 */
function setupCapabilityRelateCommand(cap) {
  cap
    .command('relate <file-or-key>')
    .description(
      'Add or replace foreignKeys[] metadata (+ optional metadataSchema property for relation name)'
    )
    .requiredOption('--relation-name <name>', 'FK name (camelCase; unique per datasource)')
    .requiredOption('--to <targetDatasource>', 'Target datasource key (cross-system JSON key)')
    .requiredOption('--field <name>', 'Local normalized attribute (foreignKeys.fields[])')
    .option('--description <text>', 'FK description (defaults to a generated description)')
    .option('--required', 'Mark FK required (foreignKeys[].required=true)')
    .option('--no-required', 'Mark FK optional (foreignKeys[].required=false)')
    .option(
      '--target-field <name>',
      'Target join field(s); repeat flag for composite; omit to use runtime default (externalId)',
      (value, prev) => {
        const list = prev || [];
        list.push(value);
        return list;
      },
      []
    )
    .option('--dry-run', 'Print JSON Patch operations; do not write')
    .option('--overwrite', 'Replace existing foreignKeys row with the same name')
    .option('--skip-metadata-property', 'Do not add metadataSchema.properties.<relationName>')
    .option('--no-backup', 'Skip backup copy under integration/<app>/backup/')
    .addHelpText('after', CAP_RELATE_HELP)
    .action(async(fileOrKey, options) => {
      try {
        await runRelateAction(fileOrKey, options);
      } catch (error) {
        logger.error(formatBlockingError(`capability relate failed: ${error.message}`));
        process.exit(1);
      }
    });
}

module.exports = {
  setupCapabilityRelateCommand,
  runRelateAction
};
