/**
 * Token refresh failure message formatting and once-per-URL warning (used by token-manager).
 * @fileoverview Token manager message helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const config = require('../core/config');
const logger = require('./logger');

/** Network-style error messages that indicate controller unreachable (not token expiry). */
const NETWORK_ERROR_PATTERNS = [
  'fetch failed',
  'econnrefused',
  'enotfound',
  'etimedout',
  'network',
  'unreachable',
  'timed out'
];

/** Controller URLs we have already logged a refresh-failure warning for this process. */
const refreshFailureWarnedUrls = new Set();

/**
 * Returns a user-facing message for token refresh failure; adds a hint when the error looks like a connectivity issue.
 * @param {string} errorMessage - Raw error message
 * @param {string} [controllerUrl] - Controller URL for the hint
 * @returns {string} Message to log
 */
function formatRefreshFailureMessage(errorMessage, controllerUrl) {
  const lower = (errorMessage || '').toLowerCase();
  const isNetwork = NETWORK_ERROR_PATTERNS.some(p => lower.includes(p));
  const hint = isNetwork
    ? (controllerUrl
      ? ` The controller at ${controllerUrl} may be unreachable—ensure it is running and try again, or run 'aifabrix login' once it is available.`
      : ' The controller may be unreachable—ensure it is running and try again, or run \'aifabrix login\' once it is available.')
    : '';
  return `${errorMessage}${hint}`;
}

/**
 * Log device token refresh failure once per controller URL per process.
 * @param {string} controllerUrl - Controller URL (for dedupe key and message)
 * @param {string} errorMessage - Raw error message
 */
function warnRefreshFailureOnce(controllerUrl, errorMessage) {
  const key = (controllerUrl && typeof controllerUrl === 'string' && controllerUrl.trim())
    ? config.normalizeControllerUrl(controllerUrl)
    : '__no_url__';
  if (refreshFailureWarnedUrls.has(key)) {
    return;
  }
  refreshFailureWarnedUrls.add(key);
  logger.warn(`Failed to refresh device token: ${formatRefreshFailureMessage(errorMessage, controllerUrl)}`);
}

module.exports = {
  formatRefreshFailureMessage,
  warnRefreshFailureOnce
};
