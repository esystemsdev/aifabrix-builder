/**
 * Declarative url:// expansion after kv:// (keeps secrets-env-content under max-lines).
 *
 * @fileoverview Declarative url:// expansion after kv://; shared ctx builder; show URL helper
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const config = require('./config');
const pathsUtil = require('../utils/paths');
const { readAppEnvironmentScopedFlagForAppPath } = require('../utils/app-scoped-config');
const { expandDeclarativeUrlsInEnvContent } = require('../utils/url-declarative-resolve');
const { rewriteInactiveDeclarativeVdirPublicContent } = require('../utils/url-declarative-vdir-inactive-env');
/**
 * Config inputs for declarative url:// expansion.
 * @param {string} appPath
 * @returns {Promise<Object>}
 */
async function loadDeclarativeUrlExpandInputs(appPath) {
  const userCfg = await config.getConfig();
  let remoteServer = null;
  try {
    const rs = await config.getRemoteServer();
    if (rs && String(rs).trim()) {
      remoteServer = String(rs).trim();
    }
  } catch {
    remoteServer = null;
  }
  let developerIdRaw = null;
  try {
    developerIdRaw = await config.getDeveloperId();
  } catch {
    developerIdRaw = null;
  }
  let infraTlsEnabled = false;
  try {
    infraTlsEnabled = await config.getTlsEnabled();
  } catch {
    infraTlsEnabled = false;
  }
  return {
    userCfg,
    remoteServer,
    developerIdRaw,
    infraTlsEnabled,
    appScopedFlag: readAppEnvironmentScopedFlagForAppPath(appPath)
  };
}

/**
 * Build ctx for {@link expandDeclarativeUrlsInEnvContent} from preloaded inputs.
 * @param {string} appName
 * @param {string|null|undefined} variablesPath
 * @param {string} environment
 * @param {Object} inputs - Result of {@link loadDeclarativeUrlExpandInputs}
 * @returns {Object}
 */
function buildDeclarativeUrlExpandContextFromInputs(appName, variablesPath, environment, inputs) {
  const { userCfg, remoteServer, developerIdRaw, infraTlsEnabled, appScopedFlag } = inputs;
  let projectRoot = null;
  try {
    const r = pathsUtil.getProjectRoot();
    if (r && String(r).trim()) {
      projectRoot = String(r).trim();
    }
  } catch {
    projectRoot = null;
  }
  return {
    profile: environment === 'docker' ? 'docker' : 'local',
    currentAppKey: appName,
    variablesPath,
    useEnvironmentScopedResources: Boolean(userCfg.useEnvironmentScopedResources),
    appEnvironmentScopedResources: appScopedFlag,
    remoteServer,
    developerIdRaw,
    infraTlsEnabled,
    userCfg,
    projectRoot
  };
}

/**
 * Resolve `url://public` and `url://internal` for the app (same rules as run `.env`, default `docker` profile).
 * @param {string} appKey
 * @param {string} appPath
 * @param {string|null|undefined} variablesPath
 * @param {string} [environment='docker'] - Matches `secrets-env-write` default so `url://internal` uses the same service host + vdir rules as the app `.env` copied for Docker run.
 * @returns {Promise<{ publicUrl: string, internalUrl: string }|null>}
 */
async function resolveDeclarativeShowUrlsForApp(appKey, appPath, variablesPath, environment = 'docker') {
  if (!variablesPath || !appPath || !appKey) {
    return null;
  }
  const inputs = await loadDeclarativeUrlExpandInputs(appPath);
  const { parseSimpleEnvMap } = require('../utils/url-declarative-resolve');
  let content = 'APP_SHOW_PUBLIC=url://public\nAPP_SHOW_INTERNAL=url://internal\n';
  content = rewriteInactiveDeclarativeVdirPublicContent(content, variablesPath, inputs.userCfg);
  if (!content.includes('url://')) {
    return null;
  }
  const ctx = buildDeclarativeUrlExpandContextFromInputs(appKey, variablesPath, environment, inputs);
  const out = await expandDeclarativeUrlsInEnvContent(content, ctx);
  const m = parseSimpleEnvMap(out);
  const publicUrl = m.APP_SHOW_PUBLIC;
  const internalUrl = m.APP_SHOW_INTERNAL;
  if (
    !publicUrl ||
    !internalUrl ||
    String(publicUrl).includes('url://') ||
    String(internalUrl).includes('url://')
  ) {
    return null;
  }
  return { publicUrl: String(publicUrl).trim(), internalUrl: String(internalUrl).trim() };
}

/**
 * After kv:// resolution, expand url:// references when application config exists.
 * @param {string} resolved
 * @param {string} appName
 * @param {string} appPath
 * @param {string|null} variablesPath
 * @param {string} environment
 * @param {boolean} envOnly
 * @returns {Promise<string>}
 */
async function expandDeclarativeUrlsIfPresent(resolved, appName, appPath, variablesPath, environment, envOnly) {
  if (envOnly || !variablesPath) {
    return resolved;
  }
  const { userCfg, remoteServer, developerIdRaw, infraTlsEnabled, appScopedFlag } =
    await loadDeclarativeUrlExpandInputs(appPath);
  resolved = rewriteInactiveDeclarativeVdirPublicContent(resolved, variablesPath, userCfg);
  if (!resolved.includes('url://')) {
    return resolved;
  }
  const ctx = buildDeclarativeUrlExpandContextFromInputs(appName, variablesPath, environment, {
    userCfg,
    remoteServer,
    developerIdRaw,
    infraTlsEnabled,
    appScopedFlag
  });
  return expandDeclarativeUrlsInEnvContent(resolved, ctx);
}

module.exports = {
  expandDeclarativeUrlsIfPresent,
  loadDeclarativeUrlExpandInputs,
  resolveDeclarativeShowUrlsForApp
};
