/**
 * @fileoverview Debug / audit TTY appendix for DatasourceTestRun (plan §3.7).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { SEP, appendReferenceLayoutLines } = require('./datasource-test-run-display');
const { buildDebugEnvelopeSlice } = require('./datasource-test-run-debug-slice');

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

function pushSummaryRefLines(lines, envelope) {
  const before = lines.length;
  appendReferenceLayoutLines(lines, envelope, { maxRefChars: 600 });
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
  FULL_MAX_BYTES_PER_STRING,
  RAW_MAX_STRING_TTY,
  RAW_MAX_STRING_PIPE,
  RAW_MAX_LINES
};
