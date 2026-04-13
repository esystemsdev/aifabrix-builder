/**
 * Traefik ingress path/host/TLS and StripPrefix derivation helpers for compose generation.
 *
 * @fileoverview Traefik PathPrefix + host expansion (shared with health path resolution)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  buildEnvScopedTraefikPath
} = require('./environment-scoped-resources');
const { parseDeveloperIdNum } = require('./declarative-url-ports');

/**
 * Derives base path from routing pattern by removing trailing wildcards
 * @param {string} pattern - URL pattern (e.g., '/app/*', '/api/v1/*')
 * @returns {string} Base path for routing
 */
function derivePathFromPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return '/';
  }
  const trimmed = pattern.trim();
  if (trimmed === '/' || trimmed === '') {
    return '/';
  }
  const withoutWildcards = trimmed.replace(/\*+$/g, '');
  const withoutTrailingSlashes = withoutWildcards.replace(/\/+$/g, '');
  return withoutTrailingSlashes || '/';
}

/**
 * Resolve Traefik TLS from application.yaml `frontDoorRouting.tls` (boolean or string).
 * String "false" disables TLS; placeholders (e.g. ${TLS_ENABLED}) are treated as enabled.
 * @param {unknown} tls - Raw tls value
 * @returns {boolean}
 */
function resolveTraefikTlsEnabled(tls) {
  if (tls === false || tls === 'false') {
    return false;
  }
  return true;
}

/**
 * Developer label for frontDoorRouting.host only. Id 0 / missing / empty → no subdomain (empty string).
 * Non-zero → dev01, dev02, … (same padding as buildDevUsername).
 *
 * @param {string|number|null|undefined} devId
 * @returns {string}
 */
function buildDevUsernameForFrontDoorHost(devId) {
  const n = parseDeveloperIdNum(devId);
  if (n === 0) {
    return '';
  }
  const s = String(n);
  const padded = s.length === 1 ? s.padStart(2, '0') : s;
  return `dev${padded}`;
}

/**
 * Expand frontDoorRouting.host placeholders (Traefik labels + url:// base). Same rules as declarative URL resolver.
 * Normalizes ${DEV_USERNAME}${REMOTE_HOST} to insert a dot. Trims stray leading/trailing dots (e.g. id 0 + `.${REMOTE_HOST}` → bare remote hostname).
 *
 * @param {string} template
 * @param {string|number|null|undefined} developerIdRaw
 * @param {string|null|undefined} remoteServer
 * @returns {string}
 */
function expandFrontDoorHostPlaceholders(template, developerIdRaw, remoteServer) {
  let t = String(template || '');
  t = t.replace(/\$\{DEV_USERNAME\}\$\{REMOTE_HOST\}/g, '${DEV_USERNAME}.${REMOTE_HOST}');
  const devU = buildDevUsernameForFrontDoorHost(developerIdRaw);
  t = t.replace(/\$\{DEV_USERNAME\}/g, devU);
  let remoteHost = '';
  try {
    if (remoteServer && String(remoteServer).trim()) {
      remoteHost = new URL(String(remoteServer).trim()).hostname;
    }
  } catch {
    remoteHost = '';
  }
  t = t.replace(/\$\{REMOTE_HOST\}/g, remoteHost);
  t = t.replace(/^\.+/g, '').replace(/\.{2,}/g, '.').replace(/\.+$/g, '').trim();
  return t;
}

/**
 * Traefik PathPrefix / host / TLS from frontDoorRouting (public ingress). Does not include StripPrefix — that follows
 * the in-container health path: private URL is `http://<service>:<port>` plus the probe path; `/dev`, `/tst`, `/auth`,
 * etc. are public path segments only.
 *
 * @param {Object} config - Application configuration (application.yaml shape)
 * @param {string|number} devId - Developer id for host expansion
 * @param {Object|null} scopeOpts - Env-scoped Traefik path (effectiveEnvironmentScopedResources, runEnvKey)
 * @param {string|null|undefined} remoteServer - For ${REMOTE_HOST}
 * @returns {{ enabled: false } | { enabled: true, host: string, path: string, tls: boolean, certStore: string|null }}
 */
function buildTraefikIngressBase(config, devId, scopeOpts, remoteServer) {
  const frontDoor = config.frontDoorRouting;
  if (!frontDoor || frontDoor.enabled !== true) {
    return { enabled: false };
  }
  if (!frontDoor.host || typeof frontDoor.host !== 'string') {
    throw new Error('frontDoorRouting.host is required when frontDoorRouting.enabled is true');
  }
  const host = expandFrontDoorHostPlaceholders(frontDoor.host, devId, remoteServer);
  const basePath = derivePathFromPattern(frontDoor.pattern);
  let pathOut = basePath;
  if (
    scopeOpts &&
    scopeOpts.effectiveEnvironmentScopedResources &&
    scopeOpts.runEnvKey &&
    (scopeOpts.runEnvKey === 'dev' || scopeOpts.runEnvKey === 'tst')
  ) {
    pathOut = buildEnvScopedTraefikPath(basePath, scopeOpts.runEnvKey);
  }
  return {
    enabled: true,
    host,
    path: pathOut,
    tls: resolveTraefikTlsEnabled(frontDoor.tls),
    certStore: frontDoor.certStore || null
  };
}

/**
 * Whether Traefik should apply StripPrefix so the backend sees the same path as the Docker health probe.
 * When the resolved compose health path already lies under the public PathPrefix (e.g. /auth/health/ready), forward
 * the full path. When the probe is root-only (e.g. /health) but PathPrefix is /miso, strip the prefix.
 *
 * @param {string} traefikPath - PathPrefix value (slashes normalized, no trailing slash except '/')
 * @param {string} resolvedHealthPath - Output of resolveHealthCheckPathWithFrontDoorVdir with compose opts
 * @returns {boolean} true when StripPrefix middleware labels should be emitted
 */
function computeTraefikStripPathPrefix(traefikPath, resolvedHealthPath) {
  const healthRaw = String(resolvedHealthPath || '/').trim();
  const health = healthRaw.replace(/\/+$/, '') || '/';
  const prefixRaw = String(traefikPath || '/').trim();
  const prefix = prefixRaw.replace(/\/+$/, '') || '/';
  if (prefix === '/' || prefix === '') {
    return false;
  }
  if (health === prefix || health.startsWith(`${prefix}/`)) {
    return false;
  }
  return true;
}

module.exports = {
  derivePathFromPattern,
  resolveTraefikTlsEnabled,
  buildDevUsernameForFrontDoorHost,
  expandFrontDoorHostPlaceholders,
  buildTraefikIngressBase,
  computeTraefikStripPathPrefix
};
