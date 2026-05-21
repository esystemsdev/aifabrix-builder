/**
 * @fileoverview Retry helpers for bulk loader (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const MAX_RETRIES = 3;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * @param {Error} err
 * @returns {number|null}
 */
function errorStatusCode(err) {
  if (!err || typeof err !== 'object') return null;
  if (typeof err.statusCode === 'number') return err.statusCode;
  if (err.response && typeof err.response.status === 'number') return err.response.status;
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @async
 * @param {Function} fn
 * @returns {Promise<*>}
 */
async function withTransientRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = errorStatusCode(err);
      if (!code || !RETRY_STATUS.has(code) || attempt >= MAX_RETRIES - 1) {
        throw err;
      }
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

module.exports = {
  withTransientRetry,
  errorStatusCode
};
