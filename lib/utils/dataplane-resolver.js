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

/**
 * Resolve dataplane URL by discovering from controller
 * @async
 * @function resolveDataplaneUrl
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<string>} Resolved dataplane URL
 * @throws {Error} If dataplane URL cannot be resolved
 */
async function resolveDataplaneUrl(controllerUrl, environment, authConfig) {
  return await discoverDataplaneUrl(controllerUrl, environment, authConfig);
}

module.exports = {
  resolveDataplaneUrl
};
