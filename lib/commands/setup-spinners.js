/**
 * Spinner helpers for `aifabrix setup` mode handlers.
 *
 * @fileoverview TTY progress spinners for setup commands
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const ora = require('ora');
const logger = require('../utils/logger');
const { formatProgress, formatSuccessLine } = require('../utils/cli-test-layout-chalk');

function shouldUseSpinner() {
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

function startSpinner(text) {
  if (!shouldUseSpinner()) {
    logger.log(formatProgress(text));
    return null;
  }
  return ora({ text, spinner: 'dots' }).start();
}

function stopSpinnerSuccess(spinner, text) {
  if (!spinner) {
    logger.log(formatSuccessLine(text));
    return;
  }
  spinner.succeed(text);
}

module.exports = {
  shouldUseSpinner,
  startSpinner,
  stopSpinnerSuccess
};
