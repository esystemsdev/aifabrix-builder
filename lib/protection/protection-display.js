/**
 * @fileoverview TTY formatters for protection CLI (layout-blocks / tty-summary).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const {
  sectionTitle,
  headerKeyValue,
  metadata,
  formatBlockingError,
  formatSuccessLine,
  formatWarningLine,
  formatProgress,
  formatNextActions
} = require('../utils/cli-test-layout-chalk');
const { reportTaskRows } = require('./report-exit');
const {
  appendTaskRows,
  appendProtectionReportHeader,
  appendSimulationSection,
  appendValidationSummarySection,
  appendBatchResultRows,
  appendBatchSummary,
  appendProtectionShowHeader,
  appendProtectionShowCounts,
  appendProtectionShowVerboseGrants,
  appendProtectionListTable,
  formatStatusKeyValue
} = require('./protection-display-helpers');

const SEP = chalk.gray('────────────────────────────────────────');

/**
 * @param {Object} report
 * @param {Object} [opts]
 * @returns {string}
 */
function formatProtectionValidateTTY(report, opts = {}) {
  const lines = [];
  const meta = report?.metadata || {};
  appendProtectionReportHeader(lines, meta);
  const summary = report?.summary || {};
  const failCount = Number(summary.fail || 0);
  const warnCount = Number(summary.warn || 0);
  const aggregate = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'ok';
  const glyph = aggregate === 'fail' ? '✖' : aggregate === 'warn' ? '⚠' : '✔';
  lines.push(formatStatusKeyValue(aggregate, glyph));
  const rows = reportTaskRows(report);
  appendTaskRows(lines, rows, 'FAIL', opts);
  appendTaskRows(lines, rows, 'WARN', opts);
  if (opts.verbose) {
    appendTaskRows(lines, rows, 'PASS', opts);
  }
  if (opts.simulationBlock) {
    appendSimulationSection(lines, opts.simulationBlock);
  }
  appendValidationSummarySection(lines, failCount, warnCount, opts);
  return lines.join('\n');
}

/**
 * @param {Object} report
 * @param {Object} opts
 */
function printProtectionValidateReport(report, opts = {}) {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const text = formatProtectionValidateTTY(report, opts);
  if (text) {
    opts.logger.log(text);
  }
}

/**
 * @param {Object[]} results
 * @param {Object} [opts]
 * @returns {string}
 */
function formatProtectionBatchValidateTTY(results, opts = {}) {
  const lines = [sectionTitle('Protection validate (batch)'), SEP, 'Scope: .protection'];
  if (opts.folder) {
    lines.push(metadata(`Folder: work — ${opts.folder}`));
  }
  lines.push('');
  let passed = 0;
  let failed = 0;
  for (const row of results) {
    if (row.ok) passed += 1;
    else failed += 1;
  }
  appendBatchResultRows(lines, results, 'Validated');
  appendBatchSummary(lines, passed, failed, `All ${passed} manifest(s) validated`);
  return lines.join('\n');
}

/**
 * @param {Object[]} results
 * @param {Object} [opts]
 * @returns {string}
 */
function formatProtectionBatchUploadTTY(results, opts = {}) {
  const lines = [sectionTitle('Protection upload (batch)'), SEP, 'Scope: .protection'];
  if (opts.folder) {
    lines.push(metadata(`Folder: work — ${opts.folder}`));
  }
  lines.push('');
  let passed = 0;
  let failed = 0;
  for (const row of results) {
    if (row.ok) passed += 1;
    else failed += 1;
  }
  appendBatchResultRows(lines, results, 'Validated and uploaded');
  appendBatchSummary(lines, passed, failed, `All ${passed} manifest(s) uploaded`);
  return lines.join('\n');
}

/**
 * @returns {string}
 */
function formatDeployProtectionNotImplementedTTY() {
  return [
    formatBlockingError('deploy .protection is not supported.'),
    '',
    'Protection manifests are uploaded to the dataplane directly, not via the Miso Controller deploy pipeline.',
    '',
    'Use:',
    '  aifabrix upload .protection',
    '  aifabrix protection upload <datasourceKey>'
  ].join('\n');
}

/**
 * @param {Object} payload
 * @param {Object} [opts]
 * @returns {string}
 */
function formatProtectionListTTY(payload, opts = {}) {
  const lines = [];
  appendProtectionListTable(lines, payload, opts);
  return lines.join('\n');
}

/**
 * @param {Object} payload
 * @param {Object} [opts]
 * @returns {string}
 */
function formatProtectionShowTTY(payload, opts = {}) {
  const lines = [];
  appendProtectionShowHeader(lines, payload);
  appendProtectionShowCounts(lines, payload.status, payload.manifest);
  const grants = Array.isArray(payload.status?.grants) ? payload.status.grants : [];
  if (opts.verbose && grants.length) {
    appendProtectionShowVerboseGrants(lines, grants);
  }
  return lines.join('\n');
}

/**
 * @param {Object} response
 * @param {string} datasourceKey
 * @returns {string}
 */
function formatProtectionDeleteSummaryTTY(response, datasourceKey) {
  const lines = [formatSuccessLine(`Protection for '${datasourceKey}' deleted`)];
  if (response && typeof response === 'object') {
    if (response.dynamicValuesRemoved !== null && response.dynamicValuesRemoved !== undefined) {
      lines.push(`  Dynamic values removed: ${response.dynamicValuesRemoved}`);
    }
    if (response.principalGrantsRemoved !== null && response.principalGrantsRemoved !== undefined) {
      lines.push(`  Principal grants removed: ${response.principalGrantsRemoved}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  SEP,
  formatProtectionValidateTTY,
  printProtectionValidateReport,
  formatProtectionBatchValidateTTY,
  formatProtectionBatchUploadTTY,
  formatDeployProtectionNotImplementedTTY,
  formatProtectionListTTY,
  formatProtectionShowTTY,
  formatProtectionDeleteSummaryTTY,
  formatProgress,
  formatSuccessLine,
  formatBlockingError,
  formatWarningLine,
  formatNextActions,
  metadata,
  headerKeyValue,
  sectionTitle
};
