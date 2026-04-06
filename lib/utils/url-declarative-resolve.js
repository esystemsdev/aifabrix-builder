/**
 * Expand url://public, url://internal, url://<app>-public|internal after kv:// (plan 122).
 *
 * @fileoverview Dual profile docker|local; tst remote host uses devNN. subdomain (golden matrices)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { deriveEnvKeyFromClientId } = require('./derive-env-key-from-client-id');
const { parseDeveloperIdNum, publishedHostPort, localHostPort } = require('./declarative-url-ports');
const { computePublicUrlPathPrefix } = require('./url-public-path-prefix');
const {
  refreshUrlsLocalRegistryFromBuilder,
  getRegistryEntryForApp,
  normalizePatternForUrl
} = require('./urls-local-registry');
const { getContainerPort } = require('./port-resolver');
const pathsUtil = require('./paths');

const URL_REF = /url:\/\/([^\s#'"]+)/g;

/**
 * @param {string} content - .env-like content
 * @returns {Object.<string, string>}
 */
function parseSimpleEnvMap(content) {
  const map = {};
  if (!content || typeof content !== 'string') {
    return map;
  }
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      map[k] = t.slice(eq + 1);
    }
  }
  return map;
}

/**
 * Load application.yaml for cross-app scoped flag.
 * @param {string} targetAppKey
 * @returns {boolean}
 */
function readTargetAppScopedFlag(targetAppKey) {
  try {
    const appPath = pathsUtil.getBuilderPath(targetAppKey);
    const cfgPath = path.join(appPath, 'application.yaml');
    if (!fs.existsSync(cfgPath)) {
      return false;
    }
    const doc = yaml.load(fs.readFileSync(cfgPath, 'utf8'));
    return doc && doc.environmentScopedResources === true;
  } catch {
    return false;
  }
}

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
    patternPath
  } = opts;
  const hostPort = profile === 'docker'
    ? publishedHostPort(listenPort, developerIdNum)
    : localHostPort(listenPort, developerIdNum);
  const pathSuffix = `${pathPrefix}${patternPath === '/' ? '' : patternPath}`.replace(/\/{2,}/g, '/') || '/';
  const normalizedSuffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  if (remoteServer && String(remoteServer).trim()) {
    const base = String(remoteServer).trim().replace(/\/+$/, '');
    return joinUrlPath(base, normalizedSuffix);
  }
  return joinUrlPath(`http://localhost:${hostPort}`, normalizedSuffix);
}

/**
 * @param {Object} opts
 * @returns {string}
 */
function buildInternalUrlString(opts) {
  const {
    profile,
    listenPort,
    targetAppKey,
    remoteServer,
    pathPrefix,
    patternPath,
    developerIdNum,
    derivedEnvKey
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
      patternPath
    });
    return applyTstRemoteDeveloperHost(pub, remoteServer, developerIdNum, derivedEnvKey);
  }
  return `http://${targetAppKey}:${listenPort}`;
}

/**
 * @param {string} token - e.g. public, miso-controller-internal
 * @returns {{ targetKey: string, kind: 'public'|'internal' }}
 */
function parseUrlToken(token) {
  const t = String(token || '').trim();
  if (t === 'public') {
    return { targetKey: '', kind: 'public' };
  }
  if (t === 'internal') {
    return { targetKey: '', kind: 'internal' };
  }
  if (t.endsWith('-public')) {
    return { targetKey: t.slice(0, -'-public'.length), kind: 'public' };
  }
  if (t.endsWith('-internal')) {
    return { targetKey: t.slice(0, -'-internal'.length), kind: 'internal' };
  }
  return { targetKey: '', kind: 'public' };
}

/**
 * Port + pattern for a url:// token from registry or current app application.yaml.
 * @param {string} token
 * @param {Object} ctx
 * @param {Object} registry
 * @returns {{ appKey: string, listenPort: number, patternStr: string }|null}
 */
