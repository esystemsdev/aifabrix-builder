/**
 * AI Fabrix Builder Secrets Utilities
 *
 * This module provides utility functions for loading and processing secrets.
 * Helper functions for secrets.js module.
 *
 * @fileoverview Secrets utility functions for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('./logger');
const pathsUtil = require('./paths');
const { ensureSecureFilePermissions } = require('./secure-file-permissions');
const { getContainerPort } = require('./port-resolver');
const { loadYamlTolerantOfDuplicateKeys } = require('./secrets-generator');

/**
 * Parses secrets YAML content with fallback for duplicate keys and broken concat files
 * (e.g. empty map `{}` then appended key lines — invalid without `---`).
 * @param {string} content - Raw file content
 * @returns {Object} Parsed secrets object
 */
function parseSecretsContent(content) {
  return loadYamlTolerantOfDuplicateKeys(content);
}

/**
 * Loads secrets from file with cascading lookup support
 * First checks the primary user secrets file (see getPrimaryUserSecretsLocalPath in paths.js), then aifabrix-secrets from config.yaml
 *
 * @async
 * @function loadSecretsFromFile
 * @param {string} filePath - Path to secrets file
 * @returns {Promise<Object>} Loaded secrets object or empty object if file doesn't exist
 */
async function loadSecretsFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const secrets = parseSecretsContent(content);

    if (!secrets || typeof secrets !== 'object') {
      return {};
    }

    return secrets;
  } catch (error) {
    logger.warn(`Warning: Could not read secrets file ${filePath}: ${error.message}`);
    return {};
  }
}

/**
 * Loads user secrets from getPrimaryUserSecretsLocalPath() (same dir as config.yaml resolution).
 * Used as the master source when merging with project/public secrets: user values win,
 * missing keys are filled from the public (aifabrix-secrets) file.
 *
 * @function loadPrimaryUserSecrets
 * @returns {Object} Loaded secrets object or empty object
 */
function loadPrimaryUserSecrets() {
  const userSecretsPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  if (!fs.existsSync(userSecretsPath)) {
    return {};
  }
  ensureSecureFilePermissions(userSecretsPath);

  try {
    const content = fs.readFileSync(userSecretsPath, 'utf8');
    const secrets = parseSecretsContent(content);
    if (!secrets || typeof secrets !== 'object') {
      throw new Error(`Invalid secrets file format: ${userSecretsPath}`);
    }
    return secrets;
  } catch (error) {
    if (error.message.includes('Invalid secrets file format')) {
      throw error;
    }
    logger.warn(`Warning: Could not read secrets file ${userSecretsPath}: ${error.message}`);
    return {};
  }
}

/**
 * Same as {@link loadPrimaryUserSecrets} (legacy name; kept for callers).
 * @function loadUserSecrets
 * @returns {Object} Loaded secrets object or empty object
 */
function loadUserSecrets() {
  return loadPrimaryUserSecrets();
}

/**
 * Loads default secrets from ~/.aifabrix/secrets.yaml
 * Uses paths.getAifabrixHome() to respect config.yaml aifabrix-home override
 * @function loadDefaultSecrets
 * @returns {Object} Loaded secrets object or empty object
 */
function loadDefaultSecrets() {
  const defaultPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');
  if (!fs.existsSync(defaultPath)) {
    return {};
  }
  ensureSecureFilePermissions(defaultPath);

  try {
    const content = fs.readFileSync(defaultPath, 'utf8');
    const secrets = yaml.load(content);
    if (!secrets || typeof secrets !== 'object') {
      throw new Error(`Invalid secrets file format: ${defaultPath}`);
    }
    return secrets;
  } catch (error) {
    if (error.message.includes('Invalid secrets file format')) {
      throw error;
    }
    logger.warn(`Warning: Could not read secrets file ${defaultPath}: ${error.message}`);
    return {};
  }
}

/**
 * Creates the primary user secrets file if missing (empty map) for first-run installs.
 * Uses the same directory as {@link loadPrimaryUserSecrets} (config dir / ~/.aifabrix).
 *
 * @function ensurePrimaryUserSecretsFileExists
 */
function ensurePrimaryUserSecretsFileExists() {
  const userSecretsPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  const primaryDir = path.dirname(userSecretsPath);
  if (fs.existsSync(userSecretsPath)) {
    return;
  }
  if (!fs.existsSync(primaryDir)) {
    fs.mkdirSync(primaryDir, { recursive: true, mode: 0o700 });
  }
  const header =
    '# Local secrets for AI Fabrix CLI (kv:// references in env.template resolve here)\n' +
    '# Keys are appended by `aifabrix resolve` / ensure — do not prefix with JSON `{}`.\n';
  fs.writeFileSync(userSecretsPath, header, { mode: 0o600 });
  ensureSecureFilePermissions(userSecretsPath);
}

/**
 * Builds a map of hostname to service name from environment config
 * @function buildHostnameToServiceMap
 * @param {Object} dockerHosts - Docker environment hosts configuration
 * @returns {Object} Map of hostname to service name
 */
function buildHostnameToServiceMap(dockerHosts) {
  const hostnameToService = {};
  for (const [key, hostname] of Object.entries(dockerHosts)) {
    if (key.endsWith('_HOST')) {
      // Use hostname directly as service name (e.g., 'keycloak', 'miso-controller')
      hostnameToService[hostname] = hostname;
    }
  }
  return hostnameToService;
}

/**
 * Resolves port for a single URL by looking up service's application config
 * @function resolveUrlPort
 * @param {string} protocol - URL protocol (http:// or https://)
 * @param {string} hostname - Service hostname
 * @param {string} port - Current port
 * @param {string} urlPath - URL path and query string
 * @param {Object} hostnameToService - Map of hostname to service name
 * @returns {string} URL with resolved port
 */
function resolveUrlPort(protocol, hostname, port, urlPath, hostnameToService) {
  const serviceName = hostnameToService[hostname];
  if (!serviceName) {
    // Not a service hostname, keep original
    return `${protocol}${hostname}:${port}${urlPath}`;
  }

  const { resolveApplicationConfigPath } = require('./app-config-resolver');
  const { loadConfigFile } = require('./config-format');
  const builderPath = path.join(process.cwd(), 'builder', serviceName);
  let serviceVariablesPath;
  try {
    serviceVariablesPath = resolveApplicationConfigPath(builderPath);
  } catch {
    return `${protocol}${hostname}:${port}${urlPath}`;
  }

  try {
    const variables = loadConfigFile(serviceVariablesPath);
    const containerPort = getContainerPort(variables, port);
    return `${protocol}${hostname}:${containerPort}${urlPath}`;
  } catch (error) {
    logger.warn(`Warning: Could not load application config for service ${serviceName}: ${error.message}`);
    return `${protocol}${hostname}:${port}${urlPath}`;
  }
}

module.exports = {
  loadSecretsFromFile,
  loadPrimaryUserSecrets,
  loadUserSecrets,
  loadDefaultSecrets,
  ensurePrimaryUserSecretsFileExists,
  buildHostnameToServiceMap,
  resolveUrlPort
};

