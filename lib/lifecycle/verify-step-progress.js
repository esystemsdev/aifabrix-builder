/**
 * Active progress (ora spinner or single ⏳ line) for verify-* orchestration steps.
 *
 * @fileoverview Verify step progress UI
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { formatProgress } = require('../utils/cli-test-layout-chalk');
const { withQuietLogs } = require('./logger-quiet');

/**
 * @param {Object} [options]
 * @returns {boolean}
 */
function shouldShowVerifyStepProgress(options = {}) {
  return options.json !== true;
}

/**
 * @param {Object} [options]
 * @returns {boolean}
 */
function shouldUseVerifyStepSpinner(options = {}) {
  if (!shouldShowVerifyStepProgress(options)) {
    return false;
  }
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

/**
 * @param {string} label
 * @returns {string}
 */
function formatVerifyStepLabel(label) {
  const text = label && String(label).trim() ? String(label).trim() : 'Processing';
  return text.endsWith('…') ? text : `${text}…`;
}

/**
 * Run a verify step with one active progress indicator (spinner on TTY).
 *
 * @template T
 * @async
 * @param {string} label - Plain label without trailing ellipsis
 * @param {(progress: { setLabel: (next: string) => void }) => Promise<T>} work
 * @param {Object} [options]
 * @param {boolean} [options.json]
 * @returns {Promise<T>}
 */
async function runWithVerifyStepProgress(label, work, options = {}) {
  if (!shouldShowVerifyStepProgress(options)) {
    return withQuietLogs(() => work({ setLabel: () => {} }));
  }

  if (!shouldUseVerifyStepSpinner(options)) {
    logger.log(formatProgress(formatVerifyStepLabel(label)));
    return withQuietLogs(() => work({ setLabel: () => {} }));
  }

  const ora = require('ora');
  const spinner = ora({
    text: chalk.white(formatVerifyStepLabel(label)),
    spinner: 'dots'
  }).start();

  const setLabel = (next) => {
    spinner.text = chalk.white(formatVerifyStepLabel(next));
  };

  try {
    return await withQuietLogs(() => work({ setLabel }));
  } finally {
    spinner.stop();
  }
}

module.exports = {
  shouldShowVerifyStepProgress,
  shouldUseVerifyStepSpinner,
  formatVerifyStepLabel,
  runWithVerifyStepProgress
};
