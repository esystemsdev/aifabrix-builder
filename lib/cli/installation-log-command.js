/**
 * Shared completion hook for infra/platform CLI commands (installation.log).
 *
 * @fileoverview installation.log CLI helper
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const config = require('../core/config');
const installationLog = require('../utils/installation-log');

/**
 * @param {Object} params
 * @param {string} params.command
 * @param {Object} params.options
 * @param {Date} params.startedAt
 * @param {'success'|'failure'} params.outcome
 * @param {Error} [params.error]
 * @param {string[]} [params.platformAppList]
 * @param {Object} [params.cleanup]
 * @param {boolean} [params.upPlatformForce]
 * @param {boolean} [params.omitInfraSection]
 * @returns {Promise<void>}
 */
async function recordInfraInstallationCommand(params) {
  const {
    command,
    options,
    startedAt,
    outcome,
    error,
    platformAppList,
    cleanup,
    upPlatformForce,
    omitInfraSection
  } = params;

  const completedAt = new Date();
  let cfg = {};
  try {
    cfg = await config.getConfig();
  } catch {
    cfg = {};
  }

  try {
    await installationLog.appendInstallationRecord({
      command,
      outcome,
      startedAt,
      completedAt,
      options,
      infra: !omitInfraSection && cfg ? { cfg, options } : undefined,
      platformAppList,
      cleanup,
      upPlatformForce: upPlatformForce === true,
      configExtra: {
        controllerUrl: await installationLog.resolveControllerUrlForLog(),
        adminEmail: await installationLog.resolveAdminEmailPresence()
      },
      error,
      errorCode: error && error.code ? String(error.code) : undefined
    });
  } catch {
    // never block CLI on log failure
  }
}

module.exports = {
  recordInfraInstallationCommand
};
