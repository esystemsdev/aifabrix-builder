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
  return await discoverDataplaneUrl(controllerUrl, environment, authConfig, opts);
}

module.exports = {
  resolveDataplaneUrl
};
