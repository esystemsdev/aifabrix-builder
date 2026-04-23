/**
 * @fileoverview Poll GET /api/v1/validation/run/{testRunId} until reportCompleteness is full (plan §3.5–3.6).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');
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

function maybeLogPollProgress(envelope, verbosePoll, lastProgressLogAtRef) {
  if (!verbosePoll || !envelope || typeof envelope !== 'object') return;
  const now = Date.now();
  if (now - lastProgressLogAtRef[0] < 5000) return;
  lastProgressLogAtRef[0] = now;
  const st = envelope.status !== undefined && envelope.status !== null ? String(envelope.status) : '?';
  const c =
    envelope.reportCompleteness !== undefined && envelope.reportCompleteness !== null
      ? String(envelope.reportCompleteness)
      : '?';
  logger.log(chalk.gray(`  Polling validation run… completeness=${c} status=${st}`));
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
 * @param {boolean} [opts.verbosePoll] - Log throttled progress (plan §3.13)
 * @param {number} [opts.pollRequestTimeoutMs] - Per-GET HTTP timeout (match validation aggregate budget)
 * @returns {Promise<{ envelope: Object|null, timedOut: boolean, lastApiResult: Object|null }>}
 */
async function pollValidationRunUntilComplete(opts) {
  const {
    dataplaneUrl,
    authConfig,
    testRunId,
    budgetMs,
    fetchRun = getValidationRunWithTransportRetry,
    verbosePoll = false,
    pollRequestTimeoutMs
  } = opts;
  const pollTransportOpts =
    Number.isFinite(pollRequestTimeoutMs) && pollRequestTimeoutMs > 0
      ? { timeoutMs: pollRequestTimeoutMs }
      : {};
  const deadline = Date.now() + Math.max(0, budgetMs);
  let attempt = 0;
  let lastApiResult = null;
  let envelope = null;
  const lastProgressLogAtRef = [0];

  while (Date.now() < deadline) {
    lastApiResult = await fetchRun(dataplaneUrl, authConfig, testRunId, pollTransportOpts);
    if (!lastApiResult.success) {
      return { envelope: null, timedOut: false, lastApiResult };
    }
    envelope = lastApiResult.data;
    if (isTerminalReportCompleteness(envelope)) {
      return { envelope, timedOut: false, lastApiResult };
    }

    maybeLogPollProgress(envelope, verbosePoll, lastProgressLogAtRef);

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
