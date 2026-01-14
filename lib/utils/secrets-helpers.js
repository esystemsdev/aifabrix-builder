/**
 * Secrets helper utilities
 *
 * @fileoverview Helper functions for secrets and env processing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../core/config');
const { buildHostnameToServiceMap, resolveUrlPort } = require('./secrets-utils');
const { rewriteInfraEndpoints, getEnvHosts, getServicePort, getServiceHost, getLocalhostOverride } = require('./env-endpoints');
const { loadEnvConfig } = require('./env-config-loader');
const { updateContainerPortInEnvFile } = require('./env-ports');
const { buildEnvVarMap } = require('./env-map');

/**
 * Interpolate ${VAR} occurrences with values from envVars map
 * @function interpolateEnvVars
 * @param {string} content - Text content
 * @param {Object} envVars - Map of variable name to value
 * @returns {string} Interpolated content
 */
function interpolateEnvVars(content, envVars) {
  return content.replace(/\$\{([A-Z_]+)\}/g, (match, envVar) => {
    return envVars[envVar] || match;
  });
}

/**
 * Collect missing kv:// secrets referenced in content
 * @function collectMissingSecrets
 * @param {string} content - Text content
 * @param {Object} secrets - Available secrets
 * @returns {string[]} Array of missing kv://<key> references
 */
function collectMissingSecrets(content, secrets) {
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  const missing = [];
  let match;
  while ((match = kvPattern.exec(content)) !== null) {
    const secretKey = match[1];
    if (!(secretKey in secrets)) {
      missing.push(`kv://${secretKey}`);
    }
  }
  return missing;
}

/**
 * Format secrets file info for error message
 * @function formatMissingSecretsFileInfo
 * @param {Object|string|null} secretsFilePaths - Paths or single string path
 * @returns {string} Formatted file info suffix for error message
 */
function formatMissingSecretsFileInfo(secretsFilePaths) {
  if (!secretsFilePaths) {
    return '';
  }
  if (typeof secretsFilePaths === 'string') {
    return `\n\nSecrets file location: ${secretsFilePaths}`;
  }
  if (typeof secretsFilePaths === 'object' && secretsFilePaths.userPath) {
    const paths = [secretsFilePaths.userPath];
    if (secretsFilePaths.buildPath) {
      paths.push(secretsFilePaths.buildPath);
    }
    return `\n\nSecrets file location: ${paths.join(' and ')}`;
  }
  return '';
}

/**
 * Replace kv:// references with actual values, after also interpolating any ${VAR} within secret values
 * @function replaceKvInContent
 * @param {string} content - Text content containing kv:// references
 * @param {Object} secrets - Secrets map
 * @param {Object} envVars - Environment variables map for nested interpolation
 * @returns {string} Content with kv:// references replaced
 */
function replaceKvInContent(content, secrets, envVars) {
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  return content.replace(kvPattern, (match, secretKey) => {
    let value = secrets[secretKey];
    if (typeof value === 'string') {
      value = value.replace(/\$\{([A-Z_]+)\}/g, (m, envVar) => {
        return envVars[envVar] || m;
      });
    }
    return value;
  });
}

/**
 * Resolve service ports inside URLs for docker environment (.env content)
 * @async
 * @function resolveServicePortsInEnvContent
 * @param {string} envContent - .env content
 * @param {string} environment - Environment name
 * @returns {Promise<string>} Updated content
 */
async function resolveServicePortsInEnvContent(envContent, environment) {
  if (environment !== 'docker') {
    return envContent;
  }
  const envConfig = await loadEnvConfig();
  const dockerHosts = envConfig.environments.docker || {};
  const hostnameToService = buildHostnameToServiceMap(dockerHosts);
  const urlPattern = /(https?:\/\/)([a-zA-Z0-9-]+):(\d+)([^\s\n]*)?/g;
  return envContent.replace(urlPattern, (match, protocol, hostname, port, urlPath = '') => {
    return resolveUrlPort(protocol, hostname, port, urlPath || '', hostnameToService);
  });
}

/**
 * Load env.template content from disk
 * @function loadEnvTemplate
 * @param {string} templatePath - Path to env.template
 * @returns {string} Template content
 * @throws {Error} If template not found
 */
