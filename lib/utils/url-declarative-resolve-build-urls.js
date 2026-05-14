/**
 * Public/internal URL string builders for declarative url:// (join + build*).
 *
 * @fileoverview Split from url-declarative-resolve-build.js for ESLint max-lines
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const {
  computePublicUrlBaseString,
  resolveHostPortForDeclarativePublic
} = require('./url-declarative-public-base');

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
    frontDoorIngressActive,
    declarativeTargetAppKey,
    declarativeCurrentAppKey,
    declarativePublicUrlsUseLocalhost
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
    infraTlsEnabled: Boolean(infraTlsEnabled),
    declarativeTargetAppKey,
    declarativeCurrentAppKey,
    declarativePublicUrlsUseLocalhost
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
    frontDoorIngressActive,
    declarativeTargetAppKey,
    declarativeCurrentAppKey,
    declarativePublicUrlsUseLocalhost
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
    infraTlsEnabled: Boolean(infraTlsEnabled),
    declarativeTargetAppKey,
    declarativeCurrentAppKey,
    declarativePublicUrlsUseLocalhost
  });
  try {
    return new URL(base).origin;
  } catch {
    const hostPort = resolveHostPortForDeclarativePublic({
      profile,
      listenPort,
      developerIdNum,
      declarativeTargetAppKey,
      declarativeCurrentAppKey
    });
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
    frontDoorIngressActive,
    declarativeTargetAppKey,
    declarativeCurrentAppKey,
    declarativePublicUrlsUseLocalhost
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
      frontDoorIngressActive,
      declarativeTargetAppKey: declarativeTargetAppKey || targetAppKey,
      declarativeCurrentAppKey: declarativeCurrentAppKey,
      declarativePublicUrlsUseLocalhost
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
    runtimeBasePath,
    remoteServer,
    pathPrefix,
    patternPath,
    developerIdNum,
    traefik,
    hostTemplate,
    tls,
    developerIdRaw,
    infraTlsEnabled,
    frontDoorIngressActive,
    declarativeTargetAppKey,
    declarativeCurrentAppKey,
    declarativePublicUrlsUseLocalhost
  } = opts;
  if (profile === 'docker') {
    const origin = `http://${targetAppKey}:${listenPort}`;
    return runtimeBasePath ? joinUrlPath(origin, runtimeBasePath) : origin;
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
      frontDoorIngressActive,
      declarativeTargetAppKey: declarativeTargetAppKey || targetAppKey,
      declarativeCurrentAppKey: declarativeCurrentAppKey,
      declarativePublicUrlsUseLocalhost
    });
  }
  return `http://${targetAppKey}:${listenPort}`;
}

module.exports = {
  joinUrlPath,
  buildPublicUrlString,
  buildPublicHostOriginString,
  buildInternalUrlString,
  buildInternalHostOriginString
};
