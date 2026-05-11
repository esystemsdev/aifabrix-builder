/**
 * kv:// resolution, declarative URL expansion, and .env generation (content + file write).
 *
 * @fileoverview Split from secrets.js for module size limits
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const config = require('./config');
const {
  interpolateEnvVars,
  collectMissingSecrets,
  formatMissingSecretsFileInfo,
  replaceKvInContent,
  loadEnvTemplate,
  adjustLocalEnvPortsInContent,
  rewriteInfraEndpoints
} = require('../utils/secrets-helpers');
const { buildEnvVarMap } = require('../utils/env-map');
const { resolveServicePortsInEnvContent } = require('../utils/secrets-url');
const { materializeResolvedKvSecretsToUserLocal } = require('../utils/secrets-materialize-local');
const {
  updatePortForDocker,
  getBaseDockerEnv,
  applyDockerEnvOverride,
  getContainerPortFromDockerEnv
} = require('./secrets-docker-env');
const { getContainerPortFromPath, loadVariablesFromPath } = require('../utils/port-resolver');
const secretsEnsure = require('./secrets-ensure');
const { resolveSecretsPath, getActualSecretsPath } = require('../utils/secrets-path');
const pathsUtil = require('../utils/paths');
const { readAppEnvironmentScopedFlagForAppPath } = require('../utils/app-scoped-config');
const { computeEffectiveEnvironmentScopedResources, redisDbIndexForScopedRunEnv } = require('../utils/environment-scoped-resources');
const { applyRedisDbIndexToEnvContent } = require('../utils/redis-env-scope');
const { expandDeclarativeUrlsInEnvContent } = require('../utils/url-declarative-resolve');
const { rewriteInactiveDeclarativeVdirPublicContent } = require('../utils/url-declarative-vdir-inactive-env');
const {
  mergeDockerManifestPublishedPort,
  rewriteDockerManifestPublicPortEnvLine
} = require('../utils/docker-manifest-public-port');
const { loadSecrets } = require('./secrets-load');

/**
 * Resolves kv:// references in environment template
 * Replaces kv://keyName with actual values from secrets
 *
 * @async
 * @param {string} envTemplate - Environment template content
 * @param {Object} secrets - Secrets object from loadSecrets()
 * @param {string} [environment='local'] - Environment context (docker/local)
 * @param {Object|string|null} [secretsFilePaths] - Paths object with userPath and buildPath, or string path (for backward compatibility)
 * @param {string} [appName] - Application name (optional, for error messages)
 * @returns {Promise<string>} Resolved environment content
 * @throws {Error} If kv:// reference cannot be resolved
 */
async function resolveKvReferences(envTemplate, secrets, environment = 'local', secretsFilePaths = null, appName = null, scopedKv = null) {
  const os = require('os');

  let developerId = null;
  try {
    developerId = await config.getDeveloperId();
  } catch {
    /* ignore */
  }

  const envKey = String(environment || 'local').toLowerCase();
  const mapContext = envKey === 'docker' || envKey === 'local' ? envKey : 'local';

  let envVars = await buildEnvVarMap(mapContext, os, developerId);
  if (!envVars || Object.keys(envVars).length === 0) {
    envVars = await buildEnvVarMap('local', os, developerId);
  }
  const resolved = interpolateEnvVars(envTemplate, envVars);
  const missing = collectMissingSecrets(resolved, secrets, scopedKv);
  if (missing.length > 0) {
    const fileInfo = formatMissingSecretsFileInfo(secretsFilePaths);
    const resolveCommand = appName ? `aifabrix resolve ${appName}` : 'aifabrix resolve <app-name>';
    throw new Error(`Missing secrets: ${missing.join(', ')}${fileInfo}\n\nRun "${resolveCommand}" to generate missing secrets.`);
  }
  return replaceKvInContent(resolved, secrets, envVars, scopedKv);
}

