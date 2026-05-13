/**
 * User `applications` entries in config.yaml (read by `aifabrix resolve`, written by `aifabrix run` dev).
 *
 * @fileoverview Per-app reload and `proxy` (Traefik/public URL hints) in ~/.aifabrix/config.yaml
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const config = require('../core/config');

/**
 * Persist `applications.<appKey>.reload` from the last `aifabrix run` (dev only; CLI is source of truth).
 *
 * @async
 * @param {string} appKey - Application key
 * @param {boolean} reload - Same as passing `--reload` on run
 * @returns {Promise<void>}
 */
async function persistApplicationReloadFlag(appKey, reload) {
  if (!appKey || typeof appKey !== 'string') {
    return;
  }
  const cfg = await config.getConfig();
  if (!cfg.applications || typeof cfg.applications !== 'object') {
    cfg.applications = {};
  }
  const prev = cfg.applications[appKey];
  const nextEntry =
    prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...prev, reload: Boolean(reload) } : { reload: Boolean(reload) };
  cfg.applications[appKey] = nextEntry;
  await config.saveConfig(cfg);
}

/**
 * @param {Object|null|undefined} userConfig - Parsed config.yaml root
 * @param {string} appKey - Application key (folder / app.key)
 * @returns {boolean} True when `applications.<appKey>.reload` is explicitly true
 */
function isApplicationsReloadDefaultOn(userConfig, appKey) {
  if (!userConfig || !appKey || typeof appKey !== 'string') {
    return false;
  }
  const apps = userConfig.applications;
  if (!apps || typeof apps !== 'object') {
    return false;
  }
  const entry = apps[appKey];
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  return entry.reload === true;
}

/**
 * True when `remote-server` is set to a non-empty value in config (after trim).
 *
 * @param {string|null|undefined} remoteServer - Value from Builder config `getRemoteServer()` / `remote-server`
 * @returns {boolean}
 */
function isRemoteServerConfigured(remoteServer) {
  return Boolean(remoteServer && String(remoteServer).trim());
}

/**
 * Whether `build.envOutputPath` should get **local**-flavored regeneration (IDE/host) while
 * `builder/<app>/.env` stays **docker**-flavored. True when `applications.<appKey>.reload` is true
 * and **no** `remote-server` is configured; when both reload and remote-server are set, false so
 * envOutputPath matches the docker copy path (remote reload workflow).
 *
 * @param {Object|null|undefined} userConfig - Parsed config.yaml root
 * @param {string} appKey - Application key
 * @param {string|null|undefined} remoteServer - From config `remote-server` (URL or host)
 * @returns {boolean}
 */
function isPreferLocalEnvOutputPath(userConfig, appKey, remoteServer) {
  if (!isApplicationsReloadDefaultOn(userConfig, appKey)) {
    return false;
  }
  return !isRemoteServerConfigured(remoteServer);
}

/**
 * For `aifabrix resolve`: whether `build.envOutputPath` should use local-flavored regeneration.
 * Reads `remote-server` from Builder config.
 *
 * @async
 * @param {Object|null|undefined} userConfig
 * @param {string} appKey
 * @returns {Promise<boolean>}
 */
async function resolvePreferLocalEnvOutputPathFlag(userConfig, appKey) {
  let remoteServer = null;
  try {
    const rs = await config.getRemoteServer();
    if (rs && String(rs).trim()) {
      remoteServer = String(rs).trim();
    }
  } catch {
    remoteServer = null;
  }
  return isPreferLocalEnvOutputPath(userConfig, appKey, remoteServer);
}

/**
 * Normalize YAML boolean-ish values.
 * @param {unknown} v
 * @returns {boolean|undefined} undefined if absent / not coercible
 */
function coerceTriStateBool(v) {
  if (v === true || v === 'true' || v === 'yes' || v === 'on' || v === 1 || v === '1') {
    return true;
  }
  if (v === false || v === 'false' || v === 'no' || v === 'off' || v === 0 || v === '0') {
    return false;
  }
  return undefined;
}

/**
 * Whether `aifabrix run` / resolve should use Traefik-style public URL hints for this app when infra allows.
 * Default **false** when unset. Legacy `noProxy: true` ⇒ false; legacy `noProxy: false` with no `proxy` ⇒ true.
 *
 * @param {Object|null|undefined} userConfig - Parsed config.yaml root
 * @param {string} appKey - Application key
 * @returns {boolean}
 */
function getApplicationsRunProxyHint(userConfig, appKey) {
  if (!userConfig || !appKey || typeof appKey !== 'string') {
    return false;
  }
  const apps = userConfig.applications;
  if (!apps || typeof apps !== 'object') {
    return false;
  }
  const entry = apps[appKey];
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const proxyCoerced = coerceTriStateBool(entry.proxy);
  if (proxyCoerced !== undefined) {
    return proxyCoerced;
  }
  const legacyNo = coerceTriStateBool(entry.noProxy);
  if (legacyNo === true) {
    return false;
  }
  if (legacyNo === false) {
    return true;
  }
  return false;
}

/**
 * Persist `applications.<appKey>.proxy` from each `aifabrix run` (same pattern as `reload` for dev-only reload flag).
 * `proxy: true` means use Traefik/front-door URL hints when infra + that app's `application.yaml` allow; `false` means docker `url://` **public** bases for **that app** use localhost + published port. During `resolve`/`run`, each `url://` token uses the **target** app's `applications.<targetKey>.proxy`, not only the app whose `env.template` is being expanded.
 * Removes legacy `noProxy` on the same entry when present.
 *
 * @async
 * @param {string} appKey - Application key
 * @param {boolean} proxyEnabled - Same as a normal `aifabrix run` with proxy hints on (`!isRunCliNoProxy(options)`)
 * @returns {Promise<void>}
 */
async function persistApplicationRunProxyFlag(appKey, proxyEnabled) {
  if (!appKey || typeof appKey !== 'string') {
    return;
  }
  const cfg = await config.getConfig();
  if (!cfg.applications || typeof cfg.applications !== 'object') {
    cfg.applications = {};
  }
  const prev = cfg.applications[appKey];
  const nextEntry =
    prev && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...prev, proxy: Boolean(proxyEnabled) }
      : { proxy: Boolean(proxyEnabled) };
  if (Object.prototype.hasOwnProperty.call(nextEntry, 'noProxy')) {
    delete nextEntry.noProxy;
  }
  cfg.applications[appKey] = nextEntry;
  await config.saveConfig(cfg);
}

/**
 * Whether declarative `url://*` expansion should treat Traefik as on (infra Traefik + per-app `proxy: true`).
 *
 * @param {Object|null|undefined} userConfig
 * @param {string} appKey
 * @returns {boolean}
 */
function isDeclarativeTraefikUrlsEnabled(userConfig, appKey) {
  return Boolean(userConfig && userConfig.traefik === true) && getApplicationsRunProxyHint(userConfig, appKey);
}

module.exports = {
  getApplicationsRunProxyHint,
  isApplicationsReloadDefaultOn,
  isDeclarativeTraefikUrlsEnabled,
  isPreferLocalEnvOutputPath,
  isRemoteServerConfigured,
  persistApplicationRunProxyFlag,
  persistApplicationReloadFlag,
  resolvePreferLocalEnvOutputPathFlag
};
