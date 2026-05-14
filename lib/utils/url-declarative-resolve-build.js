/**
 * URL string builders and token expansion for declarative url:// resolution (plan 122).
 *
 * @fileoverview Split from url-declarative-resolve.js for ESLint max-lines limits
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { getRegistryEntryForApp, readRegistryInternalDockerUseOriginOnly } = require('./urls-local-registry');
const { DECLARATIVE_URL_INFRA_DEFAULTS } = require('./infra-env-defaults');
const { getContainerPort, getLocalPort } = require('./port-resolver');
const pathsUtil = require('./paths');
const { resolveDeclarativeUrlSurfaceState } = require('./url-declarative-resolve-surface-state');
const { loadApplicationYamlDocForUrlResolve } = require('./url-declarative-resolve-load-doc');
const { parseUrlToken } = require('./url-declarative-token-parse');
const { readFrontDoorHostTlsFromDoc } = require('./url-declarative-runtime-base-path');
const buildUrls = require('./url-declarative-resolve-build-urls');
const expandToken = require('./url-declarative-resolve-expand-token');

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
 * `frontDoorIngressActive` and `perTokenTraefik` come from {@link resolveDeclarativeUrlSurfaceState}.
 * @param {string} token
 * @param {Object} ctx
 * @param {Object} registry
 * @returns {{ appKey: string, listenPort: number, publicPortBasis: number, patternStr: string, hostTemplate: string|null, tls: boolean, frontDoorIngressActive: boolean, perTokenTraefik: boolean, declarativeUrlSurfacePhase: string, internalDockerUseOriginOnly: boolean }|null}
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
  const fromRegistry = readRegistryInternalDockerUseOriginOnly(appKey, registry);
  const internalDockerUseOriginOnly =
    fromRegistry !== undefined ? fromRegistry : meta.internalDockerUseOriginOnly;
  const frontDoorRoutingEnabled = Boolean(
    doc && doc.frontDoorRouting && doc.frontDoorRouting.enabled === true
  );
  const { phase, perTokenTraefik, frontDoorIngressActive } = resolveDeclarativeUrlSurfaceState({
    userCfg: ctx.userCfg,
    appKey,
    ctxTraefik: ctx.traefik,
    frontDoorRoutingEnabled
  });
  return {
    appKey,
    listenPort,
    publicPortBasis,
    patternStr,
    hostTemplate: meta.hostTemplate,
    tls: meta.tls,
    frontDoorIngressActive,
    perTokenTraefik,
    declarativeUrlSurfacePhase: phase,
    internalDockerUseOriginOnly
  };
}

module.exports = {
  applyTstRemoteDeveloperHost,
  applyTstRemoteDeveloperHostToOrigin,
  ...buildUrls,
  ...expandToken,
  parseUrlToken,
  resolveListenPortPatternForToken
};
