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
 * Uses port only (build.localPort removed). Used for env-copy, env-ports, getLocalPortFromPath.
 *
 * @param {Object} variables - Parsed application config
 * @param {number} [defaultPort=3000] - Default when port is not set
 * @returns {number} Resolved local port
 */
function getLocalPort(variables, defaultPort = 3000) {
  const v = variables || {};
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
 * Resolve local port from application config path (port only; build.localPort removed).
 * Returns null when file is missing or port is not set.
 *
 * @param {string} variablesPath - Path to application config
 * @returns {number|null} Local port or null
 */
function getLocalPortFromPath(variablesPath) {
  const v = loadVariablesFromPath(variablesPath);
  if (!v) {
    return null;
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
