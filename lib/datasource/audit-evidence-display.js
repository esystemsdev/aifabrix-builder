/**
 * @fileoverview TTY and JSON output for audit evidence verification (407.3)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const {
  sectionTitle,
  formatSuccessLine,
  formatBlockingError,
  successGlyph,
  failureGlyph
} = require('../utils/cli-test-layout-chalk');

const SEP = '────────────────────────────────';

/**
 * @param {'passed'|'failed'} status
 * @returns {string}
 */
function rowGlyph(status) {
  return status === 'passed' ? successGlyph() : failureGlyph();
}

/**
 * @param {import('../api/types/audit.types').AuditEvidenceVerification} result
 * @param {boolean} [verbose]
 */
function displayAuditEvidenceMatrixTTY(result, verbose = false) {
  logger.log(SEP);
  logger.log(sectionTitle('Audit evidence matrix'));
  logger.log(chalk.gray(`  Datasource: ${result.datasourceKey}`));
  if (result.correlationId) {
    logger.log(chalk.gray(`  Correlation: ${result.correlationId}`));
  }
  if (verbose && result.executionIds.length) {
    logger.log(chalk.gray(`  Execution ids: ${result.executionIds.length}`));
  }
  logger.log('');
  for (const row of result.matrix || []) {
    logger.log(`  ${rowGlyph(row.status)} Row ${row.row}: ${row.detail}`);
    if (verbose && row.code) {
      logger.log(chalk.gray(`      code: ${row.code}`));
    }
  }
  logger.log('');
  if (result.status === 'passed') {
    logger.log(formatSuccessLine('Audit evidence verification passed'));
  } else {
    const failed = (result.matrix || []).filter(r => r.status === 'failed').length;
    logger.log(formatBlockingError(`Audit evidence verification failed (${failed} row(s))`));
  }
  logger.log(SEP);
}

/**
 * @param {import('../api/types/audit.types').AuditEvidenceVerification} result
 */
function printAuditEvidenceVerificationJson(result) {
  logger.log(
    JSON.stringify({
      auditEvidenceVerification: {
        status: result.status,
        datasourceKey: result.datasourceKey,
        correlationId: result.correlationId,
        executionIds: result.executionIds,
        matrix: result.matrix
      }
    })
  );
}

module.exports = {
  displayAuditEvidenceMatrixTTY,
  printAuditEvidenceVerificationJson
};
