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
const { expandDeclarativeUrlsIfPresent } = require('./secrets-env-declarative-expand');
const {
  mergeDockerManifestPublishedPort,
  rewriteDockerManifestPublicPortEnvLine
} = require('../utils/docker-manifest-public-port');
const { loadSecrets } = require('./secrets-load');
const { buildMissingSecretsErrorMessage } = require('../utils/secrets-missing-error');

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
 * @param {Object|null} [resolveOpts] - Scoped kv (`envKey`, `effective`) and/or `envTemplatePath` for error hints
 * @returns {Promise<string>} Resolved environment content
 * @throws {Error} If kv:// reference cannot be resolved
 */
async function resolveKvReferences(
  envTemplate,
  secrets,
  environment = 'local',
  secretsFilePaths = null,
  appName = null,
  resolveOpts = null
) {
  const envTemplatePath =
    resolveOpts && typeof resolveOpts === 'object' ? resolveOpts.envTemplatePath || null : null;
  const scopedKv =
    resolveOpts && typeof resolveOpts === 'object' && (resolveOpts.envKey !== undefined || resolveOpts.effective !== undefined)
      ? { envKey: resolveOpts.envKey, effective: resolveOpts.effective }
      : null;
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
    throw new Error(
      buildMissingSecretsErrorMessage({
        missing,
        secrets,
        secretsFilePaths,
        appName,
        envTemplatePath,
        envTemplate
      })
    );
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
  let resolved = await resolveKvReferences(template, secrets, environment, secretsPaths, appName, {
    envKey: runEnvKey,
    effective,
    envTemplatePath: templatePath
  });
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
 * Merges a key-value map into existing .env file content, preserving comments and blank lines.
 * For each KEY=value line in existing content, replaces value with newMap[KEY] when the key exists
 * in newMap. By default appends keys from newMap that did not appear in the file; set
 * `appendMissingFromNewMap: false` to only update keys already present (e.g. `--reload` into a
 * resolve-generated file so run-only keys like DB_0_NAME are not tacked on the end).
 *
 * @param {string} existingContent - Full existing .env file content
 * @param {Object.<string, string>} newMap - New key-to-value map (e.g. from resolved or run env)
 * @param {Object} [options] - Merge options
 * @param {boolean} [options.appendMissingFromNewMap=true] - When false, do not append keys only in newMap
 * @returns {string} Merged content with comments preserved
 */
function collectSeenKeysAndMergeEnvLines(lines, newMap) {
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
  return { out, seen };
}

function appendMissingEnvKeysFromMap(out, seen, newMap) {
  for (const key of Object.keys(newMap)) {
    if (!seen.has(key)) {
      out.push(`${key}=${newMap[key]}`);
    }
  }
}

function mergeEnvMapIntoContent(existingContent, newMap, options = {}) {
  if (!newMap || Object.keys(newMap).length === 0) {
    return typeof existingContent === 'string' ? existingContent : '';
  }
  const appendMissing = options.appendMissingFromNewMap !== false;
  const lines = (existingContent || '').split(/\r?\n/);
  const { out, seen } = collectSeenKeysAndMergeEnvLines(lines, newMap);
  if (appendMissing) {
    appendMissingEnvKeysFromMap(out, seen, newMap);
  }
  return out.join('\n');
}

/**
 * Resolves content to write for .env: merges with existing file when present.
 * Uses {@link mergeEnvMapIntoContent} so new template keys are appended and comments in the
 * existing file are preserved (unlike a full replace).
 *
 * @param {string} resolved - Newly generated content
 * @param {string} pathToPreserve - Path to existing .env to merge from (or null)
 * @param {Object} [options]
 * @param {boolean} [options.freshEnv=false] - When true, write full resolved content (no merge)
 * @returns {string} Content to write
 */
function resolveEnvContentToWrite(resolved, pathToPreserve, options = {}) {
  if (options.freshEnv === true || !pathToPreserve || !fs.existsSync(pathToPreserve)) {
    return resolved;
  }
  const existingContent = fs.readFileSync(pathToPreserve, 'utf8');
  const resolvedMap = parseEnvContentToMap(resolved);
  return mergeEnvMapIntoContent(existingContent, resolvedMap, { appendMissingFromNewMap: true });
}

/**
 * Generates and writes .env file. Newly resolved values win over existing .env; extra vars in existing .env are kept.
 * When `options.envOnly` is true, only env.template is used; .env is written to `options.appPath`.
 *
 * When `options.noWrite` is true, the function resolves the .env content in memory and skips
 * both writes — neither `<appPath>/.env` nor `build.envOutputPath` is materialized — and returns
 * `null`. Use this from non-resolve flows (register/rotate-secret/build/up-*) so resolved secrets
 * never land on disk except when the user runs `aifabrix resolve <app>` explicitly.
 *
 * @async
 * @param {string} appName - Name of the application
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} [environment='local'] - Environment context ('local' or 'docker')
 * @param {boolean} [force=false] - Generate missing secret keys in secrets file
 * @param {Object} [options] - Optional: appPath, envOnly, skipOutputPath, preserveFromPath, noWrite,
 *   preferLocalEnvOutputPath (when **true**, `build.envOutputPath` is regenerated with **local** `url://` profile; **false**
 *   only when **both** `remote-server` is set and `applications.<app>.reload` is true — then docker flavor matches `builder/<app>/.env`)
 * @param {boolean} [options.noWrite=false] - When true, resolve in-memory only; do not write
 *   `<appPath>/.env` and do not call `processEnvVariables`. Returns `null` in that case.
 * @returns {Promise<string|null>} Path to generated .env file, or `null` when `noWrite` is true
 *
 * @example
 * // up-platform / up-miso / up-dataplane / register / rotate-secret / build flows:
 * await generateEnvFile('dataplane', null, 'local', false, { noWrite: true });
 *
 * @example
 * // aifabrix resolve <app> — the only legitimate writer of a persistent .env:
 * await generateEnvFile('dataplane', undefined, 'docker', force, {
 *   appPath, envOnly, skipOutputPath: false, preserveFromPath: null
 * });
 */
/**
 * Materialize a resolved .env to `<appPath>/.env` and (optionally) copy through
 * `build.envOutputPath`. Extracted so {@link generateEnvFile} can stay under the
 * 20-statement limit while still expressing the in-memory vs on-disk branch clearly.
 *
 * @async
 * @param {Object} params
 * @param {string} params.appName
 * @param {string} params.appPath
 * @param {string} params.envPath - Resolved `<appPath>/.env` target
 * @param {string} params.resolved - Fully resolved .env content
 * @param {string|null} params.variablesPath - application.yaml path (or null when envOnly)
 * @param {string} [params.secretsPath]
 * @param {Object} params.opts - Caller options (preserveFromPath, skipOutputPath, preferLocalEnvOutputPath, appPath)
 * @returns {Promise<string>} Path to the written .env file
 */
async function writeResolvedEnv({ appName, envPath, resolved, variablesPath, secretsPath, opts }) {
  const preservePath = opts.preserveFromPath !== undefined && opts.preserveFromPath !== null ? opts.preserveFromPath : null;
  const pathToPreserve = preservePath !== null ? preservePath : envPath;
  const toWrite = resolveEnvContentToWrite(resolved, pathToPreserve, { freshEnv: opts.freshEnv === true });
  fs.writeFileSync(envPath, toWrite, { mode: 0o600 });

  if (!opts.skipOutputPath) {
    const { processEnvVariables } = require('../utils/env-copy');
    await processEnvVariables(envPath, variablesPath, appName, secretsPath, {
      preferLocalEnvOutputPath: opts.preferLocalEnvOutputPath === true,
      appPath: opts.appPath || null,
      freshEnv: opts.freshEnv === true
    });
  }
  return envPath;
}

async function generateEnvFile(appName, secretsPath, environment = 'local', force = false, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const appPath = opts.appPath || pathsUtil.getBuilderPath(appName);
  const envOnly = !!opts.envOnly;
  const noWrite = opts.noWrite === true;
  const variablesPath = envOnly ? null : resolveApplicationConfigPath(appPath);
  const envPath = path.join(appPath, '.env');

  if (envOnly) {
    const templatePath = path.join(appPath, 'env.template');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`env.template not found at ${templatePath}. Resolve requires env.template in the app directory.`);
    }
  }

  // Always resolve so missing-secret / kv:// errors still surface in noWrite mode.
  const resolved = await generateEnvContent(appName, secretsPath, environment, force, { appPath, envOnly });

  if (noWrite) {
    return null;
  }

  return writeResolvedEnv({ appName, appPath, envPath, resolved, variablesPath, secretsPath, opts });
}

module.exports = {
  resolveKvReferences,
  generateEnvContent,
  generateEnvFile,
  parseEnvContentToMap,
  mergeEnvMapIntoContent
};
