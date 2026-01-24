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

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../utils/logger');
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
const { processEnvVariables } = require('../utils/env-copy');
const { buildEnvVarMap } = require('../utils/env-map');
const { resolveServicePortsInEnvContent } = require('../utils/secrets-url');
const {
  generateMissingSecrets,
  createDefaultSecrets
} = require('../utils/secrets-generator');
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
const { getContainerPortFromPath } = require('../utils/port-resolver');

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
 * User's file takes priority, then falls back to aifabrix-secrets from config.yaml
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
 */
async function loadSecrets(secretsPath, _appName) {
  // Explicit path branch
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

  // Cascading lookup branch
  let mergedSecrets = loadUserSecrets();
  mergedSecrets = await applyCanonicalSecretsOverride(mergedSecrets);
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

  // Get developer-id for local environment to adjust port variables
  let developerId = null;
  if (environment === 'local') {
    try {
      developerId = await config.getDeveloperId();
    } catch {
      // ignore, will use null (buildEnvVarMap will fetch it)
    }
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

// resolveServicePortsInEnvContent, loadEnvTemplate, and processEnvVariables
// are imported from ./utils/secrets-helpers above.

/**
 * Generates .env file from template and secrets
 * Creates environment file for local development
 *
 * @async
 * @function generateEnvFile
 * @param {string} appName - Name of the application
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} [environment='local'] - Environment context
 * @param {boolean} [force=false] - Generate missing secret keys in secrets file
 * @param {boolean} [skipOutputPath=false] - Skip processing envOutputPath (to avoid recursion)
 * @returns {Promise<string>} Path to generated .env file
 * @throws {Error} If generation fails
 *
 * @example
 * const envPath = await generateEnvFile('myapp', '../../secrets.local.yaml', 'local', true);
 * // Returns: './builder/myapp/.env'
 */
/**
 * Gets base docker environment config
 * @async
 * @function getBaseDockerEnv
 * @returns {Promise<Object>} Docker environment config
 */
async function getBaseDockerEnv() {
  const { getEnvHosts } = require('../utils/env-endpoints');
  return await getEnvHosts('docker');
}

/**
 * Applies config.yaml override to docker environment
 * @function applyDockerEnvOverride
 * @param {Object} dockerEnv - Base docker environment config
 * @returns {Object} Updated docker environment config
 */
function applyDockerEnvOverride(dockerEnv) {
  try {
    const os = require('os');
    const cfgPath = path.join(os.homedir(), '.aifabrix', 'config.yaml');
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (cfg && cfg.environments && cfg.environments.docker) {
        return { ...dockerEnv, ...cfg.environments.docker };
      }
    }
  } catch {
    // Ignore config.yaml read errors, continue with env-config values
  }
  return dockerEnv;
}

/**
 * Gets container port from docker environment config
 * @function getContainerPortFromDockerEnv
 * @param {Object} dockerEnv - Docker environment config
 * @returns {number} Container port (defaults to 3000)
 */
function getContainerPortFromDockerEnv(dockerEnv) {
  if (dockerEnv.PORT === undefined || dockerEnv.PORT === null) {
    return 3000;
  }
  const portVal = typeof dockerEnv.PORT === 'number' ? dockerEnv.PORT : parseInt(dockerEnv.PORT, 10);
  return Number.isNaN(portVal) ? 3000 : portVal;
}

/**
 * Updates PORT in resolved content for docker environment
 * Sets PORT to container port (build.containerPort or port from variables.yaml)
 * NOT the host port (which includes developer-id offset)
 * @async
 * @function updatePortForDocker
 * @param {string} resolved - Resolved environment content
 * @param {string} variablesPath - Path to variables.yaml file
 * @returns {Promise<string>} Updated content with PORT set
 */
async function updatePortForDocker(resolved, variablesPath) {
  // Step 1: Get base config from env-config.yaml
  let dockerEnv = await getBaseDockerEnv();

  // Step 2: Apply config.yaml → environments.docker override (if exists)
  dockerEnv = applyDockerEnvOverride(dockerEnv);

  // Step 3: Get PORT value for container (should be container port, NOT host port)
  let containerPort = getContainerPortFromPath(variablesPath);
  if (containerPort === null) {
    containerPort = getContainerPortFromDockerEnv(dockerEnv);
  }

  // PORT in container should be the container port (no developer-id adjustment)
  // Docker will map container port to host port via port mapping
  return resolved.replace(/^PORT\s*=\s*.*$/m, `PORT=${containerPort}`);
}

/**
 * Applies environment-specific transformations to resolved content
 * @async
 * @function applyEnvironmentTransformations
 * @param {string} resolved - Resolved environment content
 * @param {string} environment - Environment context
 * @param {string} variablesPath - Path to variables.yaml file
 * @returns {Promise<string>} Transformed content
 */
async function applyEnvironmentTransformations(resolved, environment, variablesPath) {
  if (environment === 'docker') {
    resolved = await resolveServicePortsInEnvContent(resolved, environment);
    resolved = await rewriteInfraEndpoints(resolved, 'docker');
    // Interpolate ${VAR} references created by rewriteInfraEndpoints
    // Get the actual host and port values from env-endpoints.js directly
    // to ensure they are correctly populated in envVars for interpolation
    const { getEnvHosts, getServiceHost, getServicePort, getLocalhostOverride } = require('../utils/env-endpoints');
    const hosts = await getEnvHosts('docker');
    const localhostOverride = getLocalhostOverride('docker');
    const redisHost = getServiceHost(hosts.REDIS_HOST, 'docker', 'redis', localhostOverride);
    const redisPort = await getServicePort('REDIS_PORT', 'redis', hosts, 'docker', null);
    const dbHost = getServiceHost(hosts.DB_HOST, 'docker', 'postgres', localhostOverride);
    const dbPort = await getServicePort('DB_PORT', 'postgres', hosts, 'docker', null);

    // Build envVars map and ensure it has the correct values
    const envVars = await buildEnvVarMap('docker');
    // Override with the actual values that were just set by rewriteInfraEndpoints
    envVars.REDIS_HOST = redisHost;
    envVars.REDIS_PORT = String(redisPort);
    envVars.DB_HOST = dbHost;
    envVars.DB_PORT = String(dbPort);
    resolved = interpolateEnvVars(resolved, envVars);
    resolved = await updatePortForDocker(resolved, variablesPath);
  } else if (environment === 'local') {
    // adjustLocalEnvPortsInContent handles both PORT and infra endpoints
    resolved = await adjustLocalEnvPortsInContent(resolved, variablesPath);
  }
  return resolved;
}

/**
 * Generates .env file content from template and secrets (without writing to disk)
 * @async
 * @function generateEnvContent
 * @param {string} appName - Name of the application
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} [environment='local'] - Environment context
 * @param {boolean} [force=false] - Generate missing secret keys in secrets file
 * @returns {Promise<string>} Generated .env file content
 * @throws {Error} If generation fails
 */
async function generateEnvContent(appName, secretsPath, environment = 'local', force = false) {
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const templatePath = path.join(builderPath, 'env.template');
  const variablesPath = path.join(builderPath, 'variables.yaml');

  const template = loadEnvTemplate(templatePath);
  const secretsPaths = await getActualSecretsPath(secretsPath, appName);

  if (force) {
    // Use the same path resolution logic as loadSecrets
    // If explicit path provided, use it; otherwise use the path that loadUserSecrets() would use
    let secretsFileForGeneration;
    if (secretsPath) {
      secretsFileForGeneration = resolveSecretsPath(secretsPath);
    } else {
      // Use the same path that loadUserSecrets() would use (now uses paths.getAifabrixHome())
      secretsFileForGeneration = secretsPaths.userPath;
    }
    await generateMissingSecrets(template, secretsFileForGeneration);
  }

  const secrets = await loadSecrets(secretsPath, appName);
  let resolved = await resolveKvReferences(template, secrets, environment, secretsPaths, appName);
  resolved = await applyEnvironmentTransformations(resolved, environment, variablesPath);

  return resolved;
}

async function generateEnvFile(appName, secretsPath, environment = 'local', force = false, skipOutputPath = false) {
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const envPath = path.join(builderPath, '.env');

  const resolved = await generateEnvContent(appName, secretsPath, environment, force);

  fs.writeFileSync(envPath, resolved, { mode: 0o600 });

  // Process and copy to envOutputPath if configured (uses localPort for copied file)
  if (!skipOutputPath) {
    await processEnvVariables(envPath, variablesPath, appName, secretsPath);
  }

  return envPath;
}

/**
 * Generates admin secrets for infrastructure
 * Creates ~/.aifabrix/admin-secrets.env with Postgres and Redis credentials
 *
 * @async
 * @function generateAdminSecretsEnv
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @returns {Promise<string>} Path to generated admin-secrets.env file
 * @throws {Error} If generation fails
 *
 * @example
 * const adminEnvPath = await generateAdminSecretsEnv('../../secrets.local.yaml');
 * // Returns: '~/.aifabrix/admin-secrets.env'
 */
async function generateAdminSecretsEnv(secretsPath) {
  let secrets;

  try {
    secrets = await loadSecrets(secretsPath);
  } catch (error) {
    // If secrets file doesn't exist, create default secrets
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

  const postgresPassword = secrets['postgres-passwordKeyVault'] || '';

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

// validateSecrets is imported from ./utils/secrets-helpers

module.exports = {
  loadSecrets,
  resolveKvReferences,
  generateEnvFile,
  generateEnvContent,
  generateMissingSecrets,
  generateAdminSecretsEnv,
  validateSecrets,
  createDefaultSecrets,
  getCanonicalSecretName
};
