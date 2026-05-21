/**
 * @fileoverview HTTP timeout parsing for agent trust CLI (plan 143).
 */

'use strict';

const DEFAULT_TRUST_TIMEOUT_MS = 120000;

/**
 * @param {Object} [options]
 * @returns {number}
 */
function parseTrustTimeoutMs(options = {}) {
  const raw = options.timeout;
  if (raw !== undefined && raw !== null && raw !== '') {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_TRUST_TIMEOUT_MS;
}

module.exports = {
  DEFAULT_TRUST_TIMEOUT_MS,
  parseTrustTimeoutMs
};
