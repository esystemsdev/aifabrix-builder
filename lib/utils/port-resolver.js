/**
 * AI Fabrix Builder - Centralized Port Resolution
 *
 * Single source of truth for resolving application port from application config.
 * Use getContainerPort for container/Docker/deployment/registration; use getLocalPort
 * for local .env and dev-id–adjusted host port.
 *
 * @fileoverview Port resolution from variables (port, build.containerPort, build.localPort)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');

/**
 * Resolve container port from variables object.
 * Precedence: build.containerPort → port → defaultPort.
 * Used for: Dockerfile, container .env PORT, compose, deployment, app register, variable-transformer, builders, secrets-utils.
 *
 * @param {Object} variables - Parsed application config (or subset with build, port)
 * @param {number} [defaultPort=3000] - Default when neither build.containerPort nor port is set
 * @returns {number} Resolved container port
 */
function getContainerPort(variables, defaultPort = 3000) {
  const v = variables || {};
  return v.build?.containerPort ?? v.port ?? defaultPort;
}

/**
 * Resolve local (development) port from variables object.
 * Precedence: build.localPort (if number and > 0) → port → defaultPort.
 * Used for: env-copy, env-ports, and as base for getLocalPortFromPath (secrets-helpers).
 *
 * @param {Object} variables - Parsed application config
 * @param {number} [defaultPort=3000] - Default when neither build.localPort nor port is set
 * @returns {number} Resolved local port
 */
function getLocalPort(variables, defaultPort = 3000) {
  const v = variables || {};
  const local = v.build?.localPort;
  if (typeof local === 'number' && local > 0) {
    return local;
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
 * Returns null when file is missing or neither build.containerPort nor port is set (for chaining with other sources).
 *
 * @param {string} variablesPath - Path to application config
 * @returns {number|null} Container port or null
 */
function getContainerPortFromPath(variablesPath) {
  const v = loadVariablesFromPath(variablesPath);
  if (!v) {
    return null;
  }
  const p = v.build?.containerPort ?? v.port;
  return (p !== undefined && p !== null) ? p : null;
}

/**
 * Resolve local port from application config path.
 * Matches legacy getPortFromVariablesFile: build.localPort (if number and > 0) else variables.port or null.
 * Returns null when file is missing or neither is set (for calculateAppPort chain).
 *
 * @param {string} variablesPath - Path to application config
 * @returns {number|null} Local port or null
 */
function getLocalPortFromPath(variablesPath) {
  const v = loadVariablesFromPath(variablesPath);
  if (!v) {
    return null;
  }
  const local = v.build?.localPort;
  if (typeof local === 'number' && local > 0) {
    return local;
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