function resolveListenPortPatternForToken(token, ctx, registry) {
  const { targetKey } = parseUrlToken(token);
  const currentAppKey = ctx.currentAppKey || '';
  const appKey = targetKey || currentAppKey;
  if (!appKey) {
    return null;
  }
  const entry = getRegistryEntryForApp(appKey, registry);
  if (entry) {
    return { appKey, listenPort: entry.port, patternStr: entry.pattern };
  }
  if (ctx.variablesPath && appKey === currentAppKey) {
    try {
      const doc = yaml.load(fs.readFileSync(ctx.variablesPath, 'utf8'));
      const listenPort = getContainerPort(doc, 3000);
      const raw = doc.frontDoorRouting && doc.frontDoorRouting.pattern;
      const patternStr = typeof raw === 'string' ? raw : '/';
      return { appKey, listenPort, patternStr };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Resolve one url:// token to a concrete URL string.
 * @param {string} token
 * @param {Object} ctx - Same shape as expandDeclarativeUrlsInEnvContent ctx
 * @param {'docker'|'local'} profile
 * @param {number} devNum
 * @param {string} derivedEnvKey
 * @param {Object} registry
 * @returns {string}
 */
function replaceUrlRefToken(token, ctx, profile, devNum, derivedEnvKey, registry) {
  const { kind, targetKey } = parseUrlToken(token);
  const resolved = resolveListenPortPatternForToken(token, ctx, registry);
  if (!resolved) {
    return `url://${token}`;
  }
  const { appKey, listenPort, patternStr } = resolved;
  const patternPath = normalizePatternForUrl(patternStr);
  const appScoped = targetKey
    ? readTargetAppScopedFlag(targetKey)
    : Boolean(ctx.appEnvironmentScopedResources);
  const pathPrefix = computePublicUrlPathPrefix(
    ctx.useEnvironmentScopedResources,
    appScoped,
    derivedEnvKey
  );
  const remoteServer = ctx.remoteServer;
  if (kind === 'public') {
    let out = buildPublicUrlString({
      profile,
      listenPort,
      developerIdNum: devNum,
      remoteServer,
      pathPrefix,
      patternPath
    });
    out = applyTstRemoteDeveloperHost(out, remoteServer, devNum, derivedEnvKey);
    return out;
  }
  return buildInternalUrlString({
    profile,
    listenPort,
    targetAppKey: appKey,
    remoteServer,
    pathPrefix,
    patternPath,
    developerIdNum: devNum,
    derivedEnvKey
  });
}

/**
 * Expand url:// references in env content (after kv://).
 *
 * @async
 * @param {string} content
 * @param {Object} ctx
 * @param {'docker'|'local'} ctx.profile
 * @param {string} ctx.currentAppKey
 * @param {string|null} ctx.variablesPath
 * @param {boolean} ctx.useEnvironmentScopedResources
 * @param {boolean} ctx.appEnvironmentScopedResources
 * @param {string|null|undefined} ctx.remoteServer
 * @param {string|number|null|undefined} ctx.developerIdRaw
 * @returns {Promise<string>}
 */
async function expandDeclarativeUrlsInEnvContent(content, ctx) {
  if (!content || !content.includes('url://')) {
    return content;
  }
  const profile = ctx.profile === 'docker' ? 'docker' : 'local';
  const devNum = parseDeveloperIdNum(ctx.developerIdRaw);
  const envMap = parseSimpleEnvMap(content);
  const clientId = envMap.MISO_CLIENTID;
  const pipelineOverride = envMap.MISO_PIPELINE_ENV_KEY;
  const derivedEnvKey = deriveEnvKeyFromClientId(clientId, pipelineOverride);
  const registry = refreshUrlsLocalRegistryFromBuilder(pathsUtil.getProjectRoot());

  const lines = content.split('\n');
  const outLines = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#') || !line.includes('url://')) {
      return line;
    }
    return line.replace(URL_REF, (_m, token) =>
      replaceUrlRefToken(token, ctx, profile, devNum, derivedEnvKey, registry)
    );
  });
  return outLines.join('\n');
}

module.exports = {
  expandDeclarativeUrlsInEnvContent,
  parseSimpleEnvMap,
  applyTstRemoteDeveloperHost,
  buildPublicUrlString,
  buildInternalUrlString,
  parseUrlToken
};
