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

const MISO_CONTROLLER_APP = 'miso-controller';

/**
 * Compute the absolute base URL for a platform app (same rules as guided `up-platform` footer).
 *
 * @async
 * @param {string} appName - e.g. `miso-controller`, `keycloak`, `dataplane`
 * @returns {Promise<string>}
 */
async function computeAppBaseUrl(appName) {
  const builderPath = pathsUtil.getBuilderPath(appName);
  const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
  const variables = loadConfigFile(configPath) || {};
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
