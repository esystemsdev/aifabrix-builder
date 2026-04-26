/**
 * @fileoverview TTY output for `aifabrix datasource validate` (cli-test-layout-chalk).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const {
  sectionTitle,
  headerKeyValue,
  metadata,
  formatSuccessLine,
  formatBlockingError,
  successGlyph,
  failureGlyph
} = require('../utils/cli-test-layout-chalk');

function logSubOk(whitePart, grayPart) {
  if (grayPart) {
    logger.log(`  ${successGlyph()} ${chalk.white(whitePart)} ${metadata(grayPart)}`);
  } else {
    logger.log(`  ${successGlyph()} ${chalk.white(whitePart)}`);
  }
}

function logHeaderAndIdentity(result, trimmed, showMapping) {
  const { resolvedPath, summary } = result;
  logger.log('');
  logger.log(sectionTitle('Datasource validation'));
  logger.log(metadata('Offline — JSON schema and integration wiring'));
  logger.log('');
  if (summary) {
    logger.log(`  ${headerKeyValue('Key:', summary.key)}`);
    logger.log(`  ${headerKeyValue('Resource type:', summary.resourceType)}`);
    logger.log(`  ${headerKeyValue('Entity type:', summary.entityType)}`);
    logger.log(`  ${headerKeyValue('File:', resolvedPath)}`);
    if (showMapping && trimmed && String(trimmed) !== String(summary.key)) {
      logger.log(`  ${headerKeyValue('CLI input:', trimmed)}`);
    }
    logger.log('');
  } else {
    logger.log(`  ${headerKeyValue('File:', resolvedPath)}`);
    logger.log('');
  }
}

function logInvalidBody(errors, warnings) {
  logger.log(`  ${formatBlockingError('Datasource file has errors')}`);
  (errors || []).forEach(err => {
    logger.log(`    ${failureGlyph()} ${chalk.red(err)}`);
  });
  if (warnings && warnings.length > 0) {
    logger.log('');
    logger.log(sectionTitle('Warnings'));
    warnings.forEach(w => {
      logger.log(`  ${chalk.yellow('⚠')} ${chalk.white(w)}`);
    });
  }
}

function logValidMappingsAndRelations(summary) {
  const mc = summary.metadataSchemaPropertyCount;
  const mcLabel = `${mc} propert${mc === 1 ? 'y' : 'ies'}`;
  logSubOk('Metadata schema', mcLabel);
  logSubOk('Field mappings', `${summary.fieldMappingAttributeCount} attribute(s)`);
  logger.log('');
  logSubOk(`Primary key: ${summary.primaryKey}`);
  logSubOk(`Label key: ${summary.labelKey}`);
  logger.log('');
  if (summary.foreignKeys.length > 0) {
    logSubOk('Foreign keys', `${summary.foreignKeys.length} reference(s)`);
    summary.foreignKeys.forEach(fk => {
      logger.log(metadata(`    • ${fk.name} → ${fk.target} (${fk.fields})`));
    });
  } else {
    logSubOk('Foreign keys', 'none');
  }
  logger.log('');
  if (summary.dimensionKeys.length > 0) {
    logSubOk('Dimensions (ABAC)', '');
    summary.dimensionKeys.forEach(k => {
      logger.log(metadata(`    ${k} → ${summary.dimensions[k]}`));
    });
  } else {
    logSubOk('Dimensions (ABAC)', 'none configured');
  }
  logger.log('');
}

function logOpenapiSection(summary) {
  if (summary.hasOpenapi) {
    logSubOk('OpenAPI', summary.openapiLine);
    if (summary.capabilityKeys.length > 0) {
      const preview = summary.capabilityKeys.slice(0, 12).join(', ');
      const more = summary.capabilityKeys.length > 12 ? ', …' : '';
      logger.log(metadata(`    Operations: ${preview}${more}`));
    }
    return;
  }
  logSubOk('OpenAPI', 'not configured');
}

function logValidInterfaceAndFooter(summary) {
  if (summary.exposedProfileNames.length > 0) {
    logSubOk('Exposed profiles', summary.exposedProfileNames.join(', '));
  } else {
    logSubOk('Exposed profiles', 'none');
  }
  logger.log('');
  logOpenapiSection(summary);
  logger.log('');
  logSubOk('Test payload', summary.testPayloadLine);
  logger.log('');
  logSubOk('Synchronization', summary.syncLine);
  logger.log('');
  const caps = summary.capabilityKeys;
  const capHint =
    caps.length > 0 ? `${caps.slice(0, 8).join(', ')}${caps.length > 8 ? ', …' : ''}` : 'none (no OpenAPI operations)';
  logSubOk('Capabilities', capHint);
  logger.log('');
  logger.log(`  ${formatSuccessLine('Datasource file is valid.')}`);
}

function logWarningsOnly(warnings) {
  if (!warnings || warnings.length === 0) {
    return;
  }
  logger.log('');
  logger.log(sectionTitle('Warnings'));
  warnings.forEach(w => {
    logger.log(`  ${chalk.yellow('⚠')} ${chalk.white(w)}`);
  });
}

/**
 * @param {object} result - validateDatasourceFile result (includes optional summary)
 * @param {string} trimmed - CLI argument
 * @param {boolean} showMapping - true when key resolved to a different path than arg
 */
function logDatasourceValidateOutcome(result, trimmed, showMapping) {
  logHeaderAndIdentity(result, trimmed, showMapping);
  const { valid, errors, warnings, summary } = result;
  if (!valid) {
    logInvalidBody(errors, warnings);
    return;
  }
  if (!summary) {
    logger.log(`  ${formatSuccessLine('Datasource file is valid.')}`);
    logWarningsOnly(warnings);
    return;
  }
  logValidMappingsAndRelations(summary);
  logValidInterfaceAndFooter(summary);
  logWarningsOnly(warnings);
}

module.exports = {
  logDatasourceValidateOutcome
};
