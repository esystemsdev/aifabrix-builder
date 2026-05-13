/**
 * Surface expansion + {@link expandResolvedUrlToken} for declarative url:// tokens.
 *
 * @fileoverview Split from url-declarative-resolve-build.js for ESLint max-lines
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const {
  buildPublicUrlString,
  buildPublicHostOriginString,
  buildInternalHostOriginString,
  buildInternalUrlString
} = require('./url-declarative-resolve-build-urls');
const { normalizeRuntimeBasePath } = require('./url-declarative-runtime-base-path');

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
    frontDoorIngressActive: r.frontDoorIngressActive,
    declarativeTargetAppKey: r.appKey,
    declarativeCurrentAppKey: r.currentAppKey,
    declarativePublicUrlsUseLocalhost: r.declarativePublicUrlsUseLocalhost
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
    frontDoorIngressActive: r.frontDoorIngressActive,
    declarativeTargetAppKey: r.appKey,
    declarativeCurrentAppKey: r.currentAppKey,
    declarativePublicUrlsUseLocalhost: r.declarativePublicUrlsUseLocalhost
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
    frontDoorIngressActive: r.frontDoorIngressActive,
    declarativeTargetAppKey: r.appKey,
    declarativeCurrentAppKey: r.currentAppKey,
    declarativePublicUrlsUseLocalhost: r.declarativePublicUrlsUseLocalhost
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
  const useOriginOnly =
    r.profile === 'docker' && Boolean(r.internalDockerUseOriginOnly);
  const runtimePath = useOriginOnly
    ? ''
    : normalizeRuntimeBasePath(r.patternPath, r);
  return buildInternalUrlString({
    profile: r.profile,
    listenPort: r.listenPort,
    targetAppKey: r.appKey,
    runtimeBasePath: runtimePath,
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
    frontDoorIngressActive: r.frontDoorIngressActive,
    declarativeTargetAppKey: r.appKey,
    declarativeCurrentAppKey: r.currentAppKey,
    declarativePublicUrlsUseLocalhost: r.declarativePublicUrlsUseLocalhost
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
  publishedOriginPortBasis,
  isLocalProfileWithoutRemoteServer,
  expandHostSurfacePublic,
  expandHostSurfaceInternal,
  expandFullSurfacePublic,
  expandFullSurfaceInternal,
  expandResolvedUrlToken
};
