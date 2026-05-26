/**
 * @fileoverview Dataplane auth/url resolution for protection commands.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { resolveControllerUrl } = require('../utils/controller-url');
const { resolveEnvironment } = require('../core/config');
const { getDeviceOnlyAuth, getDeploymentAuth } = require('../utils/token-manager');
const { getDeploymentAuthMode } = require('../utils/deployment-auth-mode');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');

/**
 * @param {Object} [options]
 * @param {string} [options.env]
 * @returns {Promise<{ environment: string, controllerUrl: string, dataplaneUrl: string, authConfig: Object }>}
 */
async function resolveProtectionDataplaneContext(options = {}) {
  const environment = options.env || (await resolveEnvironment());
  const controllerUrl = await resolveControllerUrl();
  if (!controllerUrl) {
    throw new Error('Controller URL is required. Run "aifabrix login" first.');
  }

  const authMode = getDeploymentAuthMode(options);
  let authConfig;
  if (authMode === 'client-credentials') {
    authConfig = await getDeploymentAuth(controllerUrl, environment, 'dataplane', options);
  } else {
    try {
      authConfig = await getDeviceOnlyAuth(controllerUrl);
    } catch {
      authConfig = await getDeploymentAuth(controllerUrl, environment, 'dataplane', options);
    }
  }

  if (!authConfig?.token) {
    throw new Error(
      'Authentication required. Run "aifabrix login" and try again.'
    );
  }

  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
  return { environment, controllerUrl, dataplaneUrl, authConfig };
}

module.exports = {
  resolveProtectionDataplaneContext
};
