/**
 * @fileoverview Health / TLS failure messages for dev init (keeps dev-init.js under max-lines).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { isLinuxCaSudoRequiredError } = require('./dev-ca-install');

/**
 * True when /health returned a 5xx (server or gateway error). TLS succeeded; app may still be degraded.
 * @param {Error} err - Thrown from getHealth
 * @returns {boolean}
 */
function isHealthHttpServerError(err) {
  const s = err && typeof err.status === 'number' ? err.status : null;
  return s !== null && s >= 500 && s < 600;
}

/**
 * Message when trust/health step fails (avoid calling HTTP 5xx "cannot reach").
 * @param {string} baseUrl - Builder Server URL
 * @param {Error} err - Failure from getHealth or TLS
 * @returns {string}
 */
function formatEnsureServerTrustedFailure(baseUrl, err) {
  const s = err && typeof err.status === 'number' ? err.status : null;
  if (s !== null) {
    const detail = err.message || `HTTP ${s}`;
    if (s >= 500 && s < 600) {
      return (
        `Builder Server at ${baseUrl} returned HTTP ${s} (${detail}) on GET /health. ` +
        'TLS succeeded; the service reported an error or is not fully healthy. Check server logs or open /health in a browser.'
      );
    }
    return (
      `Builder Server at ${baseUrl} returned HTTP ${s} (${detail}) on GET /health. ` +
      'The host was reached but health did not succeed. Check the URL and server configuration.'
    );
  }
  if (isLinuxCaSudoRequiredError(err)) {
    return (
      `Could not add the development CA to the system trust store for ${baseUrl} (Linux needs sudo for that step). ` +
      `${err.message}`
    );
  }
  return `Cannot reach Builder Server at ${baseUrl}. Check URL and network. ${err.message}`;
}

module.exports = {
  isHealthHttpServerError,
  formatEnsureServerTrustedFailure
};
