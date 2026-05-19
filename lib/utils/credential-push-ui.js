/**
 * @fileoverview TTY ora spinner for credential secret push (upload / credential push).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { formatProgress } = require('./cli-test-layout-chalk');

/**
 * @param {Object} [options]
 * @param {boolean} [options.json] - When true, skip spinner
 * @returns {boolean}
 */
function shouldUseCredentialPushSpinner(options = {}) {
  if (options.json === true) {
    return false;
  }
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

/**
 * @param {string} systemKey
 * @returns {string}
 */
function buildCredentialPushSpinnerText(systemKey) {
  const key = systemKey && String(systemKey).trim() ? String(systemKey).trim() : 'integration';
  return formatProgress(`Pushing credential secrets for ${key}…`);
}

/**
 * Run credential push work behind a TTY spinner (skipped when non-TTY or --json).
 *
 * @async
 * @param {Function} work - Zero-arg async function performing the push
 * @param {Object} [opts]
 * @param {string} [opts.systemKey]
 * @param {boolean} [opts.json]
 * @returns {Promise<*>}
 */
async function runWithCredentialPushSpinner(work, opts = {}) {
  if (!shouldUseCredentialPushSpinner(opts)) {
    return work();
  }

  const ora = require('ora');
  const spinner = ora({
    text: buildCredentialPushSpinnerText(opts.systemKey),
    spinner: 'dots'
  }).start();

  try {
    return await work();
  } finally {
    spinner.stop();
  }
}

module.exports = {
  shouldUseCredentialPushSpinner,
  buildCredentialPushSpinnerText,
  runWithCredentialPushSpinner
};
