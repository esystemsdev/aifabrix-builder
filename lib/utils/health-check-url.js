/**
 * Health check URL resolution helpers.
 *
 * @fileoverview Compute health check URL using declarative public URL logic (Traefik/frontDoorRouting)
 */

'use strict';

const { computePublicUrlBaseString } = require('./url-declarative-public-base');
const { parseDeveloperIdNum } = require('./declarative-url-ports');

/**
 * Join URL path segments with exactly one slash between them.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function joinUrlPath(a, b) {
  const left = String(a || '').replace(/\/+$/, '');
  const right = String(b || '').replace(/^\/+/, '');
  if (!left) return `/${right}`;
  if (!right) return left || '/';
  return `${left}/${right}`;
}

/**
 * Convert a frontDoorRouting.pattern (Traefik/Front Door wildcard route) into a concrete mount path.
 * Example: "/auth/*" -> "/auth"
 *
 * @param {string} pattern
 * @returns {string}
 */
function normalizeFrontDoorPatternForHealth(pattern) {
  let p = String(pattern || '').trim();
  if (!p) return '/';
  if (!p.startsWith('/')) p = `/${p}`;
  // Drop wildcard suffixes used for routing.
  p = p.replace(/\/\*+$/, '');
  p = p.replace(/\*+$/, '');
  // Drop trailing path params like "/foo/{bar}" if present (health is mounted at the base).
  p = p.replace(/\/\{[^}]+\}$/, '');
  // Normalize slashes and trailing slash.
  p = p.replace(/\/{2,}/g, '/');
  p = p.replace(/\/+$/, '');
  return p || '/';
}

/**
 * @param {Object|null} appConfig
 * @returns {boolean}
 */
function frontDoorEnabled(appConfig) {
  return Boolean(appConfig && appConfig.frontDoorRouting && appConfig.frontDoorRouting.enabled === true);
}

/**
 * @param {Object|null} appConfig
 * @returns {string|null}
 */
function frontDoorPattern(appConfig) {
  const p = appConfig && appConfig.frontDoorRouting ? appConfig.frontDoorRouting.pattern : null;
  return (typeof p === 'string' && p.trim()) ? p.trim() : null;
}

/**
 * Compute the Traefik front-door health check URL when applicable.
 *
 * Returns null when Traefik/frontDoorRouting isn't active or cannot be resolved.
 *
 * @async
 * @param {string} appName
 * @param {number} healthCheckPort
 * @param {Object|null} appConfig
 * @returns {Promise<string|null>}
 */
async function computeTraefikHealthCheckUrl(appName, healthCheckPort, appConfig) {
  if (!frontDoorEnabled(appConfig)) return null;
  const pattern = frontDoorPattern(appConfig);
  if (!pattern) return null;

  const coreConfig = require('../core/config');
  const userCfg = await coreConfig.getConfig();
  if (!(userCfg && userCfg.traefik)) return null;

  const infraTlsEnabled = Boolean(userCfg && userCfg.tlsEnabled);
  const remoteServer = await coreConfig.getRemoteServer();
  const developerIdRaw = await coreConfig.getDeveloperId();
  const developerIdNum = parseDeveloperIdNum(developerIdRaw);

  // Health checks originate from the CLI on the host, not from inside a container.
  const profile = 'local';
  const fd = appConfig.frontDoorRouting;
  const listenPort = Number(appConfig?.port || 3000);

  const publicBase = computePublicUrlBaseString({
    traefik: true,
    pathActive: true,
    hostTemplate: fd.host,
    tls: fd.tls,
    developerIdRaw,
    remoteServer,
    profile,
    listenPort,
    developerIdNum,
    infraTlsEnabled
  });

  const healthCheckPath = appConfig?.healthCheck?.path || '/health';
  const mountPath = normalizeFrontDoorPatternForHealth(pattern);
  const baseWithFrontDoor = joinUrlPath(publicBase, mountPath);
  return joinUrlPath(baseWithFrontDoor, healthCheckPath);
}

module.exports = {
  joinUrlPath,
  normalizeFrontDoorPatternForHealth,
  computeTraefikHealthCheckUrl
};

