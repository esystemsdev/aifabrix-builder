/**
 * @fileoverview Minimal human TTY + --summary for DatasourceTestRun (plan §3.2 / §16.9 subset).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { sectionTitle, headerKeyValue, colorAggregateGlyph, successGlyph, failureGlyph } = require('./cli-test-layout-chalk');
const { appendCertificateTTY } = require('./datasource-test-run-certificate-tty');
const { buildTtyMetaLines: buildTtyMetaLinesCore } = require('./datasource-test-run-tty-meta-lines');

const SEP = '────────────────────────────────';

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
 * Map API status string to aggregate bucket for colors.
 * @param {*} status
 * @returns {'ok'|'warn'|'fail'|'skipped'|null} null = unknown / other
 */
function envelopeStatusAggregate(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'warn') return 'warn';
  if (s === 'fail') return 'fail';
  if (s === 'skipped' || s === 'skip') return 'skipped';
  if (s === 'ok') return 'ok';
  return null;
}

/**
 * @param {*} status
 * @param {string} rawWord - as returned by API (e.g. ok, warn)
 * @returns {string}
 */
function colorStatusWord(status, rawWord) {
  const agg = envelopeStatusAggregate(status);
  const w = String(rawWord);
  if (!agg) return chalk.gray(w);
  if (agg === 'ok') return chalk.green(w);
  if (agg === 'warn') return chalk.yellow(w);
  if (agg === 'fail') return chalk.red(w);
  return chalk.gray(w);
}

/**
 * Colored glyph for status (neutral when unknown).
 * @param {*} status
 * @returns {string}
 */
function colorStatusGlyph(status) {
  const agg = envelopeStatusAggregate(status);
  const glyph = statusGlyph(status);
  return agg ? colorAggregateGlyph(agg, glyph) : chalk.gray(glyph);
}

/**
 * `Status: ✔ ok` with layout-aligned colors (preserves raw status text).
 * @param {Object} envelope
 * @returns {string}
 */
function formatEnvelopeStatusLine(envelope) {
  const raw = envelope.status !== undefined && envelope.status !== null ? String(envelope.status) : 'unknown';
  const g = colorStatusGlyph(envelope.status);
  return `${chalk.gray('Status:')} ${g} ${colorStatusWord(envelope.status, raw)}`;
}

/**
 * @param {boolean} ok
 * @param {string} body - step name + optional tail
 * @returns {string}
 */
function colorStepLine(ok, body) {
  const sym = ok ? successGlyph() : failureGlyph();
  return `  ${sym} ${chalk.white(body)}`;
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
    const g = colorStatusGlyph(e2e.status);
    lines.push(`${chalk.gray('E2E:')} ${g} ${colorStatusWord(e2e.status, e2e.status)}`);
  }
  const esteps = Array.isArray(e2e.steps) ? e2e.steps : [];
  for (const st of esteps) {
    const nm = st.name || st.step || 'step';
    const ok = st.success !== false && !st.error;
    const tail = st.error || st.message ? `: ${st.error || st.message}` : '';
    lines.push(colorStepLine(ok, `${nm}${tail}`));
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
  const lines = ['', chalk.gray(SEP), sectionTitle(`Capability scope: ${focusKey}`)];
  const caps =
    envelope && typeof envelope === 'object' && Array.isArray(envelope.capabilities)
      ? envelope.capabilities
      : [];
  const cap = caps.find(c => c && String(c.key) === focusKey);
  if (!cap) {
    lines.push(chalk.yellow(`(No row with key "${focusKey}" in capabilities[])`));
    return lines.join('\n');
  }
  lines.push(formatEnvelopeStatusLine(cap));
  if (cap.permission) {
    lines.push(headerKeyValue('Permission:', String(cap.permission)));
  }
  pushCapabilityE2eLines(lines, cap.e2e);
  return lines.join('\n');
}

/**
 * @param {Object} envelope
 * @param {{ includeDebugExecutionSummary?: boolean }} [ttyOptions]
 * @returns {string[]}
 */
