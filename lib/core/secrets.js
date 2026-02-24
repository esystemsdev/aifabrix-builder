/**
 * AI Fabrix Builder Secrets Management
 *
 * This module handles secret resolution and environment file generation.
 * Resolves kv:// references from secrets files and generates .env files.
 *
 * @fileoverview Secret resolution and environment management for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-lines -- Central module; env-only resolve (plan 75) added required options; extract to env-merge would touch multiple callers. */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const config = require('./config');
const {
  interpolateEnvVars,
  collectMissingSecrets,
  formatMissingSecretsFileInfo,
  replaceKvInContent,
  loadEnvTemplate,
  adjustLocalEnvPortsInContent,
  rewriteInfraEndpoints,
  readYamlAtPath,
  applyCanonicalSecretsOverride,
  ensureNonEmptySecrets,
  validateSecrets
} = require('../utils/secrets-helpers');
const { buildEnvVarMap } = require('../utils/env-map');
const { resolveServicePortsInEnvContent } = require('../utils/secrets-url');
const {
  updatePortForDocker,
  getBaseDockerEnv,
  applyDockerEnvOverride,
  getContainerPortFromDockerEnv
} = require('./secrets-docker-env');
const { getContainerPortFromPath } = require('../utils/port-resolver');
const {
  generateMissingSecrets,
  createDefaultSecrets
} = require('../utils/secrets-generator');
const secretsEnsure = require('./secrets-ensure');
const {
  resolveSecretsPath,
  getActualSecretsPath
} = require('../utils/secrets-path');
const {
  loadUserSecrets,
  loadDefaultSecrets
} = require('../utils/secrets-utils');
const { decryptSecret, isEncrypted } = require('../utils/secrets-encryption');
const pathsUtil = require('../utils/paths');

/**
 * Generates a canonical secret name from an environment variable key.
 * Converts to lowercase, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 *
 * @function getCanonicalSecretName
 * @param {string} key - Environment variable key (e.g., JWT_SECRET)
 * @returns {string} Canonical secret name (e.g., jwt-secret)
 */
function getCanonicalSecretName(key) {
  if (!key || typeof key !== 'string') {
    return '';
  }
  // Insert hyphens before capital letters (camelCase -> kebab-case)
  // Then convert to lowercase and replace non-alphanumeric with hyphens
  const withHyphens = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  const lower = withHyphens.toLowerCase();
  const hyphenated = lower.replace(/[^a-z0-9]/g, '-');
  const collapsed = hyphenated.replace(/-+/g, '-');
  return collapsed.replace(/^-+|-+$/g, '');
}

/**
 * Decrypts encrypted values in secrets object
 * Checks for secure:// prefix and decrypts using encryption key from config
 *
 * @async
 * @function decryptSecretsObject
 * @param {Object} secrets - Secrets object with potentially encrypted values
 * @returns {Promise<Object>} Secrets object with decrypted values
 * @throws {Error} If decryption fails or encryption key is missing
 */
async function decryptSecretsObject(secrets) {
  if (!secrets || typeof secrets !== 'object') {
    return secrets;
  }

  const encryptionKey = await config.getSecretsEncryptionKey();
  if (!encryptionKey) {
    // No encryption key set, check if any values are encrypted
    const hasEncrypted = Object.values(secrets).some(value => isEncrypted(value));
    if (hasEncrypted) {
      throw new Error('Encrypted secrets found but no encryption key configured. Run "aifabrix secure --secrets-encryption <key>" to set encryption key.');
    }
    // No encrypted values, return as-is
    return secrets;
  }

  const decryptedSecrets = {};
  for (const [key, value] of Object.entries(secrets)) {
    if (isEncrypted(value)) {
      try {
        decryptedSecrets[key] = decryptSecret(value, encryptionKey);
      } catch (error) {
        throw new Error(`Failed to decrypt secret '${key}': ${error.message}`);
      }
    } else {
      decryptedSecrets[key] = value;
    }
  }

  return decryptedSecrets;
}

/**
 * Loads secrets with cascading lookup
 * Supports both user secrets (~/.aifabrix/secrets.local.yaml) and project overrides
 * When aifabrix-secrets (or secrets-path) is set in config.yaml and that file exists, it is used as base; user's file (local) is strongest and overrides project for same key. Otherwise user's file first, then aifabrix-secrets as fallback.
 * Automatically decrypts values with secure:// prefix
 *
 * @async
 * @function loadSecrets
 * @param {string} [secretsPath] - Path to secrets file (optional, for explicit override)
 * @param {string} [appName] - Application name (optional, for backward compatibility)
 * @returns {Promise<Object>} Loaded secrets object with decrypted values
 * @throws {Error} If no secrets file found and no fallback available
 *
 * @example
 * const secrets = await loadSecrets('../../secrets.local.yaml');
 * // Returns: { 'postgres-passwordKeyVault': 'admin123', ... }
 *
 * @example
 * // When config.yaml has aifabrix-secrets: ./secrets.local.yaml, project file is base;
 * // ~/.aifabrix/secrets.local.yaml overrides project for same key (local strongest).
 * const secrets = await loadSecrets(undefined, 'myapp');
 */