/**
 * Resolve run env key and effective env-scoped kv/redis behavior for generateEnvContent.
 *
 * @async
 * @param {string} appPath - Builder application directory
 * @param {Object} [options] - generateEnvContent options; may set runEnvKey
 * @returns {Promise<{ runEnvKey: string, effective: boolean }>}
 */
async function buildScopedKvContext(appPath, options = {}) {
  let runEnvKey;
  if (options.runEnvKey !== undefined && options.runEnvKey !== null) {
    runEnvKey = String(options.runEnvKey).toLowerCase();
  } else if (typeof config.getCurrentEnvironment === 'function') {
    runEnvKey = String((await config.getCurrentEnvironment()) || 'dev').toLowerCase();
  } else {
    runEnvKey = 'dev';
  }
  const userCfg =
    typeof config.getConfig === 'function'
      ? await config.getConfig()
      : { useEnvironmentScopedResources: false };
  const useGate = Boolean(userCfg.useEnvironmentScopedResources);
  const appFlag = readAppEnvironmentScopedFlagForAppPath(appPath);
  const effective = computeEffectiveEnvironmentScopedResources(useGate, appFlag, runEnvKey);
  return { runEnvKey, effective };
}

/**
 * Redis/DB service endpoints for docker env interpolation.
 * @returns {Promise<{ redisHost: string, redisPort: number, dbHost: string, dbPort: number }>}
 */
async function getDockerRedisDbEndpoints() {
  const { getEnvHosts, getServiceHost, getServicePort, getLocalhostOverride } = require('../utils/env-endpoints');
  const hosts = await getEnvHosts('docker');
  const localhostOverride = getLocalhostOverride('docker');
  const redisHost = getServiceHost(hosts.REDIS_HOST, 'docker', 'redis', localhostOverride);
  const redisPort = await getServicePort('REDIS_PORT', 'redis', hosts, 'docker', null);
  const dbHost = getServiceHost(hosts.DB_HOST, 'docker', 'postgres', localhostOverride);
  const dbPort = await getServicePort('DB_PORT', 'postgres', hosts, 'docker', null);
  return { redisHost, redisPort, dbHost, dbPort };
}

/**
 * Config inputs for declarative url:// expansion (keeps expandDeclarativeUrlsIfPresent small).
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
  return expandDeclarativeUrlsInEnvContent(resolved, {
    profile: environment === 'docker' ? 'docker' : 'local',
    currentAppKey: appName,
    variablesPath,
    useEnvironmentScopedResources: Boolean(userCfg.useEnvironmentScopedResources),
    appEnvironmentScopedResources: appScopedFlag,
    remoteServer,
    developerIdRaw,
    traefik: Boolean(userCfg.traefik),
    infraTlsEnabled
  });
}

/** Docker env transformations: ports, infra endpoints, PORT. */
async function applyDockerTransformations(resolved, variablesPath) {
  resolved = await resolveServicePortsInEnvContent(resolved, 'docker');
  resolved = await rewriteInfraEndpoints(resolved, 'docker');
  const { redisHost, redisPort, dbHost, dbPort } = await getDockerRedisDbEndpoints();
  let dockerEnv = await getBaseDockerEnv();
  dockerEnv = applyDockerEnvOverride(dockerEnv);
  const containerPort = getContainerPortFromPath(variablesPath) ?? getContainerPortFromDockerEnv(dockerEnv) ?? 3000;
  const envVars = await buildEnvVarMap('docker', null, null, { appPort: containerPort });
  const appDoc = loadVariablesFromPath(variablesPath);
  await mergeDockerManifestPublishedPort(envVars, appDoc);
  envVars.REDIS_HOST = redisHost;
  envVars.REDIS_PORT = String(redisPort);
  envVars.DB_HOST = dbHost;
  envVars.DB_PORT = String(dbPort);
  envVars.PORT = String(containerPort);
  resolved = interpolateEnvVars(resolved, envVars);
  resolved = rewriteDockerManifestPublicPortEnvLine(resolved, envVars, appDoc);
  return updatePortForDocker(resolved, variablesPath);
}

