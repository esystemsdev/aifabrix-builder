/**
 * Absolute public base URLs for platform apps (Keycloak, Miso Controller, Dataplane).
 * Used by setup (`platform-controller`), guided footers, and declarative routing.
 *
 * @fileoverview Platform app public URL resolution (Traefik / localhost + dev ports)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const config = require('../core/config');
const pathsUtil = require('./paths');
const { loadConfigFile } = require('./config-format');
const { computePublicUrlBaseString } = require('./url-declarative-public-base');
const { joinUrlPath, normalizeFrontDoorPatternForHealth } = require('./health-check-url');
const { getDevPorts } = require('./dev-config');

const MISO_CONTROLLER_APP = 'miso-controller';

function loadAppVariables(appName) {
  const builderPath = pathsUtil.getBuilderPath(appName);
  const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
  const variables = loadConfigFile(configPath) || {};
  return variables;
}

function computeLocalFullPlatformFrontDoorUrl(params) {
  const { setupPlatformMode, remoteServer, developerIdNum, frontDoorRouting } = params;
  if (setupPlatformMode !== 'full') {
    return null;
  }
  if (remoteServer && String(remoteServer).trim()) {
    return null;
  }
  const ports = getDevPorts(Number.isFinite(developerIdNum) ? developerIdNum : 0);
  const mount = normalizeFrontDoorPatternForHealth(frontDoorRouting.pattern);
  // Full local platform uses a single front-door port (3000 + devId×100), not the infra Traefik port.
  return joinUrlPath(`http://localhost:${ports.app}`, mount);
}

/**
 * Compute the absolute base URL for a platform app (same rules as guided `up-platform` footer).
 *
 * @async
 * @param {string} appName - e.g. `miso-controller`, `keycloak`, `dataplane`
 * @returns {Promise<string>}
 */
async function computeAppBaseUrl(appName) {
  const variables = loadAppVariables(appName);
  const basePort = Number(variables.port || 3000);
  const developerIdRaw = await config.getDeveloperId();
  const developerIdNum =
    typeof developerIdRaw === 'string' ? parseInt(developerIdRaw, 10) : developerIdRaw;
  const userCfg = await config.getConfig();
  const remoteServer = await config.getRemoteServer();
  const infraTlsEnabled = Boolean(userCfg && userCfg.tlsEnabled);

  const fd = variables.frontDoorRouting || null;
  const frontDoorEnabled = Boolean(fd && fd.enabled === true);
  const traefikOn = Boolean(userCfg && userCfg.traefik);
  const pathActive = Boolean(traefikOn && frontDoorEnabled);
  const setupPlatformMode = await config.getSetupPlatformMode();

  const publicBase = computePublicUrlBaseString({
    traefik: traefikOn,
    pathActive,
    hostTemplate: fd ? fd.host : null,
    tls: fd ? fd.tls : true,
    developerIdRaw,
    remoteServer,
    profile: 'docker',
    listenPort: basePort,
    developerIdNum,
    infraTlsEnabled
  });

  if (pathActive) {
    const localFullUrl = computeLocalFullPlatformFrontDoorUrl({
      setupPlatformMode,
      remoteServer,
      developerIdNum,
      frontDoorRouting: fd
    });
    if (localFullUrl) return localFullUrl;
    const mount = normalizeFrontDoorPatternForHealth(fd.pattern);
    return joinUrlPath(publicBase, mount);
  }

  return String(publicBase).replace(/\/+$/, '');
}

/**
 * Absolute Miso Controller URL for local platform install / setup auth.
 *
 * @async
 * @returns {Promise<string>}
 */
async function resolvePlatformControllerUrl() {
  return computeAppBaseUrl(MISO_CONTROLLER_APP);
}

module.exports = {
  MISO_CONTROLLER_APP,
  computeAppBaseUrl,
  resolvePlatformControllerUrl
};
