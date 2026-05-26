/**
 * Deployment auth mode for pipeline publish / external integration CLI.
 * @fileoverview AIFABRIX_DEPLOYMENT_AUTH and options.deploymentAuth parsing
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @typedef {'auto'|'client-credentials'|'device'} DeploymentAuthMode
 */

/**
 * @param {Object} [options] - CLI or caller options
 * @returns {DeploymentAuthMode}
 */
function getDeploymentAuthMode(options = {}) {
  const raw = options.deploymentAuth || process.env.AIFABRIX_DEPLOYMENT_AUTH || 'auto';
  const mode = String(raw).trim().toLowerCase().replace(/_/g, '-');
  if (mode === 'client-credentials' || mode === 'client') {
    return 'client-credentials';
  }
  if (mode === 'device' || mode === 'device-token' || mode === 'bearer') {
    return 'device';
  }
  return 'auto';
}

/**
 * @param {DeploymentAuthMode} mode
 * @returns {boolean}
 */
function shouldUseDeviceTokenForDeployment(mode) {
  return mode !== 'client-credentials';
}

module.exports = {
  getDeploymentAuthMode,
  shouldUseDeviceTokenForDeployment
};
