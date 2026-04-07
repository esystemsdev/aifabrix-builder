/**
 * URL string builders and token expansion for declarative url:// resolution (plan 122).
 *
 * @fileoverview Split from url-declarative-resolve.js for ESLint max-lines limits
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { nodeFs } = require('../internal/node-fs');
const path = require('path');
const yaml = require('js-yaml');
const { publishedHostPort, localHostPort } = require('./declarative-url-ports');
const { getRegistryEntryForApp } = require('./urls-local-registry');
const { getContainerPort } = require('./port-resolver');
const pathsUtil = require('./paths');
const { computePublicUrlBaseString } = require('./url-declarative-public-base');

/**
 * @param {string} absoluteUrl
 * @param {string|null} remoteBase
 * @param {number} developerIdNum
 * @param {string} derivedEnvKey
 * @returns {string}
 */
function applyTstRemoteDeveloperHost(absoluteUrl, remoteBase, developerIdNum, derivedEnvKey) {
  if (derivedEnvKey !== 'tst' || developerIdNum === 0 || !remoteBase || !String(remoteBase).trim()) {
    return absoluteUrl;
  }
  try {
    const ro = new URL(String(remoteBase).trim());
    const u = new URL(absoluteUrl);
    if (u.origin !== ro.origin) {
      return absoluteUrl;
    }
    const label = `dev${String(developerIdNum).padStart(2, '0')}`;
    u.host = `${label}.${ro.host}`;
    return u.href;
  } catch {
    return absoluteUrl;
  }
}

/**
 * Apply tst devNN host rewrite to an origin string (scheme://host:port).
 * @param {string} origin
 * @param {string|null} remoteBase
 * @param {number} developerIdNum
 * @param {string} derivedEnvKey
 * @returns {string}
 */
function applyTstRemoteDeveloperHostToOrigin(origin, remoteBase, developerIdNum, derivedEnvKey) {
  const base = String(origin || '').replace(/\/+$/, '');
  if (!base) {
    return origin;
  }
  try {
    const out = applyTstRemoteDeveloperHost(`${base}/`, remoteBase, developerIdNum, derivedEnvKey);
    return new URL(out).origin;
  } catch {
    return origin;
  }
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
    developerIdRaw
  } = opts;
  const base = computePublicUrlBaseString({
    traefik: Boolean(traefik),
    hostTemplate: hostTemplate || null,
    tls: tls !== false,
    developerIdRaw,
    remoteServer,
    profile,
    listenPort,
    developerIdNum
  });
  const pathSuffix = `${pathPrefix}${patternPath === '/' ? '' : patternPath}`.replace(/\/{2,}/g, '/') || '/';
  const normalizedSuffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
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
    developerIdRaw
  } = opts;
  const base = computePublicUrlBaseString({
    traefik: Boolean(traefik),
    hostTemplate: hostTemplate || null,
    tls: tls !== false,
    developerIdRaw,
    remoteServer,
    profile,
    listenPort,
    developerIdNum
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
    derivedEnvKey,
    traefik,
    hostTemplate,
    tls,
    developerIdRaw
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
      developerIdRaw
    });
    const adjusted = applyTstRemoteDeveloperHost(pub, remoteServer, developerIdNum, derivedEnvKey);
    try {
      return new URL(adjusted).origin;
    } catch {
      return `http://${targetAppKey}:${listenPort}`;
    }
  }
  return `http://${targetAppKey}:${listenPort}`;
}

/**
 * Keycloak serves under KC_HTTP_RELATIVE_PATH inside the container, so internal base URLs
 * must include the same front-door path segment (e.g. /auth). Other apps typically listen at
 * root on the Docker network, so internal URLs stay host:port only.
 * @param {string} targetAppKey
 * @param {string} pathPrefix
 * @param {string} patternPath - normalized from frontDoorRouting.pattern
 * @returns {boolean}
 */
function internalUrlShouldIncludeFrontDoorPath(targetAppKey, pathPrefix, patternPath) {
  if (targetAppKey !== 'keycloak') return false;
  if (!patternPath || patternPath === '/') return false;
  return true;
}

/**
 * @param {string} base - http://host:port (no trailing slash)
 * @param {string} pathPrefix
 * @param {string} patternPath
 * @returns {string}
 */
function joinInternalBaseWithAppPath(base, pathPrefix, patternPath) {
  const pathSuffix = `${pathPrefix}${patternPath === '/' ? '' : patternPath}`.replace(/\/{2,}/g, '/') || '/';
  if (pathSuffix === '/') return base;
  return joinUrlPath(base, pathSuffix);
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
    derivedEnvKey,
    traefik,
    hostTemplate,
    tls,
    developerIdRaw
  } = opts;
  if (profile === 'docker') {
    const base = `http://${targetAppKey}:${listenPort}`;
    if (internalUrlShouldIncludeFrontDoorPath(targetAppKey, pathPrefix, patternPath)) {
      return joinInternalBaseWithAppPath(base, pathPrefix, patternPath);
    }
    return base;
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
      developerIdRaw
    });
    return applyTstRemoteDeveloperHost(pub, remoteServer, developerIdNum, derivedEnvKey);
  }
  const baseLocal = `http://${targetAppKey}:${listenPort}`;
  if (internalUrlShouldIncludeFrontDoorPath(targetAppKey, pathPrefix, patternPath)) {
    return joinInternalBaseWithAppPath(baseLocal, pathPrefix, patternPath);
  }
  return baseLocal;
}

