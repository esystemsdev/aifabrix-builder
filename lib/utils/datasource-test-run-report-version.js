/**
 * @fileoverview reportVersion compatibility warnings (plan §3.15).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/** CLI-supported major reportVersion (bump when breaking). */
const SUPPORTED_MAJOR = 1;

/**
 * Parse leading major from semver-like string (e.g. 1.1.0 → 1).
 * @param {string} v
 * @returns {number|null}
 */
function parseMajor(v) {
  if (!v || typeof v !== 'string') return null;
  const m = /^v?(\d+)/.exec(v.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

/**
 * stderr messages for reportVersion handling.
 * @param {string|undefined} reportVersion - From envelope
 * @returns {{ level: 'none'|'warn'|'info', message: string }|null}
 */
function getReportVersionStderrMessage(reportVersion) {
  const major = parseMajor(reportVersion || '');
  if (major === null) {
    return null;
  }
  if (major < SUPPORTED_MAJOR - 1) {
    return {
      level: 'warn',
      message: `reportVersion unsupported (got ${reportVersion}, support ${SUPPORTED_MAJOR - 1}–${SUPPORTED_MAJOR} major)`
    };
  }
  if (major > SUPPORTED_MAJOR) {
    return {
      level: 'info',
      message: 'Newer reportVersion; some fields may be ignored'
    };
  }
  return null;
}

module.exports = {
  SUPPORTED_MAJOR,
  parseMajor,
  getReportVersionStderrMessage
};
