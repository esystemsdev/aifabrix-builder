/**
 * Dataplane URL Resolver
 *
 * Resolves dataplane URL by discovering from controller
 *
 * @fileoverview Dataplane URL resolution utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { discoverDataplaneUrl } = require('../commands/wizard-dataplane');
const { getDeploymentAuthMode } = require('./deployment-auth-mode');
const { computeAppBaseUrl } = require('./platform-controller-url');

/**
 * @param {string} url
 * @returns {number|null}
 */
function localhostPortFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const normalized = url.replace(/127\.0\.0\.1/g, 'localhost');
  const match = normalized.match(/localhost:(\d+)/);
  if (!match) return null;
  const port = parseInt(match[1], 10);
  return Number.isFinite(port) ? port : null;
}

/**
 * Controller application.url can lag after dev-id changes; prefer builder port formula for localhost.
 * @param {string} discoveredUrl
 * @returns {Promise<string>}
 */
async function alignDiscoveredDataplaneUrl(discoveredUrl) {
  if (!discoveredUrl || !/localhost|127\.0\.0\.1/i.test(discoveredUrl)) {
    return discoveredUrl;
  }
  try {
    const expectedUrl = String(await computeAppBaseUrl('dataplane')).replace(/\/+$/, '');
    const discoveredPort = localhostPortFromUrl(discoveredUrl);
    const expectedPort = localhostPortFromUrl(expectedUrl);
    if (
      discoveredPort !== null &&
      expectedPort !== null &&
      discoveredPort !== expectedPort
    ) {
      return expectedUrl;
    }
  } catch {
    // Keep controller-discovered URL when local app manifest is unavailable.
  }
  return discoveredUrl;
}

/**
 * @returns {string|null}
 */
function dataplaneUrlFromProcessEnv() {
  const raw = process.env.DP || process.env.DATAPLANE_URL;
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  return raw.trim().replace(/\/$/, '');
}

/**
 * Resolve dataplane URL by discovering from controller
 * @async
 * @function resolveDataplaneUrl
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {{ silent?: boolean }} [opts] - Passed to discoverDataplaneUrl
 * @returns {Promise<string>} Resolved dataplane URL
 * @throws {Error} If dataplane URL cannot be resolved
 */
async function resolveDataplaneUrl(controllerUrl, environment, authConfig, opts = {}) {
  const envUrl = dataplaneUrlFromProcessEnv();
  if (envUrl && getDeploymentAuthMode(opts) === 'client-credentials') {
    return envUrl;
  }
  const discovered = await discoverDataplaneUrl(controllerUrl, environment, authConfig, opts);
  return alignDiscoveredDataplaneUrl(discovered);
}

module.exports = {
  resolveDataplaneUrl
};
