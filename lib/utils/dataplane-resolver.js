/**
 * Dataplane URL Resolver
 *
 * Resolves dataplane URL by discovering from controller
 *
 * @fileoverview Dataplane URL resolution utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const config = require('../core/config');
const { discoverDataplaneUrl } = require('../commands/wizard-dataplane');
const { APP_SERVICE_ENV_DEFAULTS_LOCAL } = require('./infra-env-defaults');

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
 * Local host port for dataplane: DATAPLANE_PUBLIC_PORT (3011) + developerId×100.
 * Not application.yaml `port` (3001 container listen) — that yields the wrong host port (e.g. 3601 for dev06).
 * @returns {Promise<string>}
 */
async function expectedLocalDataplaneBaseUrl() {
  const developerIdRaw = await config.getDeveloperId();
  const idNum =
    typeof developerIdRaw === 'string'
      ? parseInt(developerIdRaw, 10)
      : Number(developerIdRaw);
  const devId = Number.isFinite(idNum) && idNum >= 0 ? idNum : 0;
  const basePort = APP_SERVICE_ENV_DEFAULTS_LOCAL.DATAPLANE_PUBLIC_PORT;
  return `http://localhost:${basePort + devId * 100}`;
}

/**
 * Controller application.url can lag after dev-id changes; prefer builder host port formula for localhost.
 * @param {string} discoveredUrl
 * @returns {Promise<string>}
 */
async function alignDiscoveredDataplaneUrl(discoveredUrl) {
  if (!discoveredUrl || !/localhost|127\.0\.0\.1/i.test(discoveredUrl)) {
    return discoveredUrl;
  }
  try {
    const expectedUrl = await expectedLocalDataplaneBaseUrl();
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
    // Keep controller-discovered URL when developer config is unavailable.
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
  if (envUrl) {
    return envUrl;
  }
  const discovered = await discoverDataplaneUrl(controllerUrl, environment, authConfig, opts);
  return alignDiscoveredDataplaneUrl(discovered);
}

module.exports = {
  resolveDataplaneUrl,
  expectedLocalDataplaneBaseUrl,
  alignDiscoveredDataplaneUrl
};
