/**
 * URL string builders and token expansion for declarative url:// resolution (plan 122).
 *
 * @fileoverview Split from url-declarative-resolve.js for ESLint max-lines limits
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { publishedHostPort, localHostPort } = require('./declarative-url-ports');
const { getRegistryEntryForApp } = require('./urls-local-registry');
const { DECLARATIVE_URL_INFRA_DEFAULTS } = require('./infra-env-defaults');
const { getContainerPort, getLocalPort } = require('./port-resolver');
const pathsUtil = require('./paths');
const { computePublicUrlBaseString } = require('./url-declarative-public-base');
const { computePathActive } = require('./url-declarative-url-flags');
const { loadApplicationYamlDocForUrlResolve } = require('./url-declarative-resolve-load-doc');
const { parseUrlToken } = require('./url-declarative-token-parse');

/**
 * Plan 122: **Developer subdomain `devNN` + remote hostname is not derived from envKey `tst`.** It comes only from
 * expanding **`frontDoorRouting.host`** (e.g. `${DEV_USERNAME}.${REMOTE_HOST}`) when **`traefik`** is on.
 * Kept as a no-op for backward compatibility; callers must not rely on tst-based host mutation.
 *
 * @param {string} absoluteUrl
 * @returns {string}
 */
function applyTstRemoteDeveloperHost(absoluteUrl) {
  return absoluteUrl;
}

/**
 * @param {string} origin
 * @returns {string}
 */
function applyTstRemoteDeveloperHostToOrigin(origin) {
  return origin;
}

/**
 * Join base URL origin with path segments (no duplicate slashes).
 * @param {string} originOrBase - https://host or https://host:port
 * @param {string} suffixPath - /dev/data
 * @returns {string}
 */
