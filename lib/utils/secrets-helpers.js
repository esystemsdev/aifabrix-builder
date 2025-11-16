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
const config = require('../config');
const { buildHostnameToServiceMap, resolveUrlPort } = require('./secrets-utils');
const devConfig = require('../utils/dev-config');
const { rewriteInfraEndpoints, getEnvHosts } = require('./env-endpoints');
const { loadEnvConfig } = require('./env-config-loader');
const { processEnvVariables } = require('./env-copy');
const { updateContainerPortInEnvFile } = require('./env-ports');

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
 * Adjust infra-related ports in resolved .env content for local environment
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

  // Step 1: Get base config from env-config.yaml (includes user env-config file if configured)
  let localEnv = await getEnvHosts('local');

  // Step 2: Apply config.yaml → environments.local override (if exists)
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

  // Step 3: Get PORT value following override chain
  // Start with env-config value, override with variables.yaml build.localPort, then port
  let baseAppPort = null;
  if (localEnv.PORT !== undefined && localEnv.PORT !== null) {
    const portVal = typeof localEnv.PORT === 'number' ? localEnv.PORT : parseInt(localEnv.PORT, 10);
    if (!Number.isNaN(portVal)) {
      baseAppPort = portVal;
    }
  }

  // Override with variables.yaml → build.localPort (if exists)
  if (variablesPath && fs.existsSync(variablesPath)) {
    try {
      const variablesContent = fs.readFileSync(variablesPath, 'utf8');
      const variables = yaml.load(variablesContent);
      const localPort = variables?.build?.localPort;
      if (typeof localPort === 'number' && localPort > 0) {
        baseAppPort = localPort;
      } else if (baseAppPort === null || baseAppPort === undefined) {
        // Fallback to variables.yaml → port if baseAppPort still not set
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

  // Step 4: Apply developer-id adjustment: finalPort = basePort + (developerId * 100)
  const appPort = devIdNum === 0 ? baseAppPort : (baseAppPort + (devIdNum * 100));

  // Step 5: Get infra service ports from config and apply developer-id adjustment
  // All infra ports (REDIS_PORT, DB_PORT, etc.) come from localEnv and get developer-id adjustment
  const getInfraPort = (portKey, defaultValue) => {
    let port = defaultValue;
    if (localEnv[portKey] !== undefined && localEnv[portKey] !== null) {
      const portVal = typeof localEnv[portKey] === 'number' ? localEnv[portKey] : parseInt(localEnv[portKey], 10);
      if (!Number.isNaN(portVal)) {
        port = portVal;
      }
    }
    // Apply developer-id adjustment (infra ports are similar to docker)
    return devIdNum === 0 ? port : (port + (devIdNum * 100));
  };

  // Get default ports from devConfig as last resort fallback
  const basePorts = devConfig.getBasePorts();
  const redisPort = getInfraPort('REDIS_PORT', basePorts.redis);
  const dbPort = getInfraPort('DB_PORT', basePorts.postgres);

  // Update .env content
  let updated = envContent;

  // Update PORT
  if (/^PORT\s*=.*$/m.test(updated)) {
    updated = updated.replace(/^PORT\s*=\s*.*$/m, `PORT=${appPort}`);
  } else {
    updated = `${updated}\nPORT=${appPort}\n`;
  }

  // Update DATABASE_PORT
  if (/^DATABASE_PORT\s*=.*$/m.test(updated)) {
    updated = updated.replace(/^DATABASE_PORT\s*=\s*.*$/m, `DATABASE_PORT=${dbPort}`);
  }

  // Update localhost URLs that point to the base app port to the dev-specific app port
  const localhostUrlPattern = /(https?:\/\/localhost:)(\d+)(\b[^ \n]*)?/g;
  updated = updated.replace(localhostUrlPattern, (match, prefix, portNum, rest = '') => {
    const num = parseInt(portNum, 10);
    if (num === baseAppPort) {
      return `${prefix}${appPort}${rest || ''}`;
    }
    return match;
  });

  // Rewrite infra endpoints using env-config mapping for local context
  // This handles REDIS_HOST, REDIS_PORT, REDIS_URL, DB_HOST, etc.
  updated = await rewriteInfraEndpoints(updated, 'local', { redis: redisPort, postgres: dbPort });

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
    if (canonicalPath) {
      const resolvedCanonical = path.isAbsolute(canonicalPath)
        ? canonicalPath
        : path.resolve(process.cwd(), canonicalPath);
      if (fs.existsSync(resolvedCanonical)) {
        const configSecrets = readYamlAtPath(resolvedCanonical);
        // Apply canonical secrets as a fallback source:
        // - Do NOT override any existing keys from user/build
        // - Add only missing keys from canonical path
        if (configSecrets && typeof configSecrets === 'object') {
          const result = { ...configSecrets, ...mergedSecrets };
          mergedSecrets = result;
        }
      }
    }
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
    throw new Error('No secrets file found. Please create ~/.aifabrix/secrets.local.yaml or configure build.secrets in variables.yaml');
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
  processEnvVariables,
  updateContainerPortInEnvFile,
  adjustLocalEnvPortsInContent,
  readYamlAtPath,
  applyCanonicalSecretsOverride,
  ensureNonEmptySecrets,
  validateSecrets,
  rewriteInfraEndpoints,
  getEnvHosts
};

