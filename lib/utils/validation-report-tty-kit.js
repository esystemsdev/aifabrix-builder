/**
 * @fileoverview Reusable TTY helpers for validation/test reports (verdict, readiness, data-quality lines).
 */

'use strict';

const { SEP, statusGlyph } = require('./datasource-test-run-display');

const TRUST_LINE_LABELS = Object.freeze({
  schema: 'Schema coverage',
  consistency: 'Data consistency',
  reliability: 'Data reliability'
});

function rollupGlyph(r) {
  return statusGlyph(r === 'fail' ? 'fail' : r === 'warn' ? 'warn' : 'ok');
}

function verdictLineFromEnvelope(rootStatus, certStatus, runType) {
  if (rootStatus === 'skipped') return '⏭ Skipped';
  if (rootStatus === 'warn') return '⚠ Limited production use';
  if (rootStatus === 'fail') {
    if (runType === 'integration') return '✖ Pipeline not working';
    if (runType === 'e2e') return '✖ Not usable';
    return '✖ Configuration invalid';
  }
  if (certStatus === 'not_passed') return '✔ Functional with certification gaps';
  return '✔ Suitable for production use';
}

function verdictLineLocalExternalTest(status) {
  if (status === 'ok') return '✔ Suitable for continued setup (local manifest check passed).';
  if (status === 'warn') return '⚠ Limited production use';
  return '✖ Configuration invalid';
}

function readinessLineFromAggregateStatus(status) {
  if (status === 'fail') return `Readiness: ${statusGlyph('fail')} Not ready`;
  if (status === 'warn') return `Readiness: ${statusGlyph('warn')} Partial`;
  return `Readiness: ${statusGlyph('ok')} Ready`;
}

function readinessLineFromDataReadiness(dataReadiness) {
  if (!dataReadiness) return null;
  if (dataReadiness === 'not_ready') return `Readiness: ${statusGlyph('fail')} Not ready`;
  if (dataReadiness === 'partial') return `Readiness: ${statusGlyph('warn')} Partial`;
  if (dataReadiness === 'ready') return `Readiness: ${statusGlyph('ok')} Ready`;
  return null;
}

function formatDataQualityLines(rollups, descriptions) {
  const d = descriptions || {};
  return [
    `${rollupGlyph(rollups.schema)} ${TRUST_LINE_LABELS.schema}${d.schema ? ` — ${d.schema}` : ''}`,
    `${rollupGlyph(rollups.consistency)} ${TRUST_LINE_LABELS.consistency}${d.consistency ? ` — ${d.consistency}` : ''}`,
    `${rollupGlyph(rollups.reliability)} ${TRUST_LINE_LABELS.reliability}${d.reliability ? ` — ${d.reliability}` : ''}`
  ];
}

function pushSeparatorBlock(lines) {
  lines.push('');
  lines.push(SEP);
  lines.push('');
}

module.exports = {
  SEP,
  statusGlyph,
  TRUST_LINE_LABELS,
  rollupGlyph,
  verdictLineFromEnvelope,
  verdictLineLocalExternalTest,
  readinessLineFromAggregateStatus,
  readinessLineFromDataReadiness,
  formatDataQualityLines,
  pushSeparatorBlock
};