function buildTtyMetaLines(envelope, ttyOptions = {}) {
  return buildTtyMetaLinesCore(envelope, formatEnvelopeStatusLine, ttyOptions);
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
  lines.push(chalk.blue.bold(String(title)));
  entries.forEach((text, i) => {
    lines.push(`  ${chalk.gray(`[${i + 1}]`)} ${chalk.white(truncateRefLine(text, maxRefChars))}`);
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
  lines.push(chalk.blue.bold('debug.payloadRefs:'));
  payloadRefs.forEach((pr, i) => {
    const idx = chalk.gray(`[${i + 1}]`);
    if (typeof pr === 'string') {
      lines.push(`  ${idx} ${chalk.white(truncateRefLine(pr, maxRefChars))}`);
      return;
    }
    if (pr && typeof pr === 'object') {
      const k = pr.key !== undefined && pr.key !== null ? String(pr.key) : 'payload';
      const r = pr.ref !== undefined && pr.ref !== null ? String(pr.ref) : '';
      const row = r ? `${k}: ${r}` : k;
      lines.push(`  ${idx} ${chalk.white(truncateRefLine(row, maxRefChars))}`);
      return;
    }
    lines.push(`  ${idx} ${chalk.gray('(ref)')}`);
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
    lines.push(
      `${chalk.blue.bold('debug.mode:')} ${chalk.white(String(dbg.mode))}`
    );
    added = true;
  }
  if (dbg.executionSummary) {
    lines.push(
      `${chalk.blue.bold('debug.executionSummary:')} ${chalk.white(
        truncateRefLine(formatSecondsText(dbg.executionSummary), maxRefChars)
      )}`
    );
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
  const includeDebugMeta = opts.includeDebugMeta === true;
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
    if (includeDebugMeta) {
      parts.push(appendDebugMetaLines(lines, dbg, maxRefChars));
    }
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
  lines.push(sectionTitle('Validation issues:'));
  const cap = Math.min(maxIssues, issues.length);
  for (let i = 0; i < cap; i += 1) {
    const iss = issues[i];
    const code = iss && iss.code ? chalk.red(`[${iss.code}] `) : '';
    const msg = iss && iss.message ? String(iss.message) : JSON.stringify(iss);
    lines.push(`  ${code}${chalk.yellow(msg)}`);
    appendDpSec013Details(lines, iss);
  }
  if (issues.length > cap) {
    lines.push(chalk.gray(`  … and ${issues.length - cap} more (see --json or debug full/raw)`));
  }
}

function appendDpSec013Details(lines, iss) {
  if (!iss || iss.code !== 'DP-SEC-013') return;
  const perm = iss.details && iss.details.resolvedPermission ? String(iss.details.resolvedPermission) : '';
  if (!perm) return;
  lines.push(`    ${chalk.gray('Missing permission:')} ${chalk.white(perm)}`);
}

/**
 * @param {string[]} lines
 * @param {Object} envelope
 */
function formatIntegrationStepLine(st) {
  const nm = (st && (st.name || st.step)) || 'step';
  const ok = st && st.success !== false && !st.error;
  const detail = st && (st.message || st.error) ? `: ${st.message || st.error}` : '';
  return colorStepLine(ok, `${nm}${detail}`);
}

function appendIntegrationStepLines(lines, envelope) {
  const integ = envelope && envelope.integration;
  const steps = integ && Array.isArray(integ.stepResults) ? integ.stepResults : [];
  if (!steps.length) return;
  lines.push('');
  lines.push(chalk.gray(SEP));
  lines.push(sectionTitle('Integration steps:'));
  for (const st of steps) {
    lines.push(formatIntegrationStepLine(st));
  }
}

function pickExecutiveVerdictLine(envelope) {
  const dev = envelope.developer;
  const cert = envelope.certificate;
  if (envelope.runType === 'e2e' && cert && typeof cert === 'object') {
    const cs = cert.summary;
    if (cs && String(cs).trim()) return String(cs).trim();
  }
  return (
    (dev && dev.executiveSummary) ||
    (cert && cert.summary) ||
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
  lines.push(chalk.gray('No capabilities reported.'));
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
 * @param {{
 *   focusCapabilityKey?: string,
 *   includeRefs?: boolean,
 *   includeDebugExecutionSummary?: boolean
 * }} [options] - When focusCapabilityKey set (e.g. --capability), append single-cap block (plan §2.3).
 *   includeDebugExecutionSummary: show dataplane `debug.executionSummary` in header (TTY debug appendix uses CLI `--debug`).
 * @returns {string}
 */
function formatDatasourceTestRunTTY(envelope, options = {}) {
  if (!envelope || typeof envelope !== 'object') return '';
  const lines = [
    ...buildTtyMetaLines(envelope, {
      includeDebugExecutionSummary: options.includeDebugExecutionSummary === true
    })
  ];
  appendNoCapabilitiesReportedLine(lines, envelope, options);
  lines.push('');
  lines.push(sectionTitle('Verdict:'));
  lines.push(chalk.white(pickExecutiveVerdictLine(envelope)));
  appendCertificateTTY(lines, envelope);
  appendRefsSectionIfEnabled(lines, envelope, options);
  appendValidationIssueLines(lines, envelope);
  appendIntegrationStepLines(lines, envelope);
  const focus = normalizedFocusCapabilityKey(options.focusCapabilityKey);
  if (focus) {
    lines.push(formatCapabilityFocusSection(envelope, focus));
  }
  return lines.join('\n');
}

function appendRefsSectionIfEnabled(lines, envelope, options) {
  if (options.includeRefs !== true) return;
  const before = lines.length;
  lines.push('');
  lines.push(chalk.gray(SEP));
  const added = appendReferenceLayoutLines(lines, envelope, { maxRefChars: 160, includeDebugMeta: false });
  if (added) {
    lines.push('');
    return;
  }
  // remove the blank + separator when no refs exist
  lines.length = before;
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
