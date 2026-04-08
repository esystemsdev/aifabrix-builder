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
    infraTlsEnabled
  } = opts;
  const base = computePublicUrlBaseString({
    traefik: Boolean(traefik),
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
 * True when the app opts into Traefik path routing (compose adds ingress labels when infra Traefik runs).
 * @param {object|null|undefined} doc
 * @returns {boolean}
 */
function readFrontDoorIngressActiveFromDoc(doc) {
  return Boolean(doc && doc.frontDoorRouting && doc.frontDoorRouting.enabled === true);
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
 * @returns {{ appKey: string, listenPort: number, patternStr: string, hostTemplate: string|null, tls: boolean, frontDoorIngressActive: boolean }|null}
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
  const frontDoorIngressActive =
    Boolean(ctx.traefik) && readFrontDoorIngressActiveFromDoc(doc);
  return {
    appKey,
    listenPort,
    patternStr,
    hostTemplate: meta.hostTemplate,
    tls: meta.tls,
    frontDoorIngressActive
  };
}

/**
 * @param {Object} r - resolved app + patternPath + pathPrefix + remoteServer + profile + devNum + derivedEnvKey
 * @returns {string}
 */
function expandHostSurfacePublic(r) {
  return buildPublicHostOriginString({
    profile: r.profile,
    listenPort: r.listenPort,
    developerIdNum: r.devNum,
    remoteServer: r.remoteServer,
    traefik: r.traefik,
    hostTemplate: r.hostTemplate,
    tls: r.tls,
    developerIdRaw: r.developerIdRaw,
    infraTlsEnabled: r.infraTlsEnabled
  });
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
    listenPort: r.listenPort,
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
