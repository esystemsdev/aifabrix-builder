/**
 * Pipeline deployment polling intervals based on controller DEPLOYMENT mode.
 *
 * Miso-controller exposes `deploymentType` on GET /api/v1/health (azure | azure-mock | local | database).
 * Local/database installs finish quickly; use a shorter poll interval unless the user overrides.
 *
 * @fileoverview Resolve poll interval from controller deployment mode
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const FAST_POLL_MS = 1000;
const STANDARD_POLL_MS = 5000;

/**
 * @param {string} [deploymentType] - From controller health: deploymentType
 * @returns {boolean}
 */
function isFastPollingDeploymentType(deploymentType) {
  if (!deploymentType || typeof deploymentType !== 'string') {
    return false;
  }
  const t = deploymentType.trim().toLowerCase();
  return t === 'local' || t === 'database';
}

/**
 * @param {string} [deploymentType] - Controller deploymentType
 * @param {number|string|undefined|null} explicitPollInterval - User/config override (ms)
 * @returns {number}
 */
function resolvePollIntervalMs(deploymentType, explicitPollInterval) {
  const n =
    explicitPollInterval !== undefined && explicitPollInterval !== null
      ? Number(explicitPollInterval)
      : NaN;
  if (Number.isFinite(n) && n > 0) {
    return n;
  }
  return isFastPollingDeploymentType(deploymentType) ? FAST_POLL_MS : STANDARD_POLL_MS;
}

/**
 * Resolve poll interval: honor explicit ms when valid; else probe controller health for deploymentType.
 * @param {string} controllerUrl - Miso controller base URL
 * @param {number|string|undefined|null} explicitPollInterval - Optional CLI/config override
 * @returns {Promise<number>}
 */
async function resolvePollIntervalFromController(controllerUrl, explicitPollInterval) {
  const n =
    explicitPollInterval !== undefined && explicitPollInterval !== null
      ? Number(explicitPollInterval)
      : NaN;
  if (Number.isFinite(n) && n > 0) {
    return n;
  }
  try {
    const { getControllerDeploymentType } = require('../api/controller-health.api');
    const deploymentType = await getControllerDeploymentType(controllerUrl);
    return resolvePollIntervalMs(deploymentType, undefined);
  } catch {
    return STANDARD_POLL_MS;
  }
}

module.exports = {
  FAST_POLL_MS,
  STANDARD_POLL_MS,
  isFastPollingDeploymentType,
  resolvePollIntervalMs,
  resolvePollIntervalFromController
};
