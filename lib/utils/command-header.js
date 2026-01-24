/**
 * Command Header Display Utility
 *
 * Displays active configuration (controller, environment, dataplane) at top of commands
 *
 * @fileoverview Command header display utility
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');

/**
 * Display command header with active configuration
 * @function displayCommandHeader
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {string} [dataplaneUrl] - Dataplane URL (optional)
 */
function displayCommandHeader(controllerUrl, environment, dataplaneUrl) {
  const parts = [];

  if (controllerUrl) {
    parts.push(`Controller: ${chalk.cyan(controllerUrl)}`);
  }

  if (environment) {
    parts.push(`Environment: ${chalk.cyan(environment)}`);
  }

  if (dataplaneUrl) {
    parts.push(`Dataplane: ${chalk.cyan(dataplaneUrl)}`);
  }

  if (parts.length > 0) {
    logger.log(chalk.gray(`\n${parts.join(' | ')}\n`));
  }
}

module.exports = {
  displayCommandHeader
};
