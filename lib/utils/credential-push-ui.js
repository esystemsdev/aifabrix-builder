/**
 * @fileoverview Progress line + optional in-place spinner for credential secret push.
 * @author AI Fabrix Team
 * @version 1.2.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const { formatProgress } = require('./cli-test-layout-chalk');

/**
 * @param {Object} [options]
 * @param {boolean} [options.json] - When true, skip progress line and spinner
 * @returns {boolean}
 */
function shouldShowCredentialPushProgress(options = {}) {
  return options.json !== true;
}

/**
 * @param {Object} [options]
 * @returns {boolean}
 */
function shouldUseCredentialPushSpinner(options = {}) {
  if (!shouldShowCredentialPushProgress(options)) {
    return false;
  }
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

/**
 * @param {string} systemKey
 * @returns {string}
 */
function buildCredentialPushSpinnerLabel(systemKey) {
  const key = systemKey && String(systemKey).trim() ? String(systemKey).trim() : 'integration';
  return `Pushing credential secrets for ${key}…`;
}

/**
 * @param {string} systemKey
 * @returns {string}
 */
function buildCredentialPushSpinnerText(systemKey) {
  return formatProgress(buildCredentialPushSpinnerLabel(systemKey));
}

/**
 * Run credential push work with visible progress (⏳ line or ora with label on TTY).
 *
 * @async
 * @param {Function} work - Zero-arg async function performing the push
 * @param {Object} [opts]
 * @param {string} [opts.systemKey]
 * @param {boolean} [opts.json]
 * @returns {Promise<*>}
 */
async function runWithCredentialPushSpinner(work, opts = {}) {
  if (!shouldShowCredentialPushProgress(opts)) {
    return work();
  }

  if (!shouldUseCredentialPushSpinner(opts)) {
    logger.log(buildCredentialPushSpinnerText(opts.systemKey));
    return work();
  }

  const ora = require('ora');
  const label = buildCredentialPushSpinnerLabel(opts.systemKey);
  const spinner = ora({
    text: chalk.white(label),
    spinner: 'dots'
  }).start();

  try {
    return await work();
  } finally {
    spinner.stop();
  }
}

module.exports = {
  shouldShowCredentialPushProgress,
  shouldUseCredentialPushSpinner,
  buildCredentialPushSpinnerLabel,
  buildCredentialPushSpinnerText,
  runWithCredentialPushSpinner
};
