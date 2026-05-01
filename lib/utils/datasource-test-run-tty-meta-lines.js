/**
 * @fileoverview TTY meta header lines for DatasourceTestRun (extracted for max-lines).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const { headerKeyValue } = require('./cli-test-layout-chalk');

/** @type {number} */
const DEFAULT_MAX_REF_CHARS = 200;

// UI-only: round float seconds tokens like "1.1713749s" -> "1.171s".
function formatSecondsText(text) {
  const txt = String(text);
  return txt.replace(/(\d+\.\d+)(?=s\b)/g, m => {
    const n = Number(m);
    if (!Number.isFinite(n)) return m;
    return n.toFixed(3);
  });
}

/**
 * @param {string} str
 * @param {number} maxChars
 * @returns {string}
 */
function truncateRefLine(str, maxChars) {
  const s = String(str);
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 24))}… [+${s.length - maxChars + 24} chars]`;
}

/**
 * @param {string[]} lines
 * @param {Object} envelope
 */
function pushTtyMetaRunWallLine(lines, envelope) {
  if (envelope.cliWallSeconds === undefined || envelope.cliWallSeconds === null) return;
  const n = Number(envelope.cliWallSeconds);
  if (Number.isFinite(n) && n >= 0) {
    lines.push(`${chalk.gray('Run wall:')} ${chalk.white(`~${n}s`)}`);
  }
}

/**
 * @param {string[]} lines
 * @param {Object} envelope
 */
function pushTtyMetaCapabilitiesPreviewLine(lines, envelope) {
  const caps = Array.isArray(envelope.capabilities) ? envelope.capabilities : [];
  if (caps.length === 0) return;
  const keys = caps
    .map(c => (c && c.key !== undefined && c.key !== null ? String(c.key) : ''))
    .filter(Boolean);
  if (keys.length === 0) return;
  const preview = keys.slice(0, 10).join(', ');
  const more = keys.length > 10 ? ', …' : '';
  lines.push(`${chalk.gray('Capabilities tested:')} ${chalk.white(`${preview}${more}`)}`);
}

/**
 * @param {string[]} lines
 * @param {Object} envelope
 */
function pushTtyMetaDebugExecutionSummaryLine(lines, envelope) {
  if (!envelope.debug || typeof envelope.debug !== 'object' || !envelope.debug.executionSummary) return;
  lines.push(
    `${chalk.blue.bold('debug.executionSummary:')} ${chalk.white(
      truncateRefLine(formatSecondsText(envelope.debug.executionSummary), DEFAULT_MAX_REF_CHARS)
    )}`
  );
}

/**
 * @param {string[]} lines
 * @param {Object} envelope
 */
function pushTtyMetaRunIdLine(lines, envelope) {
  const rid = envelope.runId || envelope.testRunId;
  if (rid) lines.push(`${chalk.gray('Run ID:')} ${chalk.cyan(String(rid))}`);
}

/**
 * @param {string[]} lines
 * @param {Object} envelope
 */
function pushTtyMetaReportCompletenessLine(lines, envelope) {
  if (!envelope.reportCompleteness || envelope.reportCompleteness === 'full') return;
  lines.push(`${chalk.gray('Report:')} ${chalk.yellow(String(envelope.reportCompleteness))}`);
}

/**
 * @param {Object} envelope
 * @param {(e: Object) => string} formatEnvelopeStatusLine
 * @returns {string[]}
 */
function buildTtyMetaLines(envelope, formatEnvelopeStatusLine) {
  const lines = [];
  lines.push(
    headerKeyValue('Datasource:', `${envelope.datasourceKey} (${envelope.systemKey})`)
  );
  lines.push(headerKeyValue('Run:', String(envelope.runType)));
  pushTtyMetaRunWallLine(lines, envelope);
  pushTtyMetaCapabilitiesPreviewLine(lines, envelope);
  lines.push(formatEnvelopeStatusLine(envelope));
  pushTtyMetaDebugExecutionSummaryLine(lines, envelope);
  pushTtyMetaRunIdLine(lines, envelope);
  pushTtyMetaReportCompletenessLine(lines, envelope);
  return lines;
}

module.exports = {
  buildTtyMetaLines
};
