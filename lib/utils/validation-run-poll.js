/**
 * @fileoverview Poll GET /api/v1/validation/run/{testRunId} until reportCompleteness is full (plan §3.5–3.6).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getValidationRunWithTransportRetry } = require('./validation-run-post-retry');

const INITIAL_INTERVAL_MS = 2000;
const MAX_INTERVAL_MS = 15000;

/**
 * Delay between polls after attempt `n` (0-based): 2s, 4s, 8s, … cap 15s.
 * @param {number} attemptIndex - Zero-based poll index after initial POST
 * @returns {number}
 */
function nextPollDelayMs(attemptIndex) {
  const raw = INITIAL_INTERVAL_MS * 2 ** Math.max(0, attemptIndex);
  return Math.min(raw, MAX_INTERVAL_MS);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Whether polling should stop on this envelope.
 * @param {Object} envelope - DatasourceTestRun-like
 * @returns {boolean}
 */
function isTerminalReportCompleteness(envelope) {
  if (!envelope || typeof envelope !== 'object') return false;
  return envelope.reportCompleteness === 'full';
}

/**
 * Poll until reportCompleteness === 'full' or budget exhausted.
 * @async
 * @param {Object} opts
 * @param {string} opts.dataplaneUrl
 * @param {Object} opts.authConfig
 * @param {string} opts.testRunId
 * @param {number} opts.budgetMs - Remaining wall-clock budget for polls only (POST excluded)
 * @param {typeof getValidationRunWithTransportRetry} [opts.fetchRun] - Inject for tests (default: GET with transport retry)
 * @returns {Promise<{ envelope: Object|null, timedOut: boolean, lastApiResult: Object|null }>}
 */
async function pollValidationRunUntilComplete(opts) {
  const {
    dataplaneUrl,
    authConfig,
    testRunId,
    budgetMs,
    fetchRun = getValidationRunWithTransportRetry
  } = opts;
  const deadline = Date.now() + Math.max(0, budgetMs);
  let attempt = 0;
  let lastApiResult = null;
  let envelope = null;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    lastApiResult = await fetchRun(dataplaneUrl, authConfig, testRunId);
    if (!lastApiResult.success) {
      return { envelope: null, timedOut: false, lastApiResult };
    }
    envelope = lastApiResult.data;
    if (isTerminalReportCompleteness(envelope)) {
      return { envelope, timedOut: false, lastApiResult };
    }

    const delay = Math.min(nextPollDelayMs(attempt), Math.max(0, deadline - Date.now()));
    attempt += 1;
    if (delay > 0) {
      await sleep(delay);
    }
  }

  return { envelope, timedOut: true, lastApiResult };
}

module.exports = {
  INITIAL_INTERVAL_MS,
  MAX_INTERVAL_MS,
  nextPollDelayMs,
  pollValidationRunUntilComplete,
  isTerminalReportCompleteness
};
