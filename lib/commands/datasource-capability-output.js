/**
 * Shared success footer for datasource capability mutating commands.
 *
 * @fileoverview capability CLI output footer
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const logger = require('../utils/logger');
const { formatBulletSection, formatNextActions } = require('../utils/cli-test-layout-chalk');

/**
 * @param {string} resolvedPath
 * @param {string[]} updatedSections
 * @param {string} [heading='Updated']
 * @returns {void}
 */
function printCapabilitySuccessFooter(resolvedPath, updatedSections, heading = 'Updated') {
  const display =
    resolvedPath.includes(' ') ? `"${resolvedPath}"` : resolvedPath;
  logger.log('');
  logger.log(formatBulletSection(`${heading}:`, updatedSections));
  logger.log('');
  logger.log(formatNextActions([`aifabrix datasource validate ${display}`]));
}

module.exports = {
  printCapabilitySuccessFooter
};