/** Environment-specific transformations to resolved content. */
async function applyEnvironmentTransformations(resolved, environment, variablesPath) {
  if (environment === 'docker') return applyDockerTransformations(resolved, variablesPath);
  if (environment === 'local') return adjustLocalEnvPortsInContent(resolved, variablesPath);
  return resolved;
}

/**
 * Generate .env content from template and secrets (no disk write).
 * When options.envOnly is true, variablesPath is null (no application config).
 *
 * @param {string} appName - Application name
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} [environment='local'] - Environment context
 * @param {boolean} [force=false] - Generate missing secret keys
 * @param {Object} [options] - Optional: appPath, envOnly (env-only mode uses only env.template); skipMaterializeKvToLocal skips persisting resolved kv to ~/.aifabrix/secrets.local.yaml. Materialization runs only when no explicit secretsPath is passed (default loadSecrets cascade uses ~/.aifabrix/secrets.local.yaml).
 * @returns {Promise<string>} Resolved env content
 */
async function generateEnvContent(appName, secretsPath, environment = 'local', force = false, options = {}) {
  const appPath = (options && options.appPath) || pathsUtil.getBuilderPath(appName);
  const templatePath = path.join(appPath, 'env.template');
  const variablesPath = (options && options.envOnly) ? null : resolveApplicationConfigPath(appPath);
  const template = loadEnvTemplate(templatePath);
  const secretsPaths = await getActualSecretsPath(secretsPath, appName);
  if (force) {
    const preferredPath = secretsPath ? resolveSecretsPath(secretsPath) : secretsPaths.userPath;
    await secretsEnsure.ensureSecretsFromEnvTemplate(templatePath, { preferredFilePath: preferredPath });
  }
  const secrets = await loadSecrets(secretsPath, appName);
  const { runEnvKey, effective } = await buildScopedKvContext(appPath, options);
  const scopedKv = { envKey: runEnvKey, effective };
  let resolved = await resolveKvReferences(template, secrets, environment, secretsPaths, appName, scopedKv);
  if (!secretsPath) {
    await materializeResolvedKvSecretsToUserLocal(template, secrets, scopedKv, options);
  }
  resolved = await expandDeclarativeUrlsIfPresent(
    resolved,
    appName,
    appPath,
    variablesPath,
    environment,
    Boolean(options.envOnly)
  );
  resolved = await applyEnvironmentTransformations(resolved, environment, variablesPath);
  if (effective) {
    const idx = redisDbIndexForScopedRunEnv(runEnvKey);
    resolved = applyRedisDbIndexToEnvContent(resolved, idx);
  }

  return resolved;
}

/**
 * Parses .env file content into a key-to-value map.
 * Only includes lines that look like KEY=value (first = separates key and value).
 *
 * @param {string} content - Raw .env file content
 * @returns {Object.<string, string>} Map of variable name to value
 */
function parseEnvContentToMap(content) {
  if (!content || typeof content !== 'string') {
    return {};
  }
  const map = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.substring(0, eq).trim();
      const value = trimmed.substring(eq + 1);
      map[key] = value;
    }
  }
  return map;
}

/**
 * Merges new .env content with existing .env: newly resolved content wins for keys it
 * defines (so project secrets take effect when re-running). Keys only in existing .env
 * are appended so manual additions are kept.
 *
 * @param {string} newContent - Newly generated .env content (from template + loadSecrets)
 * @param {Object.<string, string>} existingMap - Existing key-to-value map from current .env
 * @returns {string} Merged content: new values for keys in newContent, plus extra existing keys
 */
