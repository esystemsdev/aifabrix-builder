/**
 * TTY ora spinner for slow agent metadata validation POST (non-cached path).
 *
 * @fileoverview Agent trust wait presentation (aligned with validation-poll-ui)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');

function shouldUseAgentTrustWaitSpinner() {
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

/**
 * @param {string} [datasourceKey]
 * @param {number} deadlineMs
 * @returns {string}
 */
function buildAgentTrustWaitSpinnerText(datasourceKey, deadlineMs) {
  const remainingSec = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  const key =
    datasourceKey && String(datasourceKey).trim() ? String(datasourceKey).trim() : 'datasource';
  return `Waiting for semantic trust validation… ${key} (~${remainingSec}s left)`;
}

/**
 * Run a blocking validate POST behind a TTY spinner (skipped when not a TTY).
 *
 * @async
 * @param {Function} work - Zero-arg async function performing the HTTP call
 * @param {Object} opts
 * @param {string} [opts.datasourceKey]
 * @param {number} opts.timeoutMs
 * @returns {Promise<*>}
 */
async function runWithAgentTrustWaitSpinner(work, opts = {}) {
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : 120000;
  const deadlineMs = Date.now() + timeoutMs;
  const datasourceKey = opts.datasourceKey;

  if (!shouldUseAgentTrustWaitSpinner()) {
    return work();
  }

  const ora = require('ora');
  const spinner = ora({
    text: buildAgentTrustWaitSpinnerText(datasourceKey, deadlineMs),
    spinner: 'dots'
  }).start();

  const tick = setInterval(() => {
    spinner.text = buildAgentTrustWaitSpinnerText(datasourceKey, deadlineMs);
  }, 1000);

  try {
    return await work();
  } finally {
    clearInterval(tick);
    spinner.stop();
  }
}

const NON_TTY_LOG_MS = 5000;

/**
 * Optional one-line hint on non-TTY before a slow validate (throttled by caller usage).
 *
 * @param {string} [datasourceKey]
 * @param {number} timeoutMs
 */
function logAgentTrustWaitHintOnce(datasourceKey, timeoutMs) {
  if (shouldUseAgentTrustWaitSpinner()) return;
  const budgetSec = Math.max(1, Math.ceil(timeoutMs / 1000));
  const key =
    datasourceKey && String(datasourceKey).trim() ? String(datasourceKey).trim() : 'datasource';
  logger.log(
    chalk.gray(
      `Waiting for semantic trust validation… ${key} (may take up to ~${budgetSec}s; not cached)`
    )
  );
}

module.exports = {
  shouldUseAgentTrustWaitSpinner,
  buildAgentTrustWaitSpinnerText,
  runWithAgentTrustWaitSpinner,
  logAgentTrustWaitHintOnce,
  NON_TTY_LOG_MS
};