/**
 * Merges config file secrets into user secrets (user wins). Returns null if path missing or config empty.
 * @param {Object} userSecrets - User secrets object
 * @param {string} resolvedConfigPath - Absolute path to config secrets file
 * @returns {Object|null} Merged secrets or null
 */
function mergeUserWithConfigFile(userSecrets, resolvedConfigPath) {
  if (!fs.existsSync(resolvedConfigPath)) {
    return null;
  }
  let configSecrets;
  try {
    configSecrets = readYamlAtPath(resolvedConfigPath);
  } catch (loadError) {
    throw new Error(`Failed to load secrets file ${resolvedConfigPath}: ${loadError.message}`);
  }
  if (!configSecrets || typeof configSecrets !== 'object') {
    return null;
  }
  const merged = { ...userSecrets };
  for (const key of Object.keys(configSecrets)) {
    if (!(key in merged) || merged[key] === undefined || merged[key] === null || merged[key] === '') {
      merged[key] = configSecrets[key];
    }
  }
  return merged;
}

/**
 * Loads config secrets path, merges with user secrets (user overrides). Used by loadSecrets cascade.
 * When aifabrix-secrets is an http(s) URL, fetches shared secrets from API (never persisted to disk).
 *
 * @async
 * @returns {Promise<Object|null>} Merged secrets object or null
 */
async function loadMergedConfigAndUserSecrets() {
  const { loadRemoteSharedSecrets, mergeUserWithRemoteSecrets } = require('../utils/remote-secrets-loader');
  const { isRemoteSecretsUrl } = require('../utils/remote-dev-auth');
  const userSecrets = loadUserSecrets();
  const hasKeys = (obj) => obj && Object.keys(obj).length > 0;
  const userOrNull = () => (hasKeys(userSecrets) ? userSecrets : null);
  try {
    const configSecretsPath = await config.getSecretsPath();
    if (!configSecretsPath) {
      return userOrNull();
    }
    if (isRemoteSecretsUrl(configSecretsPath)) {
      const remoteSecrets = await loadRemoteSharedSecrets();
      const merged = mergeUserWithRemoteSecrets(userSecrets, remoteSecrets);
      return hasKeys(merged) ? merged : userOrNull();
    }
    const resolvedConfigPath = path.isAbsolute(configSecretsPath)
      ? configSecretsPath
      : path.resolve(process.cwd(), configSecretsPath);
    const merged = mergeUserWithConfigFile(userSecrets, resolvedConfigPath);
    return merged !== null ? merged : userOrNull();
  } catch (error) {
    if (error.message && error.message.startsWith('Failed to load secrets file')) {
      throw error;
    }
    return null;
  }
}

