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
const { getLocalPortFromPath } = require('./port-resolver');
const { readYamlAtPath, applyCanonicalSecretsOverride } = require('./secrets-canonical');

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
 * Returns true if the line is a comment or empty (should be skipped for kv:// resolution)
 * @param {string} line - Single line
 * @returns {boolean}
 */
function isCommentOrEmptyLine(line) {
  const t = line.trim();
  return t === '' || t.startsWith('#');
}

/** Regex for kv:// path (allows slashes, e.g. kv://hubspot/clientId) */
const KV_REF_PATTERN = /kv:\/\/([a-zA-Z0-9_\-/]+)/g;

/**
 * Find object key that matches part case-insensitively.
 * @param {Object} obj - Object to search
 * @param {string} part - Key to match (e.g. 'clientid')
 * @returns {string|undefined} Actual key in obj or undefined
 */
function findKeyCaseInsensitive(obj, part) {
  if (!obj || typeof obj !== 'object' || part === null || part === undefined) return undefined;
  const lower = String(part).toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) return key;
  }
  return undefined;
}

/**
 * Resolve value by walking path parts (nested keys).
 * @param {Object} secrets - Root secrets object
 * @param {string[]} parts - Path parts (e.g. ['hubspot', 'clientId'])
 * @returns {*} Value or undefined
 */
function getValueByNestedPath(secrets, parts) {
  let value = secrets;
  for (const part of parts) {
    if (!value || typeof value !== 'object') return undefined;
    const key = part in value ? part : findKeyCaseInsensitive(value, part);
    value = key !== undefined ? value[key] : undefined;
    if (value === undefined) return undefined;
  }
  return value;
}

/**
 * Get secret value by path. Supports flat key (hubspot/clientId), nested object (hubspot.clientId),
 * and case-insensitive matching (clientid matches clientId). Path-style and hyphen-style are distinct:
 * hubspot/clientid and hubspot-clientid are different keys.
 * @param {Object} secrets - Secrets object (may be nested)
 * @param {string} pathStr - Path after kv:// (e.g. 'hubspot/clientId' or 'hubspot/clientid')
 * @returns {*} Value or undefined if not found
 */
function getValueByPath(secrets, pathStr) {
  if (!secrets || typeof secrets !== 'object' || !pathStr) {
    return undefined;
  }
  const direct = secrets[pathStr];
  if (direct !== undefined) return direct;
  const flatKey = findKeyCaseInsensitive(secrets, pathStr);
  if (flatKey !== undefined) return secrets[flatKey];
  if (!pathStr.includes('/')) return undefined;
  return getValueByNestedPath(secrets, pathStr.split('/'));
}

/**
 * Collect missing kv:// secrets referenced in content (skips commented and empty lines).
 * Supports path-style refs (e.g. kv://hubspot/clientId). Returns unique refs.
 * @function collectMissingSecrets
 * @param {string} content - Text content
 * @param {Object} secrets - Available secrets (flat or nested)
 * @returns {string[]} Array of missing kv://<path> references (unique)
 */