function loadEnvTemplate(templatePath) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`env.template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Calculate application port following override chain and developer-id adjustment
 * Override chain: env-config.yaml → config.yaml → variables.yaml build.localPort → variables.yaml port
 * @async
 * @function calculateAppPort
 * @param {string} [variablesPath] - Path to variables.yaml
 * @param {Object} localEnv - Local environment config from env-config.yaml and config.yaml
 * @param {string} envContent - Environment content for fallback
 * @param {number} devIdNum - Developer ID number
 * @returns {Promise<number>} Final application port with developer-id adjustment
 */
async function calculateAppPort(variablesPath, localEnv, envContent, devIdNum) {
  // Start with env-config value
  let baseAppPort = null;
  if (localEnv.PORT !== undefined && localEnv.PORT !== null) {
    const portVal = typeof localEnv.PORT === 'number' ? localEnv.PORT : parseInt(localEnv.PORT, 10);
    if (!Number.isNaN(portVal)) {
      baseAppPort = portVal;
    }
  }

  // Override with variables.yaml → build.localPort (strongest)
  if (variablesPath && fs.existsSync(variablesPath)) {
    try {
      const variablesContent = fs.readFileSync(variablesPath, 'utf8');
      const variables = yaml.load(variablesContent);
      const localPort = variables?.build?.localPort;
      if (typeof localPort === 'number' && localPort > 0) {
        baseAppPort = localPort;
      } else if (baseAppPort === null || baseAppPort === undefined) {
        // Fallback to variables.yaml → port
        baseAppPort = variables?.port || 3000;
      }
    } catch {
      // Fallback to reading from env content if variables.yaml read fails
      if (baseAppPort === null || baseAppPort === undefined) {
        const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
        baseAppPort = portMatch ? parseInt(portMatch[1], 10) : 3000;
      }
    }
  } else {
    // Fallback if variablesPath not provided
    if (baseAppPort === null || baseAppPort === undefined) {
      const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
      baseAppPort = portMatch ? parseInt(portMatch[1], 10) : 3000;
    }
  }

  // Apply developer-id adjustment
  return devIdNum === 0 ? baseAppPort : (baseAppPort + (devIdNum * 100));
}

/**
 * Update localhost URLs that point to base app port to use developer-specific app port
 * @function updateLocalhostUrls
 * @param {string} content - Environment content
 * @param {number} baseAppPort - Base application port
 * @param {number} appPort - Developer-specific application port
 * @returns {string} Updated content with adjusted localhost URLs
 */
function updateLocalhostUrls(content, baseAppPort, appPort) {
  const localhostUrlPattern = /(https?:\/\/localhost:)(\d+)(\b[^ \n]*)?/g;
  return content.replace(localhostUrlPattern, (match, prefix, portNum, rest = '') => {
    const num = parseInt(portNum, 10);
    if (num === baseAppPort) {
      return `${prefix}${appPort}${rest || ''}`;
    }
    return match;
  });
}

/**
 * Adjust infra-related ports in resolved .env content for local environment
 * Only handles PORT variable (other ports handled by interpolation)
 * Follows flow: getEnvHosts() → config.yaml override → variables.yaml override → developer-id adjustment
 * @async
 * @function adjustLocalEnvPortsInContent
 * @param {string} envContent - Resolved .env content
 * @param {string} [variablesPath] - Path to variables.yaml (to read build.localPort)
 * @returns {Promise<string>} Updated content with local ports
 */
async function adjustLocalEnvPortsInContent(envContent, variablesPath) {
  // Get developer-id for port adjustment
  const devId = await config.getDeveloperId();
  let devIdNum = 0;
  if (devId !== null && devId !== undefined) {
    const parsed = parseInt(devId, 10);
    if (!Number.isNaN(parsed)) {
      devIdNum = parsed;
    }
  }

  // Get base config from env-config.yaml (includes user env-config file if configured)
  let localEnv = await getEnvHosts('local');

  // Apply config.yaml → environments.local override (if exists)
  try {
    const os = require('os');
    const cfgPath = path.join(os.homedir(), '.aifabrix', 'config.yaml');
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (cfg && cfg.environments && cfg.environments.local) {
        localEnv = { ...localEnv, ...cfg.environments.local };
      }
    }
  } catch {
    // Ignore config.yaml read errors, continue with env-config values
  }

  // Calculate base port (without developer-id adjustment) for URL matching
  const baseAppPort = await calculateAppPort(variablesPath, localEnv, envContent, 0);
  // Calculate final port with developer-id adjustment
  const appPort = await calculateAppPort(variablesPath, localEnv, envContent, devIdNum);

  // Update .env content - only handle PORT variable
  // Other port variables (DB_PORT, REDIS_PORT, etc.) are handled by interpolation
  let updated = envContent;

  // Update PORT
  if (/^PORT\s*=.*$/m.test(updated)) {
    updated = updated.replace(/^PORT\s*=\s*.*$/m, `PORT=${appPort}`);
  } else {
    updated = `${updated}\nPORT=${appPort}\n`;
  }

  // Update localhost URLs
  updated = updateLocalhostUrls(updated, baseAppPort, appPort);

  // Update infra endpoints with developer-id adjusted ports for local context
  updated = await rewriteInfraEndpoints(updated, 'local');

  // Interpolate ${VAR} references created by rewriteInfraEndpoints
  // Get the ports that were just set by rewriteInfraEndpoints for interpolation
  const hostsForPorts = await getEnvHosts('local');
  const redisPort = await getServicePort('REDIS_PORT', 'redis', hostsForPorts, 'local');
  const dbPort = await getServicePort('DB_PORT', 'postgres', hostsForPorts, 'local');
  const localhostOverride = getLocalhostOverride('local');
  const redisHost = getServiceHost(hostsForPorts.REDIS_HOST, 'local', 'localhost', localhostOverride);
  const dbHost = getServiceHost(hostsForPorts.DB_HOST, 'local', 'localhost', localhostOverride);

  // Build envVars map and ensure it has the correct values
  const envVars = await buildEnvVarMap('local', null, devIdNum);
  // Override with the actual values that were just set by rewriteInfraEndpoints
  envVars.REDIS_HOST = redisHost;
  envVars.REDIS_PORT = String(redisPort);
  envVars.DB_HOST = dbHost;
  envVars.DB_PORT = String(dbPort);
  updated = interpolateEnvVars(updated, envVars);

  return updated;
}

/**
 * Read a YAML file and return parsed object
 * @function readYamlAtPath
 * @param {string} filePath - Absolute file path
 * @returns {Object} Parsed YAML object
 */
function readYamlAtPath(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

/**
 * Merge a single secret value from canonical into result
 * @function mergeSecretValue
 * @param {Object} result - Result object to merge into
 * @param {string} key - Secret key
 * @param {*} canonicalValue - Value from canonical secrets
 */
function mergeSecretValue(result, key, canonicalValue) {
  const currentValue = result[key];
  // Fill missing, empty, or undefined values
  if (!(key in result) || currentValue === undefined || currentValue === null || currentValue === '') {
    result[key] = canonicalValue;
    return;
  }
  // Only replace values that are encrypted (have secure:// prefix)
  // Plaintext values (no secure://) are used as-is
  if (typeof currentValue === 'string' && typeof canonicalValue === 'string') {
    if (currentValue.startsWith('secure://')) {
      result[key] = canonicalValue;
    }
  }
}

/**
 * Apply canonical secrets path override if configured and file exists
 * @async
 * @function applyCanonicalSecretsOverride
 * @param {Object} currentSecrets - Current secrets map
 * @returns {Promise<Object>} Possibly overridden secrets
 */
async function applyCanonicalSecretsOverride(currentSecrets) {
  let mergedSecrets = currentSecrets || {};
  try {
    const canonicalPath = await config.getSecretsPath();
    if (!canonicalPath) {
      return mergedSecrets;
    }
    const resolvedCanonical = path.isAbsolute(canonicalPath)
      ? canonicalPath
      : path.resolve(process.cwd(), canonicalPath);
    if (!fs.existsSync(resolvedCanonical)) {
      return mergedSecrets;
    }
    const configSecrets = readYamlAtPath(resolvedCanonical);
    if (!configSecrets || typeof configSecrets !== 'object') {
      return mergedSecrets;
    }
    // Apply canonical secrets as a fallback source:
    // - Do NOT override any existing keys from user/build
    // - Add only missing keys from canonical path
    // - Also fill in empty/undefined values from canonical path
    // - Replace encrypted values (secure://) with canonical plaintext
    const result = { ...mergedSecrets };
    for (const [key, canonicalValue] of Object.entries(configSecrets)) {
      mergeSecretValue(result, key, canonicalValue);
    }
    mergedSecrets = result;
  } catch {
    // ignore and fall through
  }
  return mergedSecrets;
}

/**
 * Ensure secrets map is non-empty or throw a friendly guidance error
 * @function ensureNonEmptySecrets
 * @param {Object} secrets - Secrets map
 * @throws {Error} If secrets is empty
 */
function ensureNonEmptySecrets(secrets) {
  if (Object.keys(secrets || {}).length === 0) {
    throw new Error('No secrets file found. Please create ~/.aifabrix/secrets.local.yaml or configure aifabrix-secrets in config.yaml');
  }
}

/**
 * Validate secrets against the env template, returning missing refs
 * @function validateSecrets
 * @param {string} envTemplate - Environment template content
 * @param {Object} secrets - Available secrets
 * @returns {Object} Validation result
 */
function validateSecrets(envTemplate, secrets) {
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  const missing = [];
  let match;
  while ((match = kvPattern.exec(envTemplate)) !== null) {
    const secretKey = match[1];
    if (!(secretKey in secrets)) {
      missing.push(`kv://${secretKey}`);
    }
  }
  return {
    valid: missing.length === 0,
    missing
  };
}

module.exports = {
  loadEnvConfig,
  interpolateEnvVars,
  collectMissingSecrets,
  formatMissingSecretsFileInfo,
  replaceKvInContent,
  resolveServicePortsInEnvContent,
  loadEnvTemplate,
  updateContainerPortInEnvFile,
  adjustLocalEnvPortsInContent,
  readYamlAtPath,
  applyCanonicalSecretsOverride,
  ensureNonEmptySecrets,
  validateSecrets,
  rewriteInfraEndpoints,
  getEnvHosts
};

