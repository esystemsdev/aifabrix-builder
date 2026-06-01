/**
 * External System Test Authentication Helpers
 *
 * Authentication setup for integration tests. Uses the dataplane service URL
 * (discovered from the controller), not the external system app's config—external
 * apps do not store a dataplane URL.
 *
 * @fileoverview Authentication helpers for external system testing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDeploymentAuth } = require('../utils/token-manager');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
const { resolveControllerUrl } = require('../utils/controller-url');

/**
 * Setup authentication and get dataplane URL for integration tests.
 * Dataplane URL is always discovered from the controller for the given environment.
 *
 * @async
 * @param {string} appName - Application name (used for auth scope; dataplane URL is discovered from controller)
 * @param {Object} options - Test options; options.environment overrides config env; options.dataplane overrides URL (programmatic only)
 * @param {Object} _config - Configuration object
 * @returns {Promise<Object>} Object with authConfig and dataplaneUrl
 * @throws {Error} If authentication fails
 */
async function setupIntegrationTestAuth(appName, options, _config) {
  const opts = options && typeof options === 'object' ? options : {};
  if (opts.authConfig && opts.dataplaneUrl) {
    return { authConfig: opts.authConfig, dataplaneUrl: opts.dataplaneUrl };
  }

  const { resolveEnvironment } = require('../core/config');
  const environment = (opts.environment && typeof opts.environment === 'string' && opts.environment.trim())
    ? opts.environment.trim()
    : await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  let dataplaneUrl;
  if (opts.dataplane && typeof opts.dataplane === 'string' && opts.dataplane.trim()) {
    dataplaneUrl = opts.dataplane.trim();
  } else {
    dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig, {
      silent: opts.silentResolve === true
    });
  }

  return { authConfig, dataplaneUrl };
}

module.exports = {
  setupIntegrationTestAuth
};

