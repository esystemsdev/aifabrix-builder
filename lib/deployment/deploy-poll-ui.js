/**
 * TTY ora spinner + non-TTY lines for deploy pipeline polling (aligned with guided infra commands).
 *
 * @fileoverview Deploy poll presentation helpers
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const ora = require('ora');
const logger = require('../utils/logger');
const { buildDeployPollSpinnerText } = require('./deployer-status');

function shouldUseDeployPollSpinner() {
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

/**
 * @param {number} maxAttempts - Max polling attempts (shown in UI)
 * @returns {{ onPollProgress: Function, finish: () => void }}
 */
function createDeployPollHandlers(maxAttempts) {
  if (shouldUseDeployPollSpinner()) {
    const spinner = ora({
      text: buildDeployPollSpinnerText(null, 0, maxAttempts),
      spinner: 'dots'
    }).start();
    return {
      onPollProgress: (deploymentData, attempt, maxA) => {
        spinner.text = buildDeployPollSpinnerText(deploymentData, attempt, maxA);
      },
      finish: () => {
        spinner.stop();
      }
    };
  }
  return {
    onPollProgress: (deploymentData, attempt, maxA) => {
      const status = deploymentData.status ?? 'pending';
      const progress = deploymentData.progress ?? 0;
      logger.log(chalk.gray(`Status: ${status} (${progress}%) (attempt ${attempt + 1}/${maxA})`));
    },
    finish: () => {}
  };
}

module.exports = {
  createDeployPollHandlers,
  shouldUseDeployPollSpinner
};
