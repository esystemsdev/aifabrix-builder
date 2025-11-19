/**
 * Environment endpoint rewriting utilities
 *
 * @fileoverview Rewrites infra endpoints using env-config and developer offsets
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../config');
const devConfig = require('../utils/dev-config');
const { loadEnvConfig } = require('./env-config-loader');

/**
 * Returns the environment hosts mapping from env-config.yaml
 * @async
 * @param {'docker'|'local'} context
 * @returns {Promise<Object>}
 */
async function getEnvHosts(context) {
  const envCfg = await loadEnvConfig();
  const envs = envCfg && envCfg.environments ? envCfg.environments : {};
  return envs[context] || {};
}

/**
 * Split host:port value into host and port
 * @function splitHost
 * @param {string|number} value - Host:port string or plain value
 * @returns {{host: string|undefined, port: number|undefined}} Split host and port
 */
function splitHost(value) {
  if (typeof value !== 'string') return { host: undefined, port: undefined };
  const m = value.match(/^([^:]+):(\d+)$/);
  if (m) return { host: m[1], port: parseInt(m[2], 10) };
  return { host: value, port: undefined };
}

/**
 * Get aifabrix-localhost override from config.yaml for local context
 * @function getLocalhostOverride
 * @param {'docker'|'local'} context - Environment context
 * @returns {string|null} Localhost override value or null
 */
function getLocalhostOverride(context) {
  if (context !== 'local') return null;
  try {
    const os = require('os');
    const cfgPath = path.join(os.homedir(), '.aifabrix', 'config.yaml');
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (typeof cfg['aifabrix-localhost'] === 'string' && cfg['aifabrix-localhost'].trim().length > 0) {
        return cfg['aifabrix-localhost'].trim();
      }
    }
  } catch {
    // ignore override errors
  }
  return null;
}

/**
 * Get service port with developer-id adjustment (only for local context)
 * @async
 * @function getServicePort
 * @param {string} portKey - Port key (e.g., 'REDIS_PORT', 'DB_PORT')
 * @param {string} serviceName - Service name (e.g., 'redis', 'postgres')
 * @param {Object} hosts - Hosts configuration object
 * @param {'docker'|'local'} context - Environment context
 * @param {Object} [devPorts] - Optional devPorts object with pre-adjusted ports
 * @returns {Promise<number>} Service port with developer-id adjustment (for local context only)
 */
async function getServicePort(portKey, serviceName, hosts, context, devPorts) {
  // If devPorts provided, use it (already has developer-id adjustment)
  if (devPorts && typeof devPorts[serviceName] === 'number') {
    return devPorts[serviceName];
  }

  // Get base port from config
  let basePort = null;
  if (hosts[portKey] !== undefined && hosts[portKey] !== null) {
    const portVal = typeof hosts[portKey] === 'number' ? hosts[portKey] : parseInt(hosts[portKey], 10);
    if (!Number.isNaN(portVal)) {
      basePort = portVal;
    }
  }

  // Last resort fallback to devConfig (only if not in config)
  if (basePort === null || basePort === undefined) {
    const basePorts = devConfig.getBasePorts();
    basePort = basePorts[serviceName];
  }

  // Apply developer-id adjustment only for local context
  if (context === 'local') {
    try {
      const devId = await config.getDeveloperId();
      let devIdNum = 0;
      if (devId !== null && devId !== undefined) {
        const parsed = parseInt(devId, 10);
        if (!Number.isNaN(parsed)) {
          devIdNum = parsed;
        }
      }
      return devIdNum === 0 ? basePort : (basePort + (devIdNum * 100));
    } catch {
      return basePort;
    }
  }

  // For docker context, return base port without adjustment
  return basePort;
}

/**
 * Get service host with localhost override applied
 * @function getServiceHost
 * @param {string|undefined} host - Host value from config
 * @param {'docker'|'local'} context - Environment context
 * @param {string} defaultHost - Default host if not in config
 * @param {string|null} localhostOverride - Localhost override value
 * @returns {string} Final host value
 */
function getServiceHost(host, context, defaultHost, localhostOverride) {
  const finalHost = host || defaultHost;
  if (context === 'local' && localhostOverride && finalHost === 'localhost') {
    return localhostOverride;
  }
  return finalHost;
}

/**
 * Update endpoint variables in env content
 * @function updateEndpointVariables
 * @param {string} envContent - Environment content
 * @param {string} redisHost - Redis host
 * @param {number} redisPort - Redis port
 * @param {string} dbHost - Database host
 * @param {number} dbPort - Database port
 * @returns {string} Updated content
 */
