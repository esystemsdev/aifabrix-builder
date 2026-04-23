/**
 * @fileoverview Transient transport retries for POST validation/run and GET poll.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { postValidationRun, getValidationRun } = require('../api/validation-run.api');

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED']);

/**
 * @param {Object} res - ApiClient-style result
 * @returns {boolean}
 */
function isRetryablePostFailure(res) {
  if (!res || res.success) return false;
  if (!res.network) return false;
  const err = res.originalError;
  if (!err) return false;
  const code = err.code || (err.cause && err.cause.code);
  if (code && RETRYABLE_CODES.has(code)) return true;
  if (err.name === 'AbortError') return true;
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST validation run with up to 2 retries on transient socket/timeout errors (1s / 2s backoff).
 * Does not retry HTTP 4xx/5xx.
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {Object} body
 * @param {Object} [transportOpts] - forwarded to ``postValidationRun`` (e.g. ``timeoutMs``)
 * @returns {Promise<Object>}
 */
async function postValidationRunWithTransportRetry(
  dataplaneUrl,
  authConfig,
  body,
  transportOpts = {}
) {
  let last = await postValidationRun(dataplaneUrl, authConfig, body, transportOpts);
  if (last.success || !isRetryablePostFailure(last)) return last;

  await sleep(1000);
  last = await postValidationRun(dataplaneUrl, authConfig, body, transportOpts);
  if (last.success || !isRetryablePostFailure(last)) return last;

  await sleep(2000);
  return postValidationRun(dataplaneUrl, authConfig, body, transportOpts);
}

/**
 * GET validation run poll with up to 2 retries on transient socket/timeout errors (1s / 2s backoff).
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} testRunId
 * @param {Object} [transportOpts] - forwarded to ``getValidationRun`` (e.g. ``timeoutMs``)
 * @returns {Promise<Object>}
 */
async function getValidationRunWithTransportRetry(
  dataplaneUrl,
  authConfig,
  testRunId,
  transportOpts = {}
) {
  let last = await getValidationRun(dataplaneUrl, authConfig, testRunId, transportOpts);
  if (last.success || !isRetryablePostFailure(last)) return last;

  await sleep(1000);
  last = await getValidationRun(dataplaneUrl, authConfig, testRunId, transportOpts);
  if (last.success || !isRetryablePostFailure(last)) return last;

  await sleep(2000);
  return getValidationRun(dataplaneUrl, authConfig, testRunId, transportOpts);
}

module.exports = {
  isRetryablePostFailure,
  postValidationRunWithTransportRetry,
  getValidationRunWithTransportRetry
};
