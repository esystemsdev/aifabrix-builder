/**
 * Controller URL Resolution Utilities
 *
 * Provides utilities for resolving controller URLs with developer ID-based defaults
 * and fallback chain support.
 *
 * @fileoverview Controller URL resolution utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDeveloperIdNumber } = require('./env-map');
const devConfig = require('./dev-config');

/**
 * Calculate default controller URL based on developer ID
 * Uses getDevPorts to get the app port which is adjusted by developer ID
 * Developer ID 0 = http://localhost:3000
 * Developer ID 1 = http://localhost:3100
 * Developer ID 2 = http://localhost:3200
 * @async
 * @function getDefaultControllerUrl
 * @returns {Promise<string>} Default controller URL
 */
async function getDefaultControllerUrl() {
  const developerId = await getDeveloperIdNumber(null);
  const ports = devConfig.getDevPorts(developerId);
  return `http://localhost:${ports.app}`;
}

/**
 * Resolve controller URL with fallback chain
 * Priority:
 * 1. options.controller (explicit option)
 * 2. config.deployment?.controllerUrl (from config)
 * 3. getDefaultControllerUrl() (developer ID-based default)
 * @async
 * @function resolveControllerUrl
 * @param {Object} options - Command options
 * @param {string} [options.controller] - Explicit controller URL option
 * @param {Object} config - Configuration object
 * @param {Object} [config.deployment] - Deployment configuration
 * @param {string} [config.deployment.controllerUrl] - Controller URL from config
 * @returns {Promise<string>} Resolved controller URL
 */
async function resolveControllerUrl(options, config) {
  // Priority 1: Explicit option
  if (options && (options.controller || options.url)) {
    const explicitUrl = options.controller || options.url;
    if (explicitUrl) {
      return explicitUrl.replace(/\/$/, '');
    }
  }

  // Priority 2: Config file
  if (config?.deployment?.controllerUrl) {
    return config.deployment.controllerUrl.replace(/\/$/, '');
  }

  // Priority 3: Developer ID-based default
  return await getDefaultControllerUrl();
}

module.exports = {
  getDefaultControllerUrl,
  resolveControllerUrl
};