function mergeEnvContentPreservingExisting(newContent, existingMap) {
  const lines = newContent.split(/\r?\n/);
  const newKeys = new Set();
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.substring(0, eq).trim();
      newKeys.add(key);
    }
    out.push(line);
  }
  if (existingMap && Object.keys(existingMap).length > 0) {
    for (const key of Object.keys(existingMap)) {
      if (!newKeys.has(key)) {
        out.push(`${key}=${existingMap[key]}`);
      }
    }
  }
  return out.join('\n');
}

/**
 * Merges a key-value map into existing .env file content, preserving comments and blank lines.
 * For each KEY=value line in existing content, replaces value with newMap[KEY] when the key exists
 * in newMap. Appends any keys from newMap that did not appear in the file.
 *
 * @param {string} existingContent - Full existing .env file content
 * @param {Object.<string, string>} newMap - New key-to-value map (e.g. from resolved or run env)
 * @returns {string} Merged content with comments preserved
 */
function mergeEnvMapIntoContent(existingContent, newMap) {
  if (!newMap || Object.keys(newMap).length === 0) {
    return typeof existingContent === 'string' ? existingContent : '';
  }
  const lines = (existingContent || '').split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.substring(0, eq).trim();
      seen.add(key);
      out.push(Object.prototype.hasOwnProperty.call(newMap, key) ? `${key}=${newMap[key]}` : line);
      continue;
    }
    out.push(line);
  }
  for (const key of Object.keys(newMap)) {
    if (!seen.has(key)) out.push(`${key}=${newMap[key]}`);
  }
  return out.join('\n');
}

/**
 * Resolves content to write for .env: merges with existing file when present.
 * @param {string} resolved - Newly generated content
 * @param {string} pathToPreserve - Path to existing .env to merge from (or null)
 * @returns {string} Content to write
 */
function resolveEnvContentToWrite(resolved, pathToPreserve) {
  if (!pathToPreserve || !fs.existsSync(pathToPreserve)) return resolved;
  const existingContent = fs.readFileSync(pathToPreserve, 'utf8');
  const existingMap = parseEnvContentToMap(existingContent);
  return mergeEnvContentPreservingExisting(resolved, existingMap);
}

/**
 * Generates and writes .env file. Newly resolved values win over existing .env; extra vars in existing .env are kept.
 * When options.envOnly is true, only env.template is used; .env is written to options.appPath.
 * @async
 * @param {string} appName - Name of the application
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} [environment='local'] - Environment context ('local' or 'docker')
 * @param {boolean} [force=false] - Generate missing secret keys in secrets file
 * @param {Object} [options] - Optional: appPath, envOnly, skipOutputPath, preserveFromPath
 * @returns {Promise<string>} Path to generated .env file
 */
async function generateEnvFile(appName, secretsPath, environment = 'local', force = false, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const appPath = opts.appPath || pathsUtil.getBuilderPath(appName);
  const envOnly = !!opts.envOnly;
  const variablesPath = envOnly ? null : resolveApplicationConfigPath(appPath);
  const envPath = path.join(appPath, '.env');

  if (envOnly) {
    const templatePath = path.join(appPath, 'env.template');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`env.template not found at ${templatePath}. Resolve requires env.template in the app directory.`);
    }
  }

  const resolved = await generateEnvContent(appName, secretsPath, environment, force, { appPath, envOnly });
  const preservePath = opts.preserveFromPath !== undefined && opts.preserveFromPath !== null ? opts.preserveFromPath : null;
  const pathToPreserve = preservePath !== null ? preservePath : envPath;
  const toWrite = resolveEnvContentToWrite(resolved, pathToPreserve);
  fs.writeFileSync(envPath, toWrite, { mode: 0o600 });

  if (!opts.skipOutputPath) {
    const { processEnvVariables } = require('../utils/env-copy');
    await processEnvVariables(envPath, variablesPath, appName, secretsPath);
  }

  return envPath;
}

module.exports = {
  resolveKvReferences,
  generateEnvContent,
  generateEnvFile,
  parseEnvContentToMap,
  mergeEnvMapIntoContent
};
