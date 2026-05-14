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
const { parseUrlToken } = require('./url-declarative-token-parse');
const {
  getApplicationsRunProxyHint
} = require('./applications-config-defaults');
const {
  applyTstRemoteDeveloperHost,
  applyTstRemoteDeveloperHostToOrigin,
  buildPublicUrlString,
  buildPublicHostOriginString,
  buildInternalUrlString,
  buildInternalHostOriginString,
  expandResolvedUrlToken,
  resolveListenPortPatternForToken
} = require('./url-declarative-resolve-build');

const URL_REF = /url:\/\/([^\s#'"]+)/g;

/**
 * Expand each `url://token` in a value (comma-separated lists, e.g. CORS ALLOWED_ORIGINS).
 * Tokens match {@link parseUrlToken} id characters (alphanumeric, dot, underscore, hyphen).
 *
 * @param {string} value - RHS of KEY=value
 * @param {function(string): string} replaceToken - receives token without `url://`
 * @returns {string}
 */
function expandDeclarativeUrlListValue(value, replaceToken) {
  if (!value || typeof value !== 'string' || !value.includes('url://')) {
    return value;
  }
  return value
    .split(',')
    .map((raw) => {
      const seg = raw.trim();
      const exact = /^url:\/\/([a-zA-Z0-9._-]+)$/.exec(seg);
      if (exact) {
        return replaceToken(exact[1]);
      }
      if (seg.includes('url://')) {
        return seg.replace(/url:\/\/([a-zA-Z0-9._-]+)/g, (_full, tok) => replaceToken(tok));
      }
      return seg;
    })
    .join(',');
}

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
  const {
    appKey,
    listenPort,
    publicPortBasis,
    patternStr,
    hostTemplate,
    tls,
    frontDoorIngressActive,
    perTokenTraefik,
    internalDockerUseOriginOnly
  } = resolved;
  const traefikForToken = perTokenTraefik;
  let declarativePublicUrlsUseLocalhostForToken;
  if (ctx.userCfg && appKey) {
    declarativePublicUrlsUseLocalhostForToken = !getApplicationsRunProxyHint(ctx.userCfg, appKey);
  } else if (ctx.declarativePublicUrlsUseLocalhost === undefined) {
    declarativePublicUrlsUseLocalhostForToken = undefined;
  } else {
    declarativePublicUrlsUseLocalhostForToken = Boolean(ctx.declarativePublicUrlsUseLocalhost);
  }
  const patternPath = normalizePatternForUrl(patternStr);
  const appScoped = parsed.targetKey
    ? readTargetAppScopedFlag(parsed.targetKey)
    : Boolean(ctx.appEnvironmentScopedResources);
  const pathPrefix = computeDeclarativePathPrefix(
    traefikForToken,
    ctx.useEnvironmentScopedResources,
    appScoped,
    derivedEnvKey
  );
  return expandResolvedUrlToken(parsed, {
    profile,
    listenPort,
    publicPortBasis,
    appKey,
    currentAppKey: ctx.currentAppKey || '',
    patternPath,
    pathPrefix,
    remoteServer: ctx.remoteServer,
    devNum,
    derivedEnvKey,
    traefik: traefikForToken,
    hostTemplate,
    tls,
    frontDoorIngressActive,
    developerIdRaw: ctx.developerIdRaw,
    infraTlsEnabled: Boolean(ctx.infraTlsEnabled),
    internalDockerUseOriginOnly,
    declarativePublicUrlsUseLocalhost: declarativePublicUrlsUseLocalhostForToken
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
 * @param {boolean} [ctx.traefik] - When `ctx.userCfg` is absent: global Traefik-style URL flag. When `ctx.userCfg` is set: `ctx.traefik` is ignored for per-token Traefik; see {@link resolveDeclarativeUrlSurfaceState}.
 * @param {boolean|undefined} [ctx.declarativePublicUrlsUseLocalhost] - When `ctx.userCfg` is absent: **`undefined`** (default) skips `remote-server` when Traefik is off; **`true`** forces localhost; **`false`** allows remote authority without Traefik. When `ctx.userCfg` is set: ignored; derived per target app from `applications.<target>.proxy`.
 * @param {Object} [ctx.userCfg] - `~/.aifabrix/config.yaml` root; when set, `applications.<app>.proxy` and `traefik` apply per **target** app for each `url://` token (so e.g. Keycloak URLs follow `applications.keycloak`, not only the app being resolved).
 * @param {string|null|undefined} [ctx.projectRoot] - Optional absolute project root for `builder/<app>/application.yaml` discovery and `urls.local.yaml` refresh; when set, avoids relying on `paths.getProjectRoot()` (stable under cross-test `paths` mocks).
 * @param {boolean} [ctx.excludeCwdBuilderScan] - When **true**, {@link refreshUrlsLocalRegistryFromBuilder} skips appending the checkout `cwd/builder` scan pass (tests / isolated fixtures that must not merge the ambient repo `builder/` into `urls.local.yaml`). Omit or **false** for normal CLI and `.env` expansion.
 * @param {boolean} [ctx.infraTlsEnabled] - When true (`tlsEnabled` in config / `up-infra --tls`), Traefik front-door `url://public` uses **https**; when **false**, front-door bases use **http** (regardless of `frontDoorRouting.tls`). Loopback hosts stay **http**.
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
  const pr =
    ctx.projectRoot !== undefined && ctx.projectRoot !== null ? String(ctx.projectRoot).trim() : '';
  const registryRoot = pr || pathsUtil.getProjectRoot();
  const registry =
    ctx.excludeCwdBuilderScan === true
      ? refreshUrlsLocalRegistryFromBuilder(registryRoot, { excludeCwdBuilderScan: true })
      : refreshUrlsLocalRegistryFromBuilder(registryRoot);

  const lines = content.split('\n');
  const outLines = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#') || !line.includes('url://')) {
      return line;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      return line.replace(URL_REF, (_m, token) =>
        replaceUrlRefToken(token, ctx, profile, devNum, derivedEnvKey, registry)
      );
    }
    const keyPart = line.slice(0, eq);
    const valuePart = line.slice(eq + 1);
    const expandedValue = expandDeclarativeUrlListValue(valuePart, (token) =>
      replaceUrlRefToken(token, ctx, profile, devNum, derivedEnvKey, registry)
    );
    return `${keyPart}=${expandedValue}`;
  });
  return outLines.join('\n');
}

module.exports = {
  expandDeclarativeUrlsInEnvContent,
  expandDeclarativeUrlListValue,
  parseSimpleEnvMap,
  applyTstRemoteDeveloperHost,
  applyTstRemoteDeveloperHostToOrigin,
  buildPublicUrlString,
  buildPublicHostOriginString,
  buildInternalUrlString,
  buildInternalHostOriginString,
  parseUrlToken
};
