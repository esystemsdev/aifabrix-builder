/**
 * Expand url:// placeholders after kv:// (plan 122): full URL, host-only (origin), and vdir (path) variants.
 *
 * @fileoverview Dual profile docker|local; devNN host only via Traefik + frontDoorRouting.host (plan 122)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fsRealSync = require('../internal/fs-real-sync');
const path = require('path');
const yaml = require('js-yaml');
const { deriveEnvKeyFromClientId } = require('./derive-env-key-from-client-id');
const { parseDeveloperIdNum } = require('./declarative-url-ports');
const { computeDeclarativePathPrefix } = require('./url-declarative-url-flags');
const { refreshUrlsLocalRegistryFromBuilder, normalizePatternForUrl } = require('./urls-local-registry');
const pathsUtil = require('./paths');
const {
  applyTstRemoteDeveloperHost,
  applyTstRemoteDeveloperHostToOrigin,
  buildPublicUrlString,
  buildPublicHostOriginString,
  buildInternalUrlString,
  buildInternalHostOriginString,
  parseUrlToken,
  expandResolvedUrlToken,
  resolveListenPortPatternForToken
} = require('./url-declarative-resolve-build');

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
    if (!fsRealSync.existsSync(cfgPath)) {
      return false;
    }
    const doc = yaml.load(fsRealSync.readFileSync(cfgPath, 'utf8'));
    return doc && doc.environmentScopedResources === true;
  } catch {
    return false;
  }
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
  const parsed = parseUrlToken(token);
  const resolved = resolveListenPortPatternForToken(token, ctx, registry);
  if (!resolved) {
    return `url://${token}`;
  }
  const { appKey, listenPort, patternStr, hostTemplate, tls, frontDoorIngressActive } =
    resolved;
  const patternPath = normalizePatternForUrl(patternStr);
  const appScoped = parsed.targetKey
    ? readTargetAppScopedFlag(parsed.targetKey)
    : Boolean(ctx.appEnvironmentScopedResources);
  const pathPrefix = computeDeclarativePathPrefix(
    Boolean(ctx.traefik),
    ctx.useEnvironmentScopedResources,
    appScoped,
    derivedEnvKey
  );
  return expandResolvedUrlToken(parsed, {
    profile,
    listenPort,
    appKey,
    patternPath,
    pathPrefix,
    remoteServer: ctx.remoteServer,
    devNum,
    derivedEnvKey,
    traefik: Boolean(ctx.traefik),
    hostTemplate,
    tls,
    frontDoorIngressActive,
    developerIdRaw: ctx.developerIdRaw,
    infraTlsEnabled: Boolean(ctx.infraTlsEnabled)
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
 * @param {boolean} [ctx.traefik] - Infra Traefik proxy on. Plan 117 `/dev`/`/tst` applies only when this is true. Traefik **host** authority (`frontDoorRouting.host`) applies only when this is true **and** the target app has `frontDoorRouting.enabled: true` (plan 124 `pathActive`).
 * @param {boolean} [ctx.infraTlsEnabled] - When true (`tlsEnabled` in config / `up-infra --tls`), Traefik front-door `url://public` uses https even if application.yaml has `frontDoorRouting.tls: false`
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
  applyTstRemoteDeveloperHostToOrigin,
  buildPublicUrlString,
  buildPublicHostOriginString,
  buildInternalUrlString,
  buildInternalHostOriginString,
  parseUrlToken
};
