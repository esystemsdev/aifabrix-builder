/**
 * @fileoverview Debug / audit TTY appendix for DatasourceTestRun (plan §3.7).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { SEP, appendReferenceLayoutLines } = require('./datasource-test-run-display');
const { buildDebugEnvelopeSlice } = require('./datasource-test-run-debug-slice');
const {
  pushCapacityOperationsSummaryLines,
  parseCapacityScenarioOp,
  parseCapacityDetailKey,
  formatCapacityOperationLabel
} = require('./datasource-test-run-capacity-operations');

const FULL_MAX_BYTES_PER_STRING = 8192;
const RAW_MAX_STRING_TTY = 65536;
const RAW_MAX_STRING_PIPE = 1024 * 1024;
const RAW_MAX_LINES = 200;

/**
 * @param {*} debugOpt - Commander value: undefined, false, true, or level string
 * @returns {null|'summary'|'full'|'raw'}
 */
function resolveDebugDisplayMode(debugOpt) {
  if (debugOpt === undefined || debugOpt === false) return null;
  if (debugOpt === true) return 'summary';
  const s = String(debugOpt).trim().toLowerCase();
  if (s === 'summary' || s === 'full' || s === 'raw') return s;
  return 'summary';
}

/**
 * @param {string} str
 * @param {number} maxBytes
 * @returns {string}
 */
function truncateUtf8String(str, maxBytes) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  if (Buffer.byteLength(s, 'utf8') <= maxBytes) return s;
  let end = s.length;
  while (end > 0 && Buffer.byteLength(s.slice(0, end), 'utf8') > maxBytes) {
    end -= 1;
  }
  const prefix = s.slice(0, end);
  const omitted = Buffer.byteLength(s, 'utf8') - Buffer.byteLength(prefix, 'utf8');
  return `${prefix} … [truncated, ${omitted} bytes]`;
}

/**
 * @param {*} value
 * @param {number} maxBytesPerString
 * @param {number} depth
 * @returns {*}
 */
function deepTruncateStrings(value, maxBytesPerString, depth) {
  if (depth <= 0) return '[…]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return truncateUtf8String(value, maxBytesPerString);
  if (Array.isArray(value)) return value.map(v => deepTruncateStrings(v, maxBytesPerString, depth - 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepTruncateStrings(v, maxBytesPerString, depth - 1);
    }
    return out;
  }
  return value;
}

/**
 * @param {string} text
 * @returns {string}
 */