function joinUrlPath(originOrBase, suffixPath) {
  const base = String(originOrBase || '').replace(/\/+$/, '');
  let suf = suffixPath || '';
  if (!suf.startsWith('/')) {
    suf = `/${suf}`;
  }
  return `${base}${suf}`.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * @param {Object} opts
 * @returns {string}
 */
function buildPublicUrlString(opts) {
  const {
    profile,
    listenPort,
    developerIdNum,
    remoteServer,
    pathPrefix,
    patternPath,
    traefik,
    hostTemplate,
    tls,
    developerIdRaw,
    infraTlsEnabled,
    frontDoorIngressActive
  } = opts;
  const base = computePublicUrlBaseString({
    traefik: Boolean(traefik),
    pathActive: Boolean(frontDoorIngressActive),
    hostTemplate: hostTemplate || null,
    tls: tls !== false,
    developerIdRaw,
    remoteServer,
    profile,
    listenPort,
    developerIdNum,
    infraTlsEnabled: Boolean(infraTlsEnabled)
  });
  const patternSegment =
    frontDoorIngressActive === false
      ? ''
      : patternPath === '/' || patternPath === ''
        ? ''
        : patternPath;
  const rawSuffix = `${pathPrefix}${patternSegment}`.replace(/\/{2,}/g, '/');
  if (!rawSuffix || rawSuffix === '/') {
    return String(base).replace(/\/+$/, '');
  }
  const normalizedSuffix = rawSuffix.startsWith('/') ? rawSuffix : `/${rawSuffix}`;
  return joinUrlPath(base, normalizedSuffix);
}

/**
 * Public reachability origin only (no env path prefix, no front-door pattern path).
 * @param {Object} opts
 * @returns {string}
 */
function buildPublicHostOriginString(opts) {
  const {
    profile,
    listenPort,
    developerIdNum,
    remoteServer,
    traefik,
    hostTemplate,
    tls,
    developerIdRaw,
    infraTlsEnabled,
    frontDoorIngressActive
  } = opts;
  const base = computePublicUrlBaseString({
    traefik: Boolean(traefik),
    pathActive: Boolean(frontDoorIngressActive),
    hostTemplate: hostTemplate || null,
    tls: tls !== false,
    developerIdRaw,
    remoteServer,
    profile,
    listenPort,
    developerIdNum,
    infraTlsEnabled: Boolean(infraTlsEnabled)
  });
  try {
    return new URL(base).origin;
  } catch {
    const hostPort =
      profile === 'docker'
        ? publishedHostPort(listenPort, developerIdNum)
        : localHostPort(listenPort, developerIdNum);
    return `http://localhost:${hostPort}`;
  }
}

/**
 * Internal service origin only (scheme + host + port), no path suffix.
 * @param {Object} opts
 * @returns {string}
 */
function buildInternalHostOriginString(opts) {
  const {
    profile,
    listenPort,
    targetAppKey,
    remoteServer,
    pathPrefix,
    patternPath,
    developerIdNum,
    traefik,
    hostTemplate,
    tls,
    developerIdRaw,
    infraTlsEnabled,
    frontDoorIngressActive
  } = opts;
  if (profile === 'docker') {
    return `http://${targetAppKey}:${listenPort}`;
  }
  if (remoteServer && String(remoteServer).trim()) {
    const pub = buildPublicUrlString({
      profile: 'local',
      listenPort,
      developerIdNum,
      remoteServer,
      pathPrefix,
      patternPath,
      traefik,
      hostTemplate,
      tls,
      developerIdRaw,
      infraTlsEnabled,
      frontDoorIngressActive
    });
    try {
      return new URL(pub).origin;
    } catch {
      return `http://${targetAppKey}:${listenPort}`;
    }
  }
  return `http://${targetAppKey}:${listenPort}`;
}

function buildInternalUrlString(opts) {
  const {
    profile,
    listenPort,
    targetAppKey,
    remoteServer,
    pathPrefix,
    patternPath,
    developerIdNum,
    traefik,
    hostTemplate,
    tls,
    developerIdRaw,
    infraTlsEnabled,
    frontDoorIngressActive
  } = opts;
  if (profile === 'docker') {
    return `http://${targetAppKey}:${listenPort}`;
  }
  if (remoteServer && String(remoteServer).trim()) {
    return buildPublicUrlString({
      profile: 'local',
      listenPort,
      developerIdNum,
      remoteServer,
      pathPrefix,
      patternPath,
      traefik,
      hostTemplate,
      tls,
      developerIdRaw,
      infraTlsEnabled,
      frontDoorIngressActive
    });
  }
  return `http://${targetAppKey}:${listenPort}`;
}

/**
 * @param {object|null|undefined} doc
 * @returns {{ hostTemplate: string|null, tls: boolean }}
 */
function readFrontDoorHostTlsFromDoc(doc) {
  if (!doc || !doc.frontDoorRouting) {
    return { hostTemplate: null, tls: true };
  }
  const fd = doc.frontDoorRouting;
  const hostTemplate =
    typeof fd.host === 'string' && fd.host.trim() ? fd.host.trim() : null;
  return { hostTemplate, tls: fd.tls !== false };
}

/**
 * Ports from application.yaml: `listenPort` = container/process listen ({@link getContainerPort});
 * `publicPortBasis` = manifest root `port` ({@link getLocalPort}) for browser-published host URLs
 * (url://host-public, url://public origin) when Traefik is not serving the app — not the internal
 * container port (e.g. Keycloak 8082 published vs 8080 in-container).
 *
 * @param {object|null|undefined} doc
 * @param {{ port: number, containerPort: number|null, pattern: string }|null} entry
 * @returns {{ listenPort: number, publicPortBasis: number, patternStr: string }|null}
 */
function resolveListenPortAndPatternFromDoc(doc, entry) {
  if (doc) {
    const listenPort = getContainerPort(doc);
    const publicPortBasis = getLocalPort(doc);
    const raw = doc.frontDoorRouting && doc.frontDoorRouting.pattern;
    const patternStr =
      typeof raw === 'string'
        ? raw
        : entry && typeof entry.pattern === 'string'
          ? entry.pattern
          : DECLARATIVE_URL_INFRA_DEFAULTS.frontDoorPatternWhenUnspecified;
    return { listenPort, publicPortBasis, patternStr };
  }
  if (entry) {
    const c = entry.containerPort;
    const listenPort = typeof c === 'number' && c > 0 ? c : entry.port;
    return { listenPort, publicPortBasis: entry.port, patternStr: entry.pattern };
  }
  return null;
}

/**
 * Port + pattern + optional Traefik host template for a url:// token.
 * @param {string} token
 * @param {Object} ctx
 * @param {Object} registry
 * @returns {{ appKey: string, listenPort: number, publicPortBasis: number, patternStr: string, hostTemplate: string|null, tls: boolean, frontDoorIngressActive: boolean }|null}
 */
function resolveListenPortPatternForToken(token, ctx, registry) {
  const { targetKey } = parseUrlToken(token);
  const currentAppKey = ctx.currentAppKey || '';
  const appKey = targetKey || currentAppKey;
  if (!appKey) {
    return null;
  }
  const doc = loadApplicationYamlDocForUrlResolve(appKey, ctx, pathsUtil);
  const entry = getRegistryEntryForApp(appKey, registry);
  const portPattern = resolveListenPortAndPatternFromDoc(doc, entry);
  if (!portPattern) {
    return null;
  }
  const { listenPort, publicPortBasis, patternStr } = portPattern;
  const meta = readFrontDoorHostTlsFromDoc(doc);
  const frontDoorIngressActive = computePathActive(
    Boolean(ctx.traefik),
    Boolean(doc && doc.frontDoorRouting && doc.frontDoorRouting.enabled === true)
  );
  return {
    appKey,
    listenPort,
    publicPortBasis,
    patternStr,
    hostTemplate: meta.hostTemplate,
    tls: meta.tls,
    frontDoorIngressActive
  };
}

/**
 * Published/browser origin port basis for url:// public surfaces (manifest `port`), not container listen.
 * @param {Object} r
 * @returns {number}
 */
function publishedOriginPortBasis(r) {
  const b = r.publicPortBasis;
  if (b !== undefined && b !== null && Number.isFinite(Number(b))) {
    return Number(b);
  }
  return r.listenPort;
}

/**
 * @param {Object} r - resolved app + patternPath + pathPrefix + remoteServer + profile + devNum + derivedEnvKey
 * @returns {string}
 */
function expandHostSurfacePublic(r) {
  return buildPublicHostOriginString({
    profile: r.profile,
    listenPort: publishedOriginPortBasis(r),
    developerIdNum: r.devNum,
    remoteServer: r.remoteServer,
    traefik: r.traefik,
    hostTemplate: r.hostTemplate,
    tls: r.tls,
    developerIdRaw: r.developerIdRaw,
    infraTlsEnabled: r.infraTlsEnabled,
    frontDoorIngressActive: r.frontDoorIngressActive
  });
}

/**
 * Local workstation `.env` (no remote-server): browser-reachable URLs only — internal tokens match public.
 * Remote dev keeps internal = public mirroring via {@link buildInternalUrlString} when `remoteServer` is set.
 *
 * @param {Object} r
 * @returns {boolean}
 */
function isLocalProfileWithoutRemoteServer(r) {
  return r.profile === 'local' && !String(r.remoteServer || '').trim();
}

/**
 * @param {Object} r
 * @returns {string}
 */
function expandHostSurfaceInternal(r) {
  if (isLocalProfileWithoutRemoteServer(r)) {
    return expandHostSurfacePublic(r);
  }
  return buildInternalHostOriginString({
    profile: r.profile,
    listenPort: r.listenPort,
    targetAppKey: r.appKey,
    remoteServer: r.remoteServer,
    pathPrefix: r.pathPrefix,
    patternPath: r.patternPath,
    developerIdNum: r.devNum,
    derivedEnvKey: r.derivedEnvKey,
    traefik: r.traefik,
    hostTemplate: r.hostTemplate,
    tls: r.tls,
    developerIdRaw: r.developerIdRaw,
    infraTlsEnabled: r.infraTlsEnabled,
    frontDoorIngressActive: r.frontDoorIngressActive
  });
}

/**
 * @param {Object} r
 * @returns {string}
 */
function expandFullSurfacePublic(r) {
  return buildPublicUrlString({
    profile: r.profile,
    listenPort: publishedOriginPortBasis(r),
    developerIdNum: r.devNum,
    remoteServer: r.remoteServer,
    pathPrefix: r.pathPrefix,
    patternPath: r.patternPath,
    traefik: r.traefik,
    hostTemplate: r.hostTemplate,
    tls: r.tls,
    developerIdRaw: r.developerIdRaw,
    infraTlsEnabled: r.infraTlsEnabled,
    frontDoorIngressActive: r.frontDoorIngressActive
  });
}

/**
 * @param {Object} r
 * @returns {string}
 */
function expandFullSurfaceInternal(r) {
  if (isLocalProfileWithoutRemoteServer(r)) {
    return expandFullSurfacePublic(r);
  }
  return buildInternalUrlString({
    profile: r.profile,
    listenPort: r.listenPort,
    targetAppKey: r.appKey,
    remoteServer: r.remoteServer,
    pathPrefix: r.pathPrefix,
    patternPath: r.patternPath,
    developerIdNum: r.devNum,
    derivedEnvKey: r.derivedEnvKey,
    traefik: r.traefik,
    hostTemplate: r.hostTemplate,
    tls: r.tls,
    developerIdRaw: r.developerIdRaw,
    infraTlsEnabled: r.infraTlsEnabled,
    frontDoorIngressActive: r.frontDoorIngressActive
  });
}

/**
 * @param {{ kind: string, surface: string }} parsed
 * @param {Object} r
 * @returns {string}
 */
function expandResolvedUrlToken(parsed, r) {
  if (parsed.surface === 'vdir') {
    if (!r.frontDoorIngressActive) {
      return '';
    }
    // Plan 124: docker PRIVATEVDIR is always empty; public vdir still carries pattern
    if (parsed.kind === 'internal' && r.profile === 'docker') {
      return '';
    }
    const prefix = String(r.pathPrefix || '');
    const pat = r.patternPath || '/';
    if (!pat || pat === '/') {
      return prefix || '';
    }
    const joined = `${prefix}${pat}`.replace(/\/{2,}/g, '/');
    return joined.startsWith('/') ? joined : `/${joined}`;
  }
  if (parsed.surface === 'host') {
    return parsed.kind === 'public' ? expandHostSurfacePublic(r) : expandHostSurfaceInternal(r);
  }
  return parsed.kind === 'public' ? expandFullSurfacePublic(r) : expandFullSurfaceInternal(r);
}

module.exports = {
  applyTstRemoteDeveloperHost,
  applyTstRemoteDeveloperHostToOrigin,
  buildPublicUrlString,
  buildPublicHostOriginString,
  buildInternalUrlString,
  buildInternalHostOriginString,
  parseUrlToken,
  expandResolvedUrlToken,
  resolveListenPortPatternForToken
};
