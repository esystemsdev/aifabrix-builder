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
 * Normalize CLI --capability value for matching envelope.capabilities[].key
 * @param {*} focusCapabilityKey
 * @returns {string} trimmed or ''
 */
function normalizedFocusCapabilityKey(focusCapabilityKey) {
  if (focusCapabilityKey === undefined || focusCapabilityKey === null) return '';
  const s = String(focusCapabilityKey).trim();
  return s;
}

/**
 * @param {string[]} lines
 * @param {Object|null|undefined} e2e
 */
function pushCapabilityE2eLines(lines, e2e) {
  if (!e2e || typeof e2e !== 'object') return;
  if (e2e.status) {
    lines.push(`E2E: ${statusGlyph(e2e.status)} ${e2e.status}`);
  }
  const esteps = Array.isArray(e2e.steps) ? e2e.steps : [];
  for (const st of esteps) {
    const nm = st.name || st.step || 'step';
    const ok = st.success !== false && !st.error;
    const glyph = ok ? '✓' : '✗';
    const tail = st.error || st.message ? `: ${st.error || st.message}` : '';
    lines.push(`  ${glyph} ${nm}${tail}`);
  }
}

/**
 * Multi-line TTY block for a single capability row (plan §2.3 drill-down).
 * @param {Object|null|undefined} envelope
 * @param {string} focusKey - non-empty
 * @returns {string}
 */
function formatCapabilityFocusSection(envelope, focusKey) {
  if (!focusKey) return '';
  const lines = ['', SEP, `Capability scope: ${focusKey}`];
  const caps =
    envelope && typeof envelope === 'object' && Array.isArray(envelope.capabilities)
      ? envelope.capabilities
      : [];
  const cap = caps.find(c => c && String(c.key) === focusKey);
  if (!cap) {
    lines.push(`(No row with key "${focusKey}" in capabilities[])`);
    return lines.join('\n');
  }
  lines.push(`Status: ${statusGlyph(cap.status)} ${cap.status}`);
  if (cap.permission) {
    lines.push(`Permission: ${cap.permission}`);
  }
  pushCapabilityE2eLines(lines, cap.e2e);
  return lines.join('\n');
}

/**
 * @param {Object} envelope
 * @returns {string[]}
 */
function buildTtyMetaLines(envelope) {
  const lines = [];
  lines.push(`Datasource: ${envelope.datasourceKey} (${envelope.systemKey})`);
  lines.push(`Run: ${envelope.runType}`);
  lines.push(`Status: ${statusGlyph(envelope.status)} ${envelope.status}`);
  const rid = envelope.runId || envelope.testRunId;
  if (rid) lines.push(`Run ID: ${rid}`);
  if (envelope.reportCompleteness && envelope.reportCompleteness !== 'full') {
    lines.push(`Report: ${envelope.reportCompleteness}`);
  }
  return lines;
}

function pickExecutiveVerdictLine(envelope) {
  const dev = envelope.developer;
  return (
    (dev && dev.executiveSummary) ||
    (envelope.certificate && envelope.certificate.summary) ||
    (envelope.validation && envelope.validation.summary) ||
    (envelope.integration && envelope.integration.summary) ||
    `Run finished with status ${envelope.status}.`
  );
}

/**
 * Plan §3.9: explicit line when E2E has no capability rows (skipped when --capability drill-down is active).
 * @param {string[]} lines
 * @param {Object} envelope
 * @param {{ focusCapabilityKey?: string }} [options]
 */
function appendNoCapabilitiesReportedLine(lines, envelope, options = {}) {
  if (envelope.runType !== 'e2e') return;
  if (normalizedFocusCapabilityKey(options.focusCapabilityKey)) return;
  const caps = envelope.capabilities;
  if (Array.isArray(caps) && caps.length > 0) return;
  lines.push('No capabilities reported.');
}

/**
 * @param {string[]} parts
 * @param {Object} envelope
 * @param {string} focus - normalized or ''
 */
function appendCapabilitySummaryPart(parts, envelope, focus) {
  if (focus) {
    const caps = Array.isArray(envelope.capabilities) ? envelope.capabilities : [];
    const row = caps.find(c => c && String(c.key) === focus);
    parts.push(
      row ? `Cap ${focus}: ${statusGlyph(row.status)} ${row.status}` : `Cap ${focus}: (missing)`
    );
    return;
  }
  const capSummary = envelope.capabilitySummary;
  if (capSummary && typeof capSummary === 'object') {
    const passed = capSummary.passedCount;
    const total = capSummary.totalCount;
    if (typeof passed === 'number' && typeof total === 'number') {
      parts.push(`Capabilities: ${passed}/${total}`);
    }
  }
}

/**
 * @param {string[]} parts
 * @param {Object} envelope
 */
function appendCertificateSummaryPart(parts, envelope) {
  const cert = envelope.certificate;
  if (!cert || typeof cert !== 'object') return;
  const level =
    cert.level !== undefined && cert.level !== null ? String(cert.level) : '';
  const cg = cert.status === 'passed' ? '✔' : cert.status === 'not_passed' ? '✖' : '⚠';
  if (level) parts.push(`Certificate: ${level} ${cg}`);
}

/**
 * One-line summary (plan §16.9 normative field order subset).
 * @param {Object} envelope
 * @param {{ focusCapabilityKey?: string }} [options]
 * @returns {string}
 */
function formatDatasourceTestRunSummary(envelope, options = {}) {
  if (!envelope || typeof envelope !== 'object') return '';
  const parts = [];
  parts.push(String(envelope.datasourceKey || 'unknown'));
  parts.push(`${statusGlyph(envelope.status)} ${(envelope.status || '').toUpperCase()}`);
  const focus = normalizedFocusCapabilityKey(options.focusCapabilityKey);
  appendCapabilitySummaryPart(parts, envelope, focus);
  appendCertificateSummaryPart(parts, envelope);
  return parts.join(' | ');
}

/**
 * Default TTY block (header + verdict line + short summary + optional completeness).
 * @param {Object} envelope
 * @param {{ focusCapabilityKey?: string }} [options] - When set (e.g. --capability), append single-cap block (plan §2.3).
 * @returns {string}
 */
function formatDatasourceTestRunTTY(envelope, options = {}) {
  if (!envelope || typeof envelope !== 'object') return '';
  const lines = [...buildTtyMetaLines(envelope)];
  appendNoCapabilitiesReportedLine(lines, envelope, options);
  lines.push('');
  lines.push('Verdict:');
  lines.push(pickExecutiveVerdictLine(envelope));
  lines.push('');
  lines.push(SEP);
  const focus = normalizedFocusCapabilityKey(options.focusCapabilityKey);
  if (focus) {
    lines.push(formatCapabilityFocusSection(envelope, focus));
  }
  return lines.join('\n');
}

module.exports = {
  formatDatasourceTestRunSummary,
  formatDatasourceTestRunTTY,
  formatCapabilityFocusSection,
  normalizedFocusCapabilityKey,
  statusGlyph,
  SEP
};