function updateEndpointVariables(envContent, redisHost, redisPort, dbHost, dbPort) {
  let updated = envContent;

  // Update REDIS_URL if present
  if (/^REDIS_URL\s*=.*$/m.test(updated)) {
    const m = updated.match(/^REDIS_URL\s*=\s*redis:\/\/([^:\s]+):\d+/m);
    const currentHost = m && m[1] ? m[1] : null;
    const targetHost = redisHost || currentHost;
    if (targetHost) {
      updated = updated.replace(
        /^REDIS_URL\s*=\s*.*$/m,
        `REDIS_URL=redis://${targetHost}:${redisPort}`
      );
    }
  }

  // Update REDIS_HOST if present
  if (/^REDIS_HOST\s*=.*$/m.test(updated)) {
    const hostPortMatch = updated.match(/^REDIS_HOST\s*=\s*([a-zA-Z0-9_.-]+):\d+$/m);
    const hasPortPattern = !!hostPortMatch;
    if (hasPortPattern) {
      updated = updated.replace(
        /^REDIS_HOST\s*=\s*.*$/m,
        `REDIS_HOST=${redisHost}:${redisPort}`
      );
    } else {
      updated = updated.replace(/^REDIS_HOST\s*=\s*.*$/m, `REDIS_HOST=${redisHost}`);
    }
  }

  // Update REDIS_PORT if present
  if (/^REDIS_PORT\s*=.*$/m.test(updated)) {
    updated = updated.replace(
      /^REDIS_PORT\s*=\s*.*$/m,
      `REDIS_PORT=${redisPort}`
    );
  }

  // Update DB_HOST if present
  if (/^DB_HOST\s*=.*$/m.test(updated)) {
    updated = updated.replace(/^DB_HOST\s*=\s*.*$/m, `DB_HOST=${dbHost}`);
  }

  // Update DB_PORT if present
  if (/^DB_PORT\s*=.*$/m.test(updated)) {
    updated = updated.replace(
      /^DB_PORT\s*=\s*.*$/m,
      `DB_PORT=${dbPort}`
    );
  }

  // Update DATABASE_PORT if present (some templates use DATABASE_PORT instead of DB_PORT)
  if (/^DATABASE_PORT\s*=.*$/m.test(updated)) {
    updated = updated.replace(
      /^DATABASE_PORT\s*=\s*.*$/m,
      `DATABASE_PORT=${dbPort}`
    );
  }

  return updated;
}

/**
 * Rewrites infra endpoints (REDIS_URL/REDIS_HOST/REDIS_PORT, DB_HOST/DB_PORT, etc.) based on env-config and context
 * Uses getEnvHosts() to get all service values dynamically, avoiding hardcoded values
 * @async
 * @function rewriteInfraEndpoints
 * @param {string} envContent - .env file content
 * @param {'docker'|'local'} context - Environment context
 * @param {{redis:number, postgres:number}} [devPorts] - Ports object with developer-id adjusted ports (optional)
 * @param {Object} [adjustedHosts] - Optional adjusted hosts object (with developer-id adjusted ports) to use instead of loading from config
 * @returns {Promise<string>} Updated content
 */
async function rewriteInfraEndpoints(envContent, context, devPorts, adjustedHosts) {
  // Get all service values from config system (includes env-config.yaml + user env-config file)
  // Use adjustedHosts if provided, otherwise load from config
  let hosts = adjustedHosts || await getEnvHosts(context);

  // Apply config.yaml → environments.{context} override (if exists)
  try {
    const os = require('os');
    const cfgPath = path.join(os.homedir(), '.aifabrix', 'config.yaml');
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (cfg && cfg.environments && cfg.environments[context]) {
        hosts = { ...hosts, ...cfg.environments[context] };
      }
    }
  } catch {
    // Ignore config.yaml read errors, continue with env-config values
  }

  // Get localhost override for local context
  const localhostOverride = getLocalhostOverride(context);

  // Get Redis configuration
  const redisParts = splitHost(hosts.REDIS_HOST);
  const redisHost = getServiceHost(redisParts.host || hosts.REDIS_HOST, context, context === 'docker' ? 'redis' : 'localhost', localhostOverride);
  const redisPort = await getServicePort('REDIS_PORT', 'redis', hosts, context, devPorts);

  // Get DB configuration
  const dbHost = getServiceHost(hosts.DB_HOST, context, context === 'docker' ? 'postgres' : 'localhost', localhostOverride);
  const dbPort = await getServicePort('DB_PORT', 'postgres', hosts, context, devPorts);

  // Update endpoint variables
  return updateEndpointVariables(envContent, redisHost, redisPort, dbHost, dbPort);
}

module.exports = {
  rewriteInfraEndpoints,
  getEnvHosts,
  splitHost,
  getServicePort,
  getServiceHost,
  updateEndpointVariables
};

