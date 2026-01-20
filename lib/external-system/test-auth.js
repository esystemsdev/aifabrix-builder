/**
 * External System Test Authentication Helpers
 *
 * Authentication setup for integration tests
 *
 * @fileoverview Authentication helpers for external system testing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDeploymentAuth } = require('../utils/token-manager');
const { getDataplaneUrl } = require('../datasource/deploy');
const { resolveControllerUrl } = require('../utils/controller-url');

/**
 * Setup authentication and get dataplane URL for integration tests
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Test options
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Object with authConfig and dataplaneUrl
 * @throws {Error} If authentication fails
 */
async function setupIntegrationTestAuth(appName, options, config) {
  const environment = options.environment || 'dev';
  const controllerUrl = await resolveControllerUrl(options, config);
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  const dataplaneUrl = await getDataplaneUrl(controllerUrl, appName, environment, authConfig);

  return { authConfig, dataplaneUrl };
}

module.exports = {
  setupIntegrationTestAuth
};

