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
 * Docker published host port: port + devId*100 (dev 0 → base port).
 * @param {number} appPort - Manifest listen port
 * @param {number} developerIdNum
 * @returns {number}
 */
function publishedHostPort(appPort, developerIdNum) {
  return appPort + developerIdNum * 100;
}

/**
 * Local workstation host port: port + 10 + devId*100 (dev 0 → port+10).
 * @param {number} appPort
 * @param {number} developerIdNum
 * @returns {number}
 */
function localHostPort(appPort, developerIdNum) {
  return appPort + 10 + developerIdNum * 100;
}

module.exports = {
  parseDeveloperIdNum,
  publishedHostPort,
  localHostPort
};
