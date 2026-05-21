/**
 * @fileoverview Bounded poll until audit execution rows are captured (407.3)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { executionRowCaptured } = require('./audit-evidence-matrix-rows');

const DEFAULT_MAX_WAIT_MS = 15000;
const DEFAULT_INTERVAL_MS = 2000;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {Array} executions
 * @param {number} minExpected
 * @returns {boolean}
 */
function executionsReady(executions, minExpected) {
  if (!Array.isArray(executions) || executions.length < minExpected) return false;
  const captured = executions.filter(executionRowCaptured).length;
  return captured >= minExpected;
}

/**
 * @param {Array} executions
 * @param {string[]} executionIds
 * @returns {boolean}
 */
function allEnvelopeIdsPresent(executions, executionIds) {
  if (!Array.isArray(executionIds) || !executionIds.length) return true;
  const found = new Set(
    (executions || []).map(e => (e && e.id ? String(e.id) : '')).filter(Boolean)
  );
  return executionIds.every(id => found.has(String(id)));
}

/**
 * E2E: wait until envelope executionIds are visible and captured in list API.
 * @param {Array} executions
 * @param {number} minExpected
 * @param {string[]} [executionIds]
 * @returns {boolean}
 */
function executionsReadyForVerify(executions, minExpected, executionIds) {
  const min = Math.max(1, minExpected || 1);
  if (Array.isArray(executionIds) && executionIds.length) {
    const need = Math.min(min, executionIds.length);
    if (!allEnvelopeIdsPresent(executions, executionIds)) return false;
    const captured = executionIds.filter(id =>
      (executions || []).some(
        e => String(e.id) === String(id) && executionRowCaptured(e)
      )
    ).length;
    return captured >= need;
  }
  return executionsReady(executions, min);
}

/**
 * @async
 * @param {Object} opts
 * @param {() => Promise<{ data: Array, meta: Object|null }>} opts.fetchExecutions
 * @param {number} opts.minExpected
 * @param {number} [opts.maxWaitMs]
 * @param {number} [opts.intervalMs]
 * @returns {Promise<{ data: Array, meta: Object|null, timedOut: boolean }>}
 */
async function pollExecutionsUntilReady(opts) {
  const minExpected = Math.max(1, opts.minExpected || 1);
  const executionIds = Array.isArray(opts.executionIds) ? opts.executionIds : [];
  const maxWaitMs =
    opts.maxWaitMs !== undefined && opts.maxWaitMs !== null ? opts.maxWaitMs : DEFAULT_MAX_WAIT_MS;
  const intervalMs =
    opts.intervalMs !== undefined && opts.intervalMs !== null
      ? opts.intervalMs
      : DEFAULT_INTERVAL_MS;
  const deadline = Date.now() + maxWaitMs;
  let last = { data: [], meta: null };

  while (Date.now() <= deadline) {
    last = await opts.fetchExecutions();
    if (executionsReadyForVerify(last.data, minExpected, executionIds)) {
      return { ...last, timedOut: false };
    }
    if (Date.now() + intervalMs > deadline) break;
    await sleep(intervalMs);
  }

  return { ...last, timedOut: true };
}

module.exports = {
  DEFAULT_MAX_WAIT_MS,
  DEFAULT_INTERVAL_MS,
  sleep,
  executionsReady,
  allEnvelopeIdsPresent,
  executionsReadyForVerify,
  pollExecutionsUntilReady
};
