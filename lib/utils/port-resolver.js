/**
 * AI Fabrix Builder - Centralized Port Resolution
 *
 * Single source of truth for resolving application port from application config.
 * Use getContainerPort for container/Docker/deployment/registration; use getLocalPort
 * for local .env and dev-id–adjusted host port.
 *
 * @fileoverview Port resolution from variables (port, build.containerPort)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');

/**
 * Resolve container port from variables object.
 * Precedence: build.containerPort (if set and non-empty) → port (main port) → defaultPort.
 * When containerPort is empty or missing, main port is used (e.g. keycloak 8082:8080 vs miso 3000:3000).
 *
 * @param {Object} variables - Parsed application config (or subset with build, port)
 * @param {number} [defaultPort=3000] - Default when neither build.containerPort nor port is set
 * @returns {number} Resolved container port
 */
function getContainerPort(variables, defaultPort = 3000) {
  const v = variables || {};
  const containerPort = v.build?.containerPort;
  const useMain = containerPort === undefined || containerPort === null ||
    (typeof containerPort === 'string' && containerPort.trim() === '');
  if (!useMain && typeof containerPort === 'number' && containerPort > 0) {
    return containerPort;
  }
  return v.port ?? defaultPort;
}

/**
 * Resolve local (development) port from variables object.
 * Precedence: build.localPort (when positive integer) → port → defaultPort.
 * Used for env-copy, env-ports, getLocalPortFromPath, run compose host port.
 *
 * @param {Object} variables - Parsed application config
 * @param {number} [defaultPort=3000] - Default when neither build.localPort nor port is set
 * @returns {number} Resolved local port
 */
function getLocalPort(variables, defaultPort = 3000) {
  const v = variables || {};
  const localPort = v.build?.localPort;
  if (typeof localPort === 'number' && localPort > 0) {
    return localPort;
  }
  return v.port ?? defaultPort;
}

/**
 * Load variables from path. Returns null if path missing, not found, or parse error.
 *
 * @param {string} variablesPath - Path to application config
 * @returns {Object|null} Parsed variables or null
 */
function loadVariablesFromPath(variablesPath) {
  if (!variablesPath || !fs.existsSync(variablesPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(variablesPath, 'utf8');
    return yaml.load(content) || null;
  } catch {
    return null;
  }
}

/**
 * Resolve container port from application config path.
 * When containerPort is empty or missing, returns main port. Null only when file missing or no port set.
 *
 * @param {string} variablesPath - Path to application config
 * @returns {number|null} Container port or null
 */
function getContainerPortFromPath(variablesPath) {
  const v = loadVariablesFromPath(variablesPath);
  if (!v) {
    return null;
  }
  const containerPort = v.build?.containerPort;
  const useMain = containerPort === undefined || containerPort === null ||
    (typeof containerPort === 'string' && containerPort.trim() === '');
  if (!useMain && typeof containerPort === 'number' && containerPort > 0) {
    return containerPort;
  }
  const p = v.port;
  return (p !== undefined && p !== null) ? p : null;
}

/**
 * Resolve local port from application config path.
 * Same rule as getLocalPort: build.localPort (when positive integer) → port.
 * Returns null when file is missing or neither localPort nor port is set.
 *
 * @param {string} variablesPath - Path to application config
 * @returns {number|null} Local port or null
 */
function getLocalPortFromPath(variablesPath) {
  const v = loadVariablesFromPath(variablesPath);
  if (!v) {
    return null;
  }
  const localPort = v.build?.localPort;
  if (typeof localPort === 'number' && localPort > 0) {
    return localPort;
  }
  const p = v.port;
  return (p !== undefined && p !== null) ? p : null;
}

module.exports = {
  getContainerPort,
  getLocalPort,
  getContainerPortFromPath,
  getLocalPortFromPath,
  loadVariablesFromPath
};
