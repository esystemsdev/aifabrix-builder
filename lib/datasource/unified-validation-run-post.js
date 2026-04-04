/**
 * @fileoverview POST + optional poll for unified validation run (keeps main module small).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { extractTestRunId } = require('../api/validation-run.api');
const { postValidationRunWithTransportRetry } = require('../utils/validation-run-post-retry');
const { pollValidationRunUntilComplete } = require('../utils/validation-run-poll');

/**
 * @param {Object} opts
 * @param {string} opts.dataplaneUrl
 * @param {Object} opts.authConfig
 * @param {Object} opts.body
 * @param {number} opts.timeoutMs
 * @param {boolean} opts.useAsync
 * @param {boolean} opts.noAsync
 * @returns {Promise<{ envelope: Object|null, apiError: Object|null, pollTimedOut: boolean, incompleteNoAsync: boolean }>}
 */
/* eslint-disable max-lines-per-function, max-statements, complexity -- POST + poll orchestration (plan 115) */
async function postValidationRunAndOptionalPoll(opts) {
  const { dataplaneUrl, authConfig, body, timeoutMs, useAsync, noAsync } = opts;
  const started = Date.now();
  const postRes = await postValidationRunWithTransportRetry(dataplaneUrl, authConfig, body);
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
    const pollResult = await pollValidationRunUntilComplete({
      dataplaneUrl,
      authConfig,
      testRunId,
      budgetMs: remaining
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
