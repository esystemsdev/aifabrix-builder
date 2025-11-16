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
const os = require('os');
const logger = require('./logger');

/**
 * Loads secrets from file with cascading lookup support
 * First checks ~/.aifabrix/secrets.local.yaml, then aifabrix-secrets from config.yaml
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
    const secrets = yaml.load(content);

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
 * Loads user secrets from ~/.aifabrix/secrets.local.yaml
 * @function loadUserSecrets
 * @returns {Object} Loaded secrets object or empty object
 */
function loadUserSecrets() {
  const userSecretsPath = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');
  if (!fs.existsSync(userSecretsPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(userSecretsPath, 'utf8');
    const secrets = yaml.load(content);
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
 * Loads default secrets from ~/.aifabrix/secrets.yaml
 * @function loadDefaultSecrets
 * @returns {Object} Loaded secrets object or empty object
 */
function loadDefaultSecrets() {
  const defaultPath = path.join(os.homedir(), '.aifabrix', 'secrets.yaml');
  if (!fs.existsSync(defaultPath)) {
    return {};
  }

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
 * Resolves port for a single URL by looking up service's variables.yaml
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

  // Try to load service's variables.yaml
  const serviceVariablesPath = path.join(process.cwd(), 'builder', serviceName, 'variables.yaml');
  if (!fs.existsSync(serviceVariablesPath)) {
    // Service variables.yaml not found, keep original port
    return `${protocol}${hostname}:${port}${urlPath}`;
  }

  try {
    const variablesContent = fs.readFileSync(serviceVariablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    // Get containerPort or fall back to port
    const containerPort = variables?.build?.containerPort || variables?.port || port;

    // Replace port in URL
    return `${protocol}${hostname}:${containerPort}${urlPath}`;
  } catch (error) {
    // Error loading variables.yaml, keep original port
    logger.warn(`Warning: Could not load variables.yaml for service ${serviceName}: ${error.message}`);
    return `${protocol}${hostname}:${port}${urlPath}`;
  }
}

module.exports = {
  loadSecretsFromFile,
  loadUserSecrets,
  loadDefaultSecrets,
  buildHostnameToServiceMap,
  resolveUrlPort
};