function collectMissingSecrets(content, secrets) {
  const seen = new Set();
  const missing = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (isCommentOrEmptyLine(line)) continue;
    let match;
    KV_REF_PATTERN.lastIndex = 0;
    while ((match = KV_REF_PATTERN.exec(line)) !== null) {
      const pathStr = match[1];
      if (seen.has(pathStr)) continue;
      seen.add(pathStr);
      const value = getValueByPath(secrets, pathStr);
      if (value === undefined || value === null) {
        missing.push(`kv://${pathStr}`);
      }
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
 * Replace kv:// references with actual values (skips commented and empty lines).
 * Supports path-style refs (e.g. kv://hubspot/clientId) and nested secrets.
 * @function replaceKvInContent
 * @param {string} content - Text content containing kv:// references
 * @param {Object} secrets - Secrets map (flat or nested)
 * @param {Object} envVars - Environment variables map for nested interpolation
 * @returns {string} Content with kv:// references replaced
 */
function replaceKvInContent(content, secrets, envVars) {
  const lines = content.split('\n');
  const result = lines.map(line => {
    if (isCommentOrEmptyLine(line)) return line;
    return line.replace(KV_REF_PATTERN, (match, pathStr) => {
      let value = getValueByPath(secrets, pathStr);
      if (typeof value === 'string') {
        value = value.replace(/\$\{([A-Z_]+)\}/g, (m, envVar) => {
          return envVars[envVar] || m;
        });
      }
      return value !== null && value !== undefined ? String(value) : match;
    });
  });
  return result.join('\n');
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
 * Gets port from local environment config
 * @function getPortFromLocalEnv
 * @param {Object} localEnv - Local environment config
 * @returns {number|null} Port value or null
 */
function getPortFromLocalEnv(localEnv) {
  if (localEnv.PORT === undefined || localEnv.PORT === null) {
    return null;
  }
  const portVal = typeof localEnv.PORT === 'number' ? localEnv.PORT : parseInt(localEnv.PORT, 10);
  return Number.isNaN(portVal) ? null : portVal;
}

/**
 * Gets port from application config file (port only). Uses port-resolver.
 * @function getPortFromVariablesFile
 * @param {string} variablesPath - Path to application config
 * @returns {number|null} Port value or null
 */
function getPortFromVariablesFile(variablesPath) {
  return getLocalPortFromPath(variablesPath);
}

/**
 * Gets port from environment content fallback
 * @function getPortFromEnvContent
 * @param {string} envContent - Environment content
 * @returns {number} Port value (defaults to 3000)
 */
function getPortFromEnvContent(envContent) {
  const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
  return portMatch ? parseInt(portMatch[1], 10) : 3000;
}

/**
 * Applies developer-id adjustment to port
 * @function applyDeveloperIdAdjustment
 * @param {number} baseAppPort - Base application port
 * @param {number} devIdNum - Developer ID number
 * @returns {number} Adjusted port
 */
function applyDeveloperIdAdjustment(baseAppPort, devIdNum) {
  return devIdNum === 0 ? baseAppPort : (baseAppPort + (devIdNum * 100));
}

/**
 * Calculate application port following override chain and developer-id adjustment
 * Override chain: env-config.yaml → config.yaml → application.yaml port
 * @async
 * @function calculateAppPort
 * @param {string} [variablesPath] - Path to application config
 * @param {Object} localEnv - Local environment config from env-config.yaml and config.yaml
 * @param {string} envContent - Environment content for fallback
 * @param {number} devIdNum - Developer ID number
 * @returns {Promise<number>} Final application port with developer-id adjustment
 */
async function calculateAppPort(variablesPath, localEnv, envContent, devIdNum) {
  // Start with env-config value
  let baseAppPort = getPortFromLocalEnv(localEnv);

  // Override with application config port (strongest)
  const variablesPort = getPortFromVariablesFile(variablesPath);
  if (variablesPort !== null) {
    baseAppPort = variablesPort;
  }

  // Fallback to env content if still no port
  if (baseAppPort === null || baseAppPort === undefined) {
    baseAppPort = getPortFromEnvContent(envContent);
  }

  // Apply developer-id adjustment
  return applyDeveloperIdAdjustment(baseAppPort, devIdNum);
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
 * Get the env var name used for PORT in env.template (e.g. PORT=${MISO_PORT} -> MISO_PORT).
 * Used when generating .env for envOutputPath (local, not reload) so we set that var to localPort.
 * @param {string} [variablesPath] - Path to application config (env.template lives in same dir)
 * @returns {string|null} Variable name or null
 */
function getPortVarFromEnvTemplatePath(variablesPath) {
  if (!variablesPath || !fs.existsSync(variablesPath)) return null;
  const templatePath = path.join(path.dirname(variablesPath), 'env.template');
  if (!fs.existsSync(templatePath)) return null;
  try {
    const content = fs.readFileSync(templatePath, 'utf8');
    const m = content.match(/^PORT\s*=\s*\$\{([A-Za-z0-9_]+)\}/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Adjust infra-related ports in resolved .env content for local environment.
 * Own case: when we generate .env for envOutputPath (not reload), we use localPort (application.yaml build.localPort or port).
 * Sets PORT and the template port var (e.g. MISO_PORT) to localPort so the generated .env is correct for local use.
 * @async
 * @function adjustLocalEnvPortsInContent
 * @param {string} envContent - Resolved .env content
 * @param {string} [variablesPath] - Path to application config (to read port and template port var)
 * @returns {Promise<string>} Updated content with local ports
 */
/**
 * Gets developer ID number
 * @async
 * @function getDeveloperIdNumber
 * @returns {Promise<number>} Developer ID number
 */
async function getDeveloperIdNumber() {
  const devId = await config.getDeveloperId();
  if (devId !== null && devId !== undefined) {
    const parsed = parseInt(devId, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

/**
 * Gets local environment configuration with overrides
 * @async
 * @function getLocalEnvWithOverrides
 * @returns {Promise<Object>} Local environment configuration
 */
async function getLocalEnvWithOverrides() {
  let localEnv = await getEnvHosts('local');

  try {
    const cfgPath = config.CONFIG_FILE;
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (cfg && cfg.environments && cfg.environments.local) {
        localEnv = { ...localEnv, ...cfg.environments.local };
      }
    }
  } catch {
    // Ignore config.yaml read errors
  }

  return localEnv;
}

/**
 * Updates PORT variable in content
 * @function updatePortVariable
 * @param {string} envContent - Environment content
 * @param {number} appPort - Application port
 * @returns {string} Updated content
 */
function updatePortVariable(envContent, appPort) {
  if (/^PORT\s*=.*$/m.test(envContent)) {
    return envContent.replace(/^PORT\s*=\s*.*$/m, `PORT=${appPort}`);
  }
  return `${envContent}\nPORT=${appPort}\n`;
}

/**
 * Builds environment variables for interpolation
 * @async
 * @function buildEnvVarsForInterpolation
 * @param {number} devIdNum - Developer ID number
 * @returns {Promise<Object>} Environment variables object
 */
async function buildEnvVarsForInterpolation(devIdNum) {
  const hostsForPorts = await getEnvHosts('local');
  const redisPort = await getServicePort('REDIS_PORT', 'redis', hostsForPorts, 'local');
  const dbPort = await getServicePort('DB_PORT', 'postgres', hostsForPorts, 'local');
  const localhostOverride = getLocalhostOverride('local');
  const redisHost = getServiceHost(hostsForPorts.REDIS_HOST, 'local', 'localhost', localhostOverride);
  const dbHost = getServiceHost(hostsForPorts.DB_HOST, 'local', 'localhost', localhostOverride);

  const envVars = await buildEnvVarMap('local', null, devIdNum);
  envVars.REDIS_HOST = redisHost;
  envVars.REDIS_PORT = String(redisPort);
  envVars.DB_HOST = dbHost;
  envVars.DB_PORT = String(dbPort);

  return envVars;
}

async function adjustLocalEnvPortsInContent(envContent, variablesPath) {
  const devIdNum = await getDeveloperIdNumber();
  const localEnv = await getLocalEnvWithOverrides();

  const baseAppPort = await calculateAppPort(variablesPath, localEnv, envContent, 0);
  const appPort = await calculateAppPort(variablesPath, localEnv, envContent, devIdNum);

  let updated = updatePortVariable(envContent, appPort);
  updated = updateLocalhostUrls(updated, baseAppPort, appPort);
  updated = await rewriteInfraEndpoints(updated, 'local');

  const envVars = await buildEnvVarsForInterpolation(devIdNum);
  envVars.PORT = String(appPort);
  const portVar = getPortVarFromEnvTemplatePath(variablesPath);
  if (portVar) {
    envVars[portVar] = String(appPort);
  }
  updated = interpolateEnvVars(updated, envVars);

  return updated;
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
 * Validate secrets against the env template (skips commented and empty lines)
 * @function validateSecrets
 * @param {string} envTemplate - Environment template content
 * @param {Object} secrets - Available secrets
 * @returns {Object} Validation result
 */
function validateSecrets(envTemplate, secrets) {
  const missing = collectMissingSecrets(envTemplate, secrets);
  return { valid: missing.length === 0, missing };
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

