/**
 * Read per-application environmentScopedResources from application.yaml (or json).
 *
 * @fileoverview Plan 117 application gate
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { loadConfigFile } = require('./config-format');
const { resolveApplicationConfigPath } = require('./app-config-resolver');

/**
 * @param {string|null|undefined} appPath - Builder app directory
 * @returns {boolean} True when application.yaml sets environmentScopedResources: true
 */
function readAppEnvironmentScopedFlagForAppPath(appPath) {
  if (!appPath || typeof appPath !== 'string') {
    return false;
  }
  try {
    const cfgPath = resolveApplicationConfigPath(appPath);
    const cfg = loadConfigFile(cfgPath);
    return cfg.environmentScopedResources === true;
  } catch {
    return false;
  }
}

module.exports = { readAppEnvironmentScopedFlagForAppPath };
