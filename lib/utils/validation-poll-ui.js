/**
 * TTY ora spinner + throttled non-TTY lines for unified validation run polling (aligned with deploy-poll-ui).
 *
 * @fileoverview Validation run poll presentation helpers
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');

function shouldUseValidationPollSpinner() {
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

/**
 * Single-line ora text / log line for validation polling.
 *
 * @param {Object|null|undefined} envelope - Latest GET envelope (optional before first poll tick)
 * @param {number} attemptIndex - Zero-based poll index after initial POST
 * @param {number} deadlineMs - Wall-clock deadline (Date.now() + remaining budget)
 * @returns {string}
 */
function buildValidationPollSpinnerText(envelope, attemptIndex, deadlineMs) {
  const remainingSec = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  if (!envelope || typeof envelope !== 'object') {
    return `Waiting for validation run… starting (budget ~${remainingSec}s)`;
  }
  const c =
    envelope.reportCompleteness !== undefined && envelope.reportCompleteness !== null
      ? String(envelope.reportCompleteness)
      : '?';
  const st =
    envelope.status !== undefined && envelope.status !== null ? String(envelope.status) : '?';
  return `Waiting for validation run… completeness=${c} status=${st} (poll ${attemptIndex + 1} · ~${remainingSec}s left)`;
}

const NON_TTY_THROTTLE_MS = 5000;

/**
 * @param {number} deadlineMs - Absolute deadline for poll budget display
 * @returns {{ usesSpinner: boolean, onPollProgress: Function, finish: () => void }}
 */
function createValidationPollHandlers(deadlineMs) {
  if (shouldUseValidationPollSpinner()) {
    const ora = require('ora');
    const spinner = ora({
      text: buildValidationPollSpinnerText(null, 0, deadlineMs),
      spinner: 'dots'
    }).start();
    return {
      usesSpinner: true,
      onPollProgress: (envelope, attemptIndex, _meta) => {
        spinner.text = buildValidationPollSpinnerText(envelope, attemptIndex, deadlineMs);
      },
      finish: () => {
        spinner.stop();
      }
    };
  }

  let lastNonTtyLogAt = 0;
  return {
    usesSpinner: false,
    onPollProgress: (envelope, attemptIndex, _meta) => {
      const now = Date.now();
      if (now - lastNonTtyLogAt < NON_TTY_THROTTLE_MS) return;
      lastNonTtyLogAt = now;
      logger.log(chalk.gray(buildValidationPollSpinnerText(envelope, attemptIndex, deadlineMs)));
    },
    finish: () => {}
  };
}

module.exports = {
  createValidationPollHandlers,
  shouldUseValidationPollSpinner,
  buildValidationPollSpinnerText
};
