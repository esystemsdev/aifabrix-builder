/**
 * Centralized declarative url:// flags (plan 124 truth table).
 *
 * @fileoverview pathActive, pathPrefix gating — single source for resolver + tests
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { computePublicUrlPathPrefix } = require('./url-public-path-prefix');

/**
 * pathActive = traefik on AND application.yaml frontDoorRouting.enabled === true
 * @param {boolean} traefik
 * @param {boolean} [frontDoorRoutingEnabled]
 * @returns {boolean}
 */
function computePathActive(traefik, frontDoorRoutingEnabled) {
  return Boolean(traefik) && frontDoorRoutingEnabled === true;
}

/**
 * Plan 117 /dev|/tst prefix only when Traefik proxy is on; otherwise '' (plan 124).
 * @param {boolean} traefik
 * @param {boolean} useEnvironmentScopedResources
 * @param {boolean} appEnvironmentScopedResources
 * @param {string} derivedEnvKey
 * @returns {string}
 */
function computeDeclarativePathPrefix(
  traefik,
  useEnvironmentScopedResources,
  appEnvironmentScopedResources,
  derivedEnvKey
) {
  if (!traefik) {
    return '';
  }
  return computePublicUrlPathPrefix(
    useEnvironmentScopedResources,
    appEnvironmentScopedResources,
    derivedEnvKey
  );
}

module.exports = {
  computePathActive,
  computeDeclarativePathPrefix
};
