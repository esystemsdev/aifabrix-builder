/**
 * @fileoverview Single reusable module for unified validation POST + optional poll.
 *
 * Used by datasource- and system-scoped CLI flows to enforce plan §9 behavior consistently.
 */

'use strict';

const { extractTestRunId } = require('./validation-run.api');
const { postValidationRunWithTransportRetry } = require('../utils/validation-run-post-retry');
const { pollValidationRunUntilComplete } = require('../utils/validation-run-poll');
const { createValidationPollHandlers } = require('../utils/validation-poll-ui');
const logger = require('../utils/logger');

/**
 * POST /api/v1/validation/run and (when async) poll GET until reportCompleteness is full.
 *
 * @param {Object} opts
 * @param {string} opts.dataplaneUrl
 * @param {Object} opts.authConfig
 * @param {Object} opts.body
 * @param {number} opts.timeoutMs
 * @param {boolean} opts.useAsync
 * @param {boolean} opts.noAsync
 * @param {boolean} [opts.verbosePoll] - Throttled poll lines when no TTY poll UI (see validation-run-poll)
 * @param {Function} [opts.onPollProgress] - Extra hook: `(envelope, attemptIndex, meta)` during poll
 * @returns {Promise<{ envelope: Object|null, apiError: Object|null, pollTimedOut: boolean, incompleteNoAsync: boolean }>}
 */
/* eslint-disable max-lines-per-function, max-statements, complexity -- POST + poll orchestration */
async function postValidationRunAndOptionalPoll(opts) {
  const { dataplaneUrl, authConfig, body, timeoutMs, useAsync, noAsync, verbosePoll } = opts;
  const started = Date.now();
  const transportOpts =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {};
  const postRes = await postValidationRunWithTransportRetry(
    dataplaneUrl,
    authConfig,
    body,
    transportOpts
  );
  if (!postRes.success) {
    return {
      envelope: null,
      apiError: postRes,
      pollTimedOut: false,
      incompleteNoAsync: false
    };
  }

  let envelope = postRes.data;
  const httpStatus = postRes.status;
  const testRunId = extractTestRunId(envelope);
  const completeness = envelope && envelope.reportCompleteness;
  const needsPoll =
    httpStatus === 202 ||
    (testRunId && completeness && completeness !== 'full' && useAsync);

  if (needsPoll && testRunId) {
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, timeoutMs - elapsed);
    const deadlineMs = Date.now() + remaining;

    logger.log('');
    const pollUi = createValidationPollHandlers(deadlineMs);
    const mergeOnPollProgress =
      typeof opts.onPollProgress === 'function'
        ? (envelope, attemptIndex, meta) => {
          pollUi.onPollProgress(envelope, attemptIndex, meta);
          opts.onPollProgress(envelope, attemptIndex, meta);
        }
        : pollUi.onPollProgress;

    try {
      const pollResult = await pollValidationRunUntilComplete({
        dataplaneUrl,
        authConfig,
        testRunId,
        budgetMs: remaining,
        verbosePoll: verbosePoll === true,
        pollRequestTimeoutMs:
          Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
        onPollProgress: mergeOnPollProgress
      });
      if (!pollResult.lastApiResult || !pollResult.lastApiResult.success) {
        return {
          envelope: pollResult.envelope,
          apiError: pollResult.lastApiResult,
          pollTimedOut: pollResult.timedOut,
          incompleteNoAsync: false
        };
      }
      envelope = pollResult.envelope;
      if (pollResult.timedOut) {
        return {
          envelope,
          apiError: null,
          pollTimedOut: true,
          incompleteNoAsync: false
        };
      }
    } finally {
      pollUi.finish();
    }
  }

  if (
    noAsync &&
    envelope &&
    envelope.reportCompleteness &&
    envelope.reportCompleteness !== 'full'
  ) {
    return {
      envelope,
      apiError: null,
      pollTimedOut: false,
      incompleteNoAsync: true
    };
  }

  return {
    envelope,
    apiError: null,
    pollTimedOut: false,
    incompleteNoAsync: false
  };
}
/* eslint-enable max-lines-per-function, max-statements, complexity */

module.exports = { postValidationRunAndOptionalPoll };

