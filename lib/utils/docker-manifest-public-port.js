/**
 * Docker .env generation: manifest `port` is the host-published port; env-config `*_PORT` is
 * often internal. After resolveKvReferences, ${*_PUBLIC_PORT} may already be interpolated from
 * schema before manifest port is applied — align *_PUBLIC_PORT with application.yaml `port`.
 *
 * Matching rule (no app-specific keys in callers): find env-config `*_HOST` whose value equals
 * `application.yaml` `app.key` (Docker Compose service name), then update the paired *_PUBLIC_PORT.
 *
 * @fileoverview Manifest published port for docker env interpolation
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {Object} envVars
 * @param {string} appKey - application.yaml app.key (trimmed)
 * @returns {string|null} e.g. KEYCLOAK_HOST
 */
function findDockerHostKeyForAppKey(envVars, appKey) {
  if (!envVars || !appKey) {
    return null;
  }
  for (const [k, v] of Object.entries(envVars)) {
    if (!/_HOST$/.test(k)) {
      continue;
    }
    if (String(v) === appKey) {
      return k;
    }
  }
  return null;
}

/**
 * @param {Object} envVars
 * @param {string} appKey
 * @returns {string|null} e.g. KEYCLOAK_PUBLIC_PORT
 */
function publicPortKeyForAppKey(envVars, appKey) {
  const hostKey = findDockerHostKeyForAppKey(envVars, appKey);
  if (!hostKey) {
    return null;
  }
  return hostKey.replace(/_HOST$/, '_PUBLIC_PORT');
}

/**
 * Set *_PUBLIC_PORT from manifest `port` + developer id when docker service name matches app.key.
 * @param {Object} envVars - Mutated map from buildEnvVarMap
 * @param {Object|null|undefined} appDoc - application.yaml root
 * @returns {Promise<void>}
 */
async function mergeDockerManifestPublishedPort(envVars, appDoc) {
  if (!appDoc || !appDoc.app || typeof appDoc.app.key !== 'string') {
    return;
  }
  const appKey = appDoc.app.key.trim();
  if (!appKey) {
    return;
  }
  const publicPortKey = publicPortKeyForAppKey(envVars, appKey);
  if (!publicPortKey) {
    return;
  }
  const rawPub = appDoc.port;
  const pubBase = rawPub !== undefined && rawPub !== null ? Number(rawPub) : NaN;
  if (!Number.isFinite(pubBase)) {
    return;
  }
  const devIdNum = await require('./env-map').getDeveloperIdNumber(null);
  envVars[publicPortKey] = String(devIdNum > 0 ? pubBase + devIdNum * 100 : pubBase);
}

/**
 * Rewrite first line for the matched *_PUBLIC_PORT after interpolateEnvVars (early kv pass may have wrong value).
 * @param {string} resolved
 * @param {Object} envVars
 * @param {Object|null|undefined} appDoc
 * @returns {string}
 */
function rewriteDockerManifestPublicPortEnvLine(resolved, envVars, appDoc) {
  if (!resolved || !appDoc || !appDoc.app || typeof appDoc.app.key !== 'string') {
    return resolved;
  }
  const appKey = appDoc.app.key.trim();
  if (!appKey) {
    return resolved;
  }
  const publicPortKey = publicPortKeyForAppKey(envVars, appKey);
  if (!publicPortKey) {
    return resolved;
  }
  const publicPort = envVars[publicPortKey];
  if (publicPort === undefined || publicPort === null || publicPort === '') {
    return resolved;
  }
  const re = new RegExp(`^${escapeRegExp(publicPortKey)}\\s*=\\s*.*$`, 'm');
  return resolved.replace(re, `${publicPortKey}=${publicPort}`);
}

module.exports = {
  findDockerHostKeyForAppKey,
  publicPortKeyForAppKey,
  mergeDockerManifestPublishedPort,
  rewriteDockerManifestPublicPortEnvLine
};