async function loadSecrets(secretsPath, _appName) {
  if (secretsPath) {
    const resolvedPath = resolveSecretsPath(secretsPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Secrets file not found: ${resolvedPath}`);
    }
    const explicitSecrets = readYamlAtPath(resolvedPath);
    if (!explicitSecrets || typeof explicitSecrets !== 'object') {
      throw new Error(`Invalid secrets file format: ${resolvedPath}`);
    }
    return await decryptSecretsObject(explicitSecrets);
  }

  let mergedSecrets = await loadMergedConfigAndUserSecrets();
  if (!mergedSecrets || Object.keys(mergedSecrets).length === 0) {
    mergedSecrets = loadUserSecrets();
    mergedSecrets = await applyCanonicalSecretsOverride(mergedSecrets);
  }
  if (Object.keys(mergedSecrets).length === 0) {
    mergedSecrets = loadDefaultSecrets();
  }
  ensureNonEmptySecrets(mergedSecrets);
  return await decryptSecretsObject(mergedSecrets);
}

/**
 * Resolves kv:// references in environment template
 * Replaces kv://keyName with actual values from secrets
 *
 * @async
 * @function resolveKvReferences
 * @param {string} envTemplate - Environment template content
 * @param {Object} secrets - Secrets object from loadSecrets()
 * @param {string} [environment='local'] - Environment context (docker/local)
 * @param {Object|string|null} [secretsFilePaths] - Paths object with userPath and buildPath, or string path (for backward compatibility)
 * @param {string} [secretsFilePaths.userPath] - User's secrets file path
 * @param {string|null} [secretsFilePaths.buildPath] - App's aifabrix-secrets file path (from config.yaml, if configured)
 * @param {string} [appName] - Application name (optional, for error messages)
 * @returns {Promise<string>} Resolved environment content
 * @throws {Error} If kv:// reference cannot be resolved
 *
 * @example
 * const resolved = await resolveKvReferences(template, secrets, 'local');
 * // Returns: 'DATABASE_URL=postgresql://user:pass@localhost:5432/db'
 */
async function resolveKvReferences(envTemplate, secrets, environment = 'local', secretsFilePaths = null, appName = null) {
  const os = require('os');

  // Get developer-id for port variables (local and docker: *_PUBLIC_PORT = base + devId*100)
  let developerId = null;
  try {
    developerId = await config.getDeveloperId();
  } catch {
    // ignore, buildEnvVarMap will use default
  }

  let envVars = await buildEnvVarMap(environment, os, developerId);
  if (!envVars || Object.keys(envVars).length === 0) {
    // Fallback to local environment variables if requested environment does not exist
    envVars = await buildEnvVarMap('local', os, developerId);
  }
  const resolved = interpolateEnvVars(envTemplate, envVars);
  const missing = collectMissingSecrets(resolved, secrets);
  if (missing.length > 0) {
    const fileInfo = formatMissingSecretsFileInfo(secretsFilePaths);
    const resolveCommand = appName ? `aifabrix resolve ${appName}` : 'aifabrix resolve <app-name>';
    throw new Error(`Missing secrets: ${missing.join(', ')}${fileInfo}\n\nRun "${resolveCommand}" to generate missing secrets.`);
  }
  return replaceKvInContent(resolved, secrets, envVars);
}

/** Docker env transformations: ports, infra endpoints, PORT. */
async function applyDockerTransformations(resolved, variablesPath) {
  resolved = await resolveServicePortsInEnvContent(resolved, 'docker');
  resolved = await rewriteInfraEndpoints(resolved, 'docker');
  const { getEnvHosts, getServiceHost, getServicePort, getLocalhostOverride } = require('../utils/env-endpoints');
  const hosts = await getEnvHosts('docker');
  const localhostOverride = getLocalhostOverride('docker');
  const redisHost = getServiceHost(hosts.REDIS_HOST, 'docker', 'redis', localhostOverride);
  const redisPort = await getServicePort('REDIS_PORT', 'redis', hosts, 'docker', null);
  const dbHost = getServiceHost(hosts.DB_HOST, 'docker', 'postgres', localhostOverride);
  const dbPort = await getServicePort('DB_PORT', 'postgres', hosts, 'docker', null);
  let dockerEnv = await getBaseDockerEnv();
  dockerEnv = applyDockerEnvOverride(dockerEnv);
  const containerPort = getContainerPortFromPath(variablesPath) ?? getContainerPortFromDockerEnv(dockerEnv) ?? 3000;
  const envVars = await buildEnvVarMap('docker', null, null, { appPort: containerPort });
  envVars.REDIS_HOST = redisHost;
  envVars.REDIS_PORT = String(redisPort);
  envVars.DB_HOST = dbHost;
  envVars.DB_PORT = String(dbPort);
  envVars.PORT = String(containerPort);
  resolved = interpolateEnvVars(resolved, envVars);
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
 * @param {Object} [options] - Optional: appPath, envOnly (env-only mode uses only env.template)
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
  let resolved = await resolveKvReferences(template, secrets, environment, secretsPaths, appName);
  resolved = await applyEnvironmentTransformations(resolved, environment, variablesPath);

  return resolved;
}

/**
 * Parses .env file content into a key-to-value map.
 * Only includes lines that look like KEY=value (first = separates key and value).
 *
 * @function parseEnvContentToMap
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
 * @function mergeEnvContentPreservingExisting
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
 * @function mergeEnvMapIntoContent
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
 * @function generateEnvFile
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

/** Generates admin secrets for infrastructure (~/.aifabrix/admin-secrets.env). Uses admin123 when no postgres password. */
async function generateAdminSecretsEnv(secretsPath) {
  let secrets;

  try {
    secrets = await loadSecrets(secretsPath);
  } catch (error) {
    const defaultSecretsPath = secretsPath || path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');
    if (!fs.existsSync(defaultSecretsPath)) {
      logger.log('Creating default secrets file...');
      await createDefaultSecrets(defaultSecretsPath);
      secrets = await loadSecrets(secretsPath);
    } else {
      throw error;
    }
  }
  const aifabrixDir = pathsUtil.getAifabrixHome();
  const adminEnvPath = path.join(aifabrixDir, 'admin-secrets.env');
  if (!fs.existsSync(aifabrixDir)) {
    fs.mkdirSync(aifabrixDir, { recursive: true, mode: 0o700 });
  }

  const raw = secrets['postgres-passwordKeyVault'];
  const postgresPassword = (raw && String(raw).trim()) || 'admin123';

  const adminSecrets = `# Infrastructure Admin Credentials
POSTGRES_PASSWORD=${postgresPassword}
PGADMIN_DEFAULT_EMAIL=admin@aifabrix.dev
PGADMIN_DEFAULT_PASSWORD=${postgresPassword}
REDIS_HOST=local:redis:6379:0:
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASSWORD=${postgresPassword}
`;

  fs.writeFileSync(adminEnvPath, adminSecrets, { mode: 0o600 });
  return adminEnvPath;
}
module.exports = {
  loadSecrets,
  resolveKvReferences,
  generateEnvFile,
  generateEnvContent,
  generateMissingSecrets,
  generateAdminSecretsEnv,
  validateSecrets,
  createDefaultSecrets,
  getCanonicalSecretName,
  parseEnvContentToMap,
  mergeEnvMapIntoContent
};
