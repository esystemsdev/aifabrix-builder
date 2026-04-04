/**
 * @fileoverview Minimal human TTY + --summary for DatasourceTestRun (plan §3.2 / §16.9 subset).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const SEP = '────────────────────────────────';

/**
 * @param {'ok'|'warn'|'fail'|'skipped'} status
 * @returns {string}
 */
function statusGlyph(status) {
  if (status === 'ok') return '✔';
  if (status === 'warn') return '⚠';
  if (status === 'fail') return '✖';
  if (status === 'skipped') return '⏭';
  return '?';
}

/**
 * One-line summary (plan §16.9 normative field order subset).
 * @param {Object} envelope
 * @returns {string}
 */
/* eslint-disable complexity -- compact branching for optional cert/cap blocks */
function formatDatasourceTestRunSummary(envelope) {
  if (!envelope || typeof envelope !== 'object') return '';
  const parts = [];
  parts.push(String(envelope.datasourceKey || 'unknown'));
  parts.push(`${statusGlyph(envelope.status)} ${(envelope.status || '').toUpperCase()}`);
  const cap = envelope.capabilitySummary;
  if (cap && typeof cap === 'object') {
    const passed = cap.passedCount;
    const total = cap.totalCount;
    if (typeof passed === 'number' && typeof total === 'number') {
      parts.push(`Capabilities: ${passed}/${total}`);
    }
  }
  const cert = envelope.certificate;
  if (cert && typeof cert === 'object') {
    const level =
      cert.level !== undefined && cert.level !== null ? String(cert.level) : '';
    const cg = cert.status === 'passed' ? '✔' : cert.status === 'not_passed' ? '✖' : '⚠';
    if (level) parts.push(`Certificate: ${level} ${cg}`);
  }
  return parts.join(' | ');
}
/* eslint-enable complexity */

/**
 * Default TTY block (header + verdict line + short summary + optional completeness).
 * @param {Object} envelope
 * @returns {string}
 */
function formatDatasourceTestRunTTY(envelope) {
  if (!envelope || typeof envelope !== 'object') return '';
  const lines = [];
  lines.push(
    `Datasource: ${envelope.datasourceKey} (${envelope.systemKey})`
  );
  lines.push(`Run: ${envelope.runType}`);
  lines.push(`Status: ${statusGlyph(envelope.status)} ${envelope.status}`);
  const rid = envelope.runId || envelope.testRunId;
  if (rid) lines.push(`Run ID: ${rid}`);
  if (envelope.reportCompleteness && envelope.reportCompleteness !== 'full') {
    lines.push(`Report: ${envelope.reportCompleteness}`);
  }
  lines.push('');
  const dev = envelope.developer;
  const summaryLine =
    (dev && dev.executiveSummary) ||
    (envelope.certificate && envelope.certificate.summary) ||
    (envelope.validation && envelope.validation.summary) ||
    (envelope.integration && envelope.integration.summary) ||
    `Run finished with status ${envelope.status}.`;
  lines.push('Verdict:');
  lines.push(summaryLine);
  lines.push('');
  lines.push(SEP);
  return lines.join('\n');
}

module.exports = {
  formatDatasourceTestRunSummary,
  formatDatasourceTestRunTTY,
  statusGlyph,
  SEP
};