const URL_TOKEN_EXACT = new Map([
  ['host-public', { kind: 'public', surface: 'host' }],
  ['host-internal', { kind: 'internal', surface: 'host' }],
  ['vdir-public', { kind: 'public', surface: 'vdir' }],
  ['vdir-internal', { kind: 'internal', surface: 'vdir' }],
  ['public', { kind: 'public', surface: 'full' }],
  ['internal', { kind: 'internal', surface: 'full' }]
]);

const URL_TOKEN_SUFFIX_LONG = [
  ['-host-public', 'public', 'host'],
  ['-host-internal', 'internal', 'host'],
  ['-vdir-public', 'public', 'vdir'],
  ['-vdir-internal', 'internal', 'vdir']
];

/**
 * @param {string} token
 * @returns {{ targetKey: string, kind: 'public'|'internal', surface: 'full'|'host'|'vdir' }}
 */
function parseUrlToken(token) {
  const t = String(token || '').trim();
  const exact = URL_TOKEN_EXACT.get(t);
  if (exact) {
    return { targetKey: '', kind: exact.kind, surface: exact.surface };
  }
  for (const [suf, kind, surface] of URL_TOKEN_SUFFIX_LONG) {
    if (t.endsWith(suf)) {
      return { targetKey: t.slice(0, -suf.length), kind, surface };
    }
  }
  if (t.endsWith('-public')) {
    return { targetKey: t.slice(0, -'-public'.length), kind: 'public', surface: 'full' };
  }
  if (t.endsWith('-internal')) {
    return { targetKey: t.slice(0, -'-internal'.length), kind: 'internal', surface: 'full' };
  }
  return { targetKey: '', kind: 'public', surface: 'full' };
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
 * @param {string} appKey
 * @param {Object} ctx
 * @returns {object|null}
 */
function loadApplicationYamlDocForUrlResolve(appKey, ctx) {
  const fs = nodeFs();
  try {
    const current = ctx.currentAppKey || '';
    if (appKey === current && ctx.variablesPath && fs.existsSync(ctx.variablesPath)) {
      return yaml.load(fs.readFileSync(ctx.variablesPath, 'utf8'));
    }
    const root = pathsUtil.getProjectRoot();
    if (!root) {
      return null;
    }
    const cfgPath = path.join(root, 'builder', appKey, 'application.yaml');
    if (!fs.existsSync(cfgPath)) {
      return null;
    }
    return yaml.load(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Port + pattern + optional Traefik host template for a url:// token.
 * @param {string} token
 * @param {Object} ctx
 * @param {Object} registry
 * @returns {{ appKey: string, listenPort: number, patternStr: string, hostTemplate: string|null, tls: boolean }|null}
 */
function resolveListenPortPatternForToken(token, ctx, registry) {
  const { targetKey } = parseUrlToken(token);
  const currentAppKey = ctx.currentAppKey || '';
  const appKey = targetKey || currentAppKey;
  if (!appKey) {
    return null;
  }
  const doc = loadApplicationYamlDocForUrlResolve(appKey, ctx);
  const entry = getRegistryEntryForApp(appKey, registry);
  let listenPort;
  let patternStr;
  if (entry) {
    listenPort = entry.port;
    patternStr = entry.pattern;
  } else if (doc) {
    listenPort = getContainerPort(doc, 3000);
    const raw = doc.frontDoorRouting && doc.frontDoorRouting.pattern;
    patternStr = typeof raw === 'string' ? raw : '/';
  } else {
    return null;
  }
  const meta = readFrontDoorHostTlsFromDoc(doc);
  return {
    appKey,
    listenPort,
    patternStr,
    hostTemplate: meta.hostTemplate,
    tls: meta.tls
  };
}

/**
 * @param {Object} r - resolved app + patternPath + pathPrefix + remoteServer + profile + devNum + derivedEnvKey
 * @returns {string}
 */
function expandHostSurfacePublic(r) {
  const origin = buildPublicHostOriginString({
    profile: r.profile,
    listenPort: r.listenPort,
    developerIdNum: r.devNum,
    remoteServer: r.remoteServer,
    traefik: r.traefik,
    hostTemplate: r.hostTemplate,
    tls: r.tls,
    developerIdRaw: r.developerIdRaw
  });
  return applyTstRemoteDeveloperHostToOrigin(origin, r.remoteServer, r.devNum, r.derivedEnvKey);
}

/**
 * @param {Object} r
 * @returns {string}
 */
function expandHostSurfaceInternal(r) {
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
    developerIdRaw: r.developerIdRaw
  });
}

/**
 * @param {Object} r
 * @returns {string}
 */
function expandFullSurfacePublic(r) {
  const out = buildPublicUrlString({
    profile: r.profile,
    listenPort: r.listenPort,
    developerIdNum: r.devNum,
    remoteServer: r.remoteServer,
    pathPrefix: r.pathPrefix,
    patternPath: r.patternPath,
    traefik: r.traefik,
    hostTemplate: r.hostTemplate,
    tls: r.tls,
    developerIdRaw: r.developerIdRaw
  });
  return applyTstRemoteDeveloperHost(out, r.remoteServer, r.devNum, r.derivedEnvKey);
}

/**
 * @param {Object} r
 * @returns {string}
 */
function expandFullSurfaceInternal(r) {
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
    developerIdRaw: r.developerIdRaw
  });
}

/**
 * @param {{ kind: string, surface: string }} parsed
 * @param {Object} r
 * @returns {string}
 */
function expandResolvedUrlToken(parsed, r) {
  if (parsed.surface === 'vdir') {
    return r.patternPath || '/';
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
