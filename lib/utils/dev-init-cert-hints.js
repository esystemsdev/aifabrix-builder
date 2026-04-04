/**
 * @fileoverview Cert troubleshooting hints for dev init (keeps dev-init.js under max-lines).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const { getCertDir } = require('./dev-cert-helper');
const logger = require('./logger');

/**
 * Message for 400 Bad Request: nginx often forwards X-Client-Cert with literal newlines.
 * @returns {string} Hint for server-side nginx fix
 */
function getBadRequestHint() {
  return 'Bad Request (400) often means the server\'s nginx is forwarding the client certificate with literal newlines in X-Client-Cert. On the server, use nginx njs to escape newlines (see .cursor/plans/builder-cli.md §5).';
}

/**
 * Log a one-line hint for cert troubleshooting (curl test and docs).
 * @param {string} configDir - Config directory
 * @param {string} devId - Developer ID
 * @param {string} baseUrl - Builder Server base URL
 */
function logCertTroubleshootingHint(configDir, devId, baseUrl) {
  const certDir = getCertDir(configDir, devId);
  const certPath = path.join(certDir, 'cert.pem');
  const keyPath = path.join(certDir, 'key.pem');
  logger.log(chalk.gray(`  Test with: curl -v --cert ${certPath} --key ${keyPath} ${baseUrl}/api/dev/settings`));
  logger.log(chalk.gray('  See .cursor/plans/builder-cli.md §5 for 200 vs 401 vs 400 and nginx/server fix.'));
}

module.exports = {
  getBadRequestHint,
  logCertTroubleshootingHint
};
