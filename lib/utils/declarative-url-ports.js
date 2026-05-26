/**
 * Host port math for declarative url:// resolution (plan 122).
 *
 * @fileoverview publishedHostPort vs localHostPort from manifest port + developer-id
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {string|number|null|undefined} raw - developer-id from config
 * @returns {number} Numeric id; non-numeric or empty → 0
 */
function parseDeveloperIdNum(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return 0;
  }
  const parsed = parseInt(String(raw).trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Host port for compose publish, localhost URLs, and health checks: port + devId×100 (dev 0 → base port).
 * @param {number} appPort - Manifest listen port
 * @param {number} developerIdNum
 * @returns {number}
 */
function publishedHostPort(appPort, developerIdNum) {
  return appPort + developerIdNum * 100;
}

/**
 * Same as {@link publishedHostPort} (legacy name kept for call sites).
 * @param {number} appPort
 * @param {number} developerIdNum
 * @returns {number}
 */
function localHostPort(appPort, developerIdNum) {
  return publishedHostPort(appPort, developerIdNum);
}

module.exports = {
  parseDeveloperIdNum,
  publishedHostPort,
  localHostPort
};
