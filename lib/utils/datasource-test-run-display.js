/**
 * @fileoverview Minimal human TTY + --summary for DatasourceTestRun (plan §3.2 / §16.9 subset).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const SEP = '────────────────────────────────';

/** @type {number} */
const DEFAULT_MAX_REF_CHARS = 200;

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
    const glyph = ok ? '✔' : '✖';
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

/**
 * @param {*} val
 * @returns {string[]}
 */
function normalizeRefArray(val) {
  if (val === null || val === undefined) return [];
  return Array.isArray(val) ? val : [val];
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
 * @param {string} title
 * @param {*} arr
 * @param {number} maxRefChars
 * @returns {boolean}
 */
function appendStringRefBlock(lines, title, arr, maxRefChars) {
  const entries = normalizeRefArray(arr).map(String);
  if (!entries.length) return false;
  lines.push(title);
  entries.forEach((text, i) => {
    lines.push(`  [${i + 1}] ${truncateRefLine(text, maxRefChars)}`);
  });
  return true;
}

/**
 * @param {string[]} lines
 * @param {Object|null|undefined} dbg
 * @param {number} maxRefChars
 * @returns {boolean}
 */
function appendDebugPayloadRefLines(lines, dbg, maxRefChars) {
  const payloadRefs = dbg && typeof dbg === 'object' ? normalizeRefArray(dbg.payloadRefs) : [];
  if (!payloadRefs.length) return false;
  lines.push('debug.payloadRefs:');
  payloadRefs.forEach((pr, i) => {
    if (typeof pr === 'string') {
      lines.push(`  [${i + 1}] ${truncateRefLine(pr, maxRefChars)}`);
      return;
    }
    if (pr && typeof pr === 'object') {
      const k = pr.key !== undefined && pr.key !== null ? String(pr.key) : 'payload';
      const r = pr.ref !== undefined && pr.ref !== null ? String(pr.ref) : '';
      const row = r ? `${k}: ${r}` : k;
      lines.push(`  [${i + 1}] ${truncateRefLine(row, maxRefChars)}`);
      return;
    }
    lines.push(`  [${i + 1}] (ref)`);
  });
  return true;
}

/**
 * @param {string[]} lines
 * @param {Object} dbg
 * @param {number} maxRefChars
 * @returns {boolean}
 */
function appendDebugMetaLines(lines, dbg, maxRefChars) {
  let added = false;
  if (dbg.mode) {
    lines.push(`debug.mode: ${String(dbg.mode)}`);
    added = true;
  }
  if (dbg.executionSummary) {
    lines.push(`debug.executionSummary: ${truncateRefLine(String(dbg.executionSummary), maxRefChars)}`);
    added = true;
  }
  return added;
}

/**
 * Append audit + debug reference layout (OpenAPI AuditRefs, DebugTrace.payloadRefs).
 * @param {string[]} lines
 * @param {Object} envelope
 * @param {{ maxRefChars?: number }} [opts]
 * @returns {boolean} True if any reference line was added
 */
function appendReferenceLayoutLines(lines, envelope, opts = {}) {
  const maxRefChars = opts.maxRefChars ?? DEFAULT_MAX_REF_CHARS;
  const audit = envelope && envelope.audit;
  const dbg = envelope && envelope.debug;
  const parts = [];

  if (audit && typeof audit === 'object') {
    parts.push(appendStringRefBlock(lines, 'audit.executionIds:', audit.executionIds, maxRefChars));
    parts.push(appendStringRefBlock(lines, 'audit.traceRefs:', audit.traceRefs, maxRefChars));
    parts.push(appendStringRefBlock(lines, 'audit.rbacTraceRefs:', audit.rbacTraceRefs, maxRefChars));
    parts.push(appendStringRefBlock(lines, 'audit.abacTraceRefs:', audit.abacTraceRefs, maxRefChars));
  }

  parts.push(appendDebugPayloadRefLines(lines, dbg, maxRefChars));

  if (dbg && typeof dbg === 'object') {
    parts.push(appendStringRefBlock(lines, 'debug.executionIds:', dbg.executionIds, maxRefChars));
    parts.push(appendDebugMetaLines(lines, dbg, maxRefChars));
  }

  return parts.some(Boolean);
}

/**
 * @param {string[]} lines
 * @param {Object} envelope
 * @param {number} [maxIssues]
 */
function appendValidationIssueLines(lines, envelope, maxIssues = 5) {
  const issues = envelope && envelope.validation && Array.isArray(envelope.validation.issues) ? envelope.validation.issues : [];
  if (!issues.length) return;
  lines.push('Validation issues:');
  const cap = Math.min(maxIssues, issues.length);
  for (let i = 0; i < cap; i += 1) {
    const iss = issues[i];
    const code = iss && iss.code ? `[${iss.code}] ` : '';
    const msg = iss && iss.message ? String(iss.message) : JSON.stringify(iss);
    lines.push(`  ${code}${msg}`);
  }
  if (issues.length > cap) {
    lines.push(`  … and ${issues.length - cap} more (see --json or debug full/raw)`);
  }
}

/**
 * @param {string[]} lines
 * @param {Object} envelope
 */
function formatIntegrationStepLine(st) {
  const nm = (st && (st.name || st.step)) || 'step';
  const ok = st && st.success !== false && !st.error;
  const glyph = ok ? '✔' : '✖';
  const detail = st && (st.message || st.error) ? `: ${st.message || st.error}` : '';
  return `  ${glyph} ${nm}${detail}`;
}

function appendIntegrationStepLines(lines, envelope) {
  const integ = envelope && envelope.integration;
  const steps = integ && Array.isArray(integ.stepResults) ? integ.stepResults : [];
  if (!steps.length) return;
  lines.push('Integration steps:');
  for (const st of steps) {
    lines.push(formatIntegrationStepLine(st));
  }
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
  if (appendReferenceLayoutLines(lines, envelope, { maxRefChars: 160 })) {
    lines.push('');
  }
  appendValidationIssueLines(lines, envelope);
  appendIntegrationStepLines(lines, envelope);
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
  SEP,
  appendReferenceLayoutLines,
  normalizeRefArray
};
