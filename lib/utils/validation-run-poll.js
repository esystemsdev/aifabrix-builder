/**
 * @fileoverview Poll GET /api/v1/validation/run/{testRunId} until reportCompleteness is full (plan §3.5–3.6).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');
const { getValidationRunWithTransportRetry } = require('./validation-run-post-retry');

/** Short fixed delay while waiting for async E2E (typically a few seconds). */
const FAST_POLL_COUNT = 24;
const FAST_POLL_INTERVAL_MS = 400;
/** After fast phase, exponential backoff to limit load on long runs. */
const SLOW_BASE_INTERVAL_MS = 2000;
const MAX_INTERVAL_MS = 15000;

/**
 * Delay between polls after attempt `n` (0-based).
 * Fast phase (~10s of 400ms gaps) so CLI detects completion quickly; then 2s, 4s, … cap 15s.
 * @param {number} attemptIndex - Zero-based poll index after initial POST
 * @returns {number}
 */
function nextPollDelayMs(attemptIndex) {
  if (attemptIndex < FAST_POLL_COUNT) {
    return FAST_POLL_INTERVAL_MS;
  }
  const slowIndex = attemptIndex - FAST_POLL_COUNT;
  const raw = SLOW_BASE_INTERVAL_MS * 2 ** Math.max(0, slowIndex);
  return Math.min(raw, MAX_INTERVAL_MS);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function maybeLogPollProgress(envelope, verbosePoll, lastProgressLogAtRef, skipBecauseUi) {
  if (skipBecauseUi || !verbosePoll || !envelope || typeof envelope !== 'object') return;
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

function emitPollProgressLine(
  envelope,
  verbosePoll,
  lastProgressLogAtRef,
  onPollProgress,
  attempt,
  deadline
) {
  const hasPollUi = typeof onPollProgress === 'function';
  maybeLogPollProgress(envelope, verbosePoll, lastProgressLogAtRef, hasPollUi);
  if (hasPollUi) {
    onPollProgress(envelope, attempt, { deadlineMs: deadline });
  }
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
 * @param {boolean} [opts.verbosePoll] - Log throttled progress (plan §3.13); skipped when `onPollProgress` is set
 * @param {Function|null} [opts.onPollProgress] - `(envelope, attemptIndex, { deadlineMs })` each non-terminal poll
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
    pollRequestTimeoutMs,
    onPollProgress = null
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

    emitPollProgressLine(
      envelope,
      verbosePoll,
      lastProgressLogAtRef,
      onPollProgress,
      attempt,
      deadline
    );

    const delay = Math.min(nextPollDelayMs(attempt), Math.max(0, deadline - Date.now()));
    attempt += 1;
    if (delay > 0) {
      await sleep(delay);
    }
  }

  return { envelope, timedOut: true, lastApiResult };
}

module.exports = {
  FAST_POLL_COUNT,
  FAST_POLL_INTERVAL_MS,
  SLOW_BASE_INTERVAL_MS,
  MAX_INTERVAL_MS,
  nextPollDelayMs,
  pollValidationRunUntilComplete,
  isTerminalReportCompleteness
};