function redactDebugText(text) {
  return String(text)
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/("Authorization"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2')
    .replace(/("authorization"\s*:\s*")[^"]*(")/g, '$1[REDACTED]$2');
}

function getBestEffortStepList(envelope) {
  const v = envelope && envelope.validation;
  const metrics = v && v.metricsOutput;
  const steps = metrics && Array.isArray(metrics.steps) ? metrics.steps : [];
  if (steps.length) return steps;
  const dbg = envelope && envelope.debug;
  const stepDebug =
    dbg && dbg.e2eAsyncDebug && Array.isArray(dbg.e2eAsyncDebug.stepDebug) ? dbg.e2eAsyncDebug.stepDebug : [];
  return stepDebug;
}

function findStepByName(steps, name) {
  return steps.find(s => s && String(s.name || s.step) === name);
}

function sumNumber(rows, key) {
  return rows.reduce((acc, r) => acc + (Number(r && r[key]) || 0), 0);
}

function appendE2eWorkerHeadLine(lines, timing) {
  const work = timing.durationSeconds;
  if (work === undefined || work === null || work === '') return;
  const w = Number(work);
  if (Number.isNaN(w)) return;
  let head = `E2E worker: ~${w.toFixed(3)}s`;
  const wall = timing.wallClockSeconds;
  if (wall !== undefined && wall !== null && wall !== '') {
    const wl = Number(wall);
    if (!Number.isNaN(wl)) {
      head += ` (wall ~${wl.toFixed(3)}s)`;
    }
  }
  lines.push(head);
}

function appendE2eStepDurationLines(lines, timing) {
  const sd = timing.stepDurations;
  if (!Array.isArray(sd) || !sd.length) return;
  for (const row of sd) {
    if (!row || typeof row !== 'object') continue;
    const step = row.step !== undefined && row.step !== null ? String(row.step) : '?';
    const sec =
      row.durationSeconds !== undefined && row.durationSeconds !== null
        ? Number(row.durationSeconds)
        : NaN;
    if (!Number.isNaN(sec)) {
      lines.push(`  ${step}: ~${sec.toFixed(3)}s`);
    }
  }
}

function getFirstSyncJobPhaseTimings(e2e) {
  const stepDebug = Array.isArray(e2e.stepDebug) ? e2e.stepDebug : [];
  const syncStep = stepDebug.find(s => s && String(s.name) === 'sync');
  const jobs = syncStep && syncStep.evidence && syncStep.evidence.jobs;
  const first = Array.isArray(jobs) && jobs.length ? jobs[0] : null;
  const audit = first && first.audit;
  const pt = audit && typeof audit === 'object' ? audit.phaseTimingsSeconds : null;
  return pt && typeof pt === 'object' ? pt : null;
}

function formatPhaseTimingParts(phaseTimings) {
  const order = ['phase1', 'phase2', 'phase3', 'phase4'];
  const parts = [];
  for (const k of order) {
    const raw = phaseTimings[k];
    if (raw === undefined || raw === null) continue;
    const v = Number(raw);
    if (!Number.isNaN(v)) {
      parts.push(`${k} ~${v.toFixed(3)}s`);
    }
  }
  return parts;
}

function appendSyncPhaseTimingsFromE2e(lines, e2e) {
  const phaseTimings = getFirstSyncJobPhaseTimings(e2e);
  if (!phaseTimings) return;
  const parts = formatPhaseTimingParts(phaseTimings);
  if (parts.length) {
    lines.push(`Sync phases (first job): ${parts.join(', ')}`);
  }
}

/**
 * E2E poll envelope: `debug.e2eAsyncDebug` from dataplane run store (timing + stepDebug).
 * @param {string[]} lines
 * @param {Object} envelope
 */
function pushE2eTimingSummaryLines(lines, envelope) {
  const dbg = envelope && envelope.debug;
  const e2e = dbg && dbg.e2eAsyncDebug;
  if (!e2e || typeof e2e !== 'object') return;

  const timing = e2e.timing;
  if (timing && typeof timing === 'object') {
    appendE2eWorkerHeadLine(lines, timing);
    appendE2eStepDurationLines(lines, timing);
  }
  appendSyncPhaseTimingsFromE2e(lines, e2e);
}

function pushSyncSummaryLines(lines, envelope) {
  const steps = getBestEffortStepList(envelope);
  const syncStep = findStepByName(steps, 'sync');
  const syncStatusStep = findStepByName(steps, 'sync_status');
  const persistenceStep = findStepByName(steps, 'persistence');

  if (syncStep && syncStep.evidence && Array.isArray(syncStep.evidence.jobs)) {
    const jobs = syncStep.evidence.jobs;
    const processed = sumNumber(jobs, 'recordsProcessed');
    const total = sumNumber(jobs, 'totalRecords');
    lines.push(`Sync: ${processed}/${total} processed`);
  }
  if (syncStatusStep && syncStatusStep.evidence && Array.isArray(syncStatusStep.evidence.datasources)) {
    const rows = syncStatusStep.evidence.datasources;
    const total = sumNumber(rows, 'totalRecords');
    const active = sumNumber(rows, 'activeRecords');
    lines.push(`Sync status: ${active}/${total} active`);
  }
  if (persistenceStep && persistenceStep.evidence && persistenceStep.evidence.recordCount !== undefined) {
    lines.push(`Persistence: ${persistenceStep.evidence.recordCount} record(s)`);
  }
}

function pushSummaryRefLines(lines, envelope) {
  const before = lines.length;
  try {
    pushSyncSummaryLines(lines, envelope);
    pushE2eTimingSummaryLines(lines, envelope);
  } catch {
    // ignore best-effort debug summary extraction
  }
  appendReferenceLayoutLines(lines, envelope, { maxRefChars: 600, includeDebugMeta: true });
  if (lines.length === before) {
    lines.push('(No audit or debug references on this report.)');
  }
}

/**
 * Rich JSON appendix for full/raw debug (validation, integration, certificate, capabilities).
 * @param {Object} envelope
 * @param {number} maxStr
 * @returns {string}
 */
function stringifyDebugSlice(envelope, maxStr) {
  const slice = buildDebugEnvelopeSlice(envelope);
  return JSON.stringify(deepTruncateStrings(slice, maxStr, 16), null, 2);
}

function applyRawLineCap(text) {
  let t = redactDebugText(text);
  const ls = t.split('\n');
  if (ls.length > RAW_MAX_LINES) {
    const omitted = ls.length - RAW_MAX_LINES;
    t = `${ls.slice(0, RAW_MAX_LINES).join('\n')}\n… [${omitted} lines omitted; use audit ref]`;
  }
  return t;
}

/**
 * Human appendix after main TTY/summary (not used for --json).
 * @param {Object|null} envelope
 * @param {'summary'|'full'|'raw'} mode
 * @param {boolean} isTTY
 * @returns {string}
 */
function formatDatasourceTestRunDebugBlock(envelope, mode, isTTY) {
  if (!envelope || typeof envelope !== 'object') return '';

  const lines = ['', SEP, `Debug (${mode})`];

  if (mode === 'summary') {
    pushSummaryRefLines(lines, envelope);
    return lines.join('\n');
  }

  const maxStr = mode === 'full' ? FULL_MAX_BYTES_PER_STRING : isTTY ? RAW_MAX_STRING_TTY : RAW_MAX_STRING_PIPE;
  const text = mode === 'raw' ? applyRawLineCap(stringifyDebugSlice(envelope, maxStr)) : stringifyDebugSlice(envelope, maxStr);
  lines.push(text);
  return lines.join('\n');
}

module.exports = {
  resolveDebugDisplayMode,
  truncateUtf8String,
  formatDatasourceTestRunDebugBlock,
  pushE2eTimingSummaryLines,
  pushCapacityOperationsSummaryLines,
  parseCapacityScenarioOp,
  parseCapacityDetailKey,
  formatCapacityOperationLabel,
  FULL_MAX_BYTES_PER_STRING,
  RAW_MAX_STRING_TTY,
  RAW_MAX_STRING_PIPE,
  RAW_MAX_LINES
};
