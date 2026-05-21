/**
 * @fileoverview Progress line + optional ora spinner for dataplane pipeline upload/publish.
 * @author AI Fabrix Team
 * @version 1.1.0
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
function shouldShowUploadPipelineProgress(options = {}) {
  return options.json !== true;
}

/**
 * @param {Object} [options]
 * @returns {boolean}
 */
function shouldUseUploadPipelineSpinner(options = {}) {
  if (!shouldShowUploadPipelineProgress(options)) {
    return false;
  }
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

/**
 * Plain label for spinner / progress (no glyph).
 * @param {string} systemKey
 * @returns {string}
 */
function buildUploadPipelineSpinnerLabel(systemKey) {
  const key = systemKey && String(systemKey).trim() ? String(systemKey).trim() : 'integration';
  return `Publishing ${key} to dataplane…`;
}

/**
 * @param {string} systemKey
 * @returns {string}
 */
function buildUploadPipelineProgressText(systemKey) {
  return formatProgress(buildUploadPipelineSpinnerLabel(systemKey));
}

/**
 * Run pipeline upload + OpenAPI sync with visible progress (⏳ line or ora with label on TTY).
 *
 * @async
 * @param {Function} work - Zero-arg async function (publish + follow-up I/O)
 * @param {Object} [opts]
 * @param {string} [opts.systemKey]
 * @param {boolean} [opts.json]
 * @returns {Promise<*>}
 */
async function runWithUploadPipelineSpinner(work, opts = {}) {
  if (!shouldShowUploadPipelineProgress(opts)) {
    return work();
  }

  if (!shouldUseUploadPipelineSpinner(opts)) {
    logger.log(buildUploadPipelineProgressText(opts.systemKey));
    return work();
  }

  const ora = require('ora');
  const label = buildUploadPipelineSpinnerLabel(opts.systemKey);
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
  shouldShowUploadPipelineProgress,
  shouldUseUploadPipelineSpinner,
  buildUploadPipelineSpinnerLabel,
  buildUploadPipelineProgressText,
  runWithUploadPipelineSpinner
};
