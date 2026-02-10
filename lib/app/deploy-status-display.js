/**
 * Deploy status display helpers: build app URL from controller/port and show after deploy.
 * @fileoverview Status URL display for application deployment
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { getApplicationStatus } = require('../api/applications.api');

/**
 * Builds app URL from controller base URL and app port (e.g. http://localhost:3600 + 3601 -> http://localhost:3601).
 * @param {string} controllerUrl - Controller base URL
 * @param {number} port - Application port
 * @returns {string|null} App URL or null if parsing fails
 */
function buildAppUrlFromControllerAndPort(controllerUrl, port) {
  if (!controllerUrl || (port === null || port === undefined) || typeof port !== 'number') return null;
  try {
    const u = new URL(controllerUrl);
    u.port = String(port);
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Parses URL and port from application status response body.
 * @param {Object} body - Response body (may have data wrapper or top-level url/port)
 * @returns {{ url: string|null, port: number|null }}
 */
function parseUrlAndPortFromStatusBody(body) {
  const data = body?.data ?? body;
  const url = (data && typeof data.url === 'string' && data.url.trim() !== '')
    ? data.url
    : (body?.url && typeof body.url === 'string' && body.url.trim() !== '')
      ? body.url
      : null;
  const port = (data && typeof data.port === 'number')
    ? data.port
    : (body && typeof body.port === 'number')
      ? body.port
      : null;
  return { url, port };
}

/**
 * Fetches app URL from controller application status and displays it.
 * Uses status API url when present; otherwise derives from status port and controller host.
 * @param {string} controllerUrl - Controller base URL (used only to derive host when status returns port)
 * @param {string} envKey - Environment key
 * @param {string} appKey - Application key (manifest.key)
 * @param {Object} authConfig - Auth used for deployment (same as for status)
 */
async function displayAppUrlFromController(controllerUrl, envKey, appKey, authConfig) {
  let url = null;
  let port = null;
  try {
    const res = await getApplicationStatus(controllerUrl, envKey, appKey, authConfig);
    const parsed = parseUrlAndPortFromStatusBody(res?.data);
    url = parsed.url;
    port = parsed.port;
  } catch (_) {
    // Show fallback message below
  }
  if (!url && (port !== null && port !== undefined)) {
    url = buildAppUrlFromControllerAndPort(controllerUrl, port);
  }
  if (url) {
    logger.log(chalk.green(`   ✓ App running at ${url}`));
  } else {
    logger.log(chalk.blue('   ✓ App deployed. Get URL from controller dashboard.'));
  }
}

module.exports = { displayAppUrlFromController, buildAppUrlFromControllerAndPort, parseUrlAndPortFromStatusBody };
