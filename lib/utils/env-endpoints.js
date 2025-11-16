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
 * Rewrites infra endpoints (REDIS_URL/REDIS_HOST/REDIS_PORT, DB_HOST/DB_PORT, etc.) based on env-config and context
 * Uses getEnvHosts() to get all service values dynamically, avoiding hardcoded values
 * @async
 * @function rewriteInfraEndpoints
 * @param {string} envContent - .env file content
 * @param {'docker'|'local'} context - Environment context
 * @param {{redis:number, postgres:number}} [devPorts] - Ports object with developer-id adjusted ports (optional)
 * @returns {Promise<string>} Updated content
 */
async function rewriteInfraEndpoints(envContent, context, devPorts) {
  // Get all service values from config system (includes env-config.yaml + user env-config file)
  let hosts = await getEnvHosts(context);

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

  // Helper to split host:port values
  const splitHost = (value) => {
    if (typeof value !== 'string') return { host: undefined, port: undefined };
    const m = value.match(/^([^:]+):(\d+)$/);
    if (m) return { host: m[1], port: parseInt(m[2], 10) };
    return { host: value, port: undefined };
  };

  // Get aifabrix-localhost override for local context
  let localhostOverride = null;
  if (context === 'local') {
    try {
      const os = require('os');
      const cfgPath = path.join(os.homedir(), '.aifabrix', 'config.yaml');
      if (fs.existsSync(cfgPath)) {
        const cfgContent = fs.readFileSync(cfgPath, 'utf8');
        const cfg = yaml.load(cfgContent) || {};
        if (typeof cfg['aifabrix-localhost'] === 'string' && cfg['aifabrix-localhost'].trim().length > 0) {
          localhostOverride = cfg['aifabrix-localhost'].trim();
        }
      }
    } catch {
      // ignore override errors
    }
  }

  // Helper to get port value from config or devPorts, with developer-id adjustment
  const getServicePort = async(portKey, serviceName) => {
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

    // Apply developer-id adjustment
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
  };

  // Get Redis configuration
  const redisParts = splitHost(hosts.REDIS_HOST);
  let redisHost = redisParts.host || hosts.REDIS_HOST;
  // Fallback to default if not in config
  if (!redisHost) {
    redisHost = context === 'docker' ? 'redis' : 'localhost';
  }
  if (context === 'local' && localhostOverride && redisHost === 'localhost') {
    redisHost = localhostOverride;
  }
  const redisPort = await getServicePort('REDIS_PORT', 'redis');

  // Get DB configuration
  let dbHost = hosts.DB_HOST;
  // Fallback to default if not in config
  if (!dbHost) {
    dbHost = context === 'docker' ? 'postgres' : 'localhost';
  }
  const finalDbHost = (context === 'local' && localhostOverride && dbHost === 'localhost') ? localhostOverride : dbHost;
  const dbPort = await getServicePort('DB_PORT', 'postgres');

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
    updated = updated.replace(/^DB_HOST\s*=\s*.*$/m, `DB_HOST=${finalDbHost}`);
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

module.exports = {
  rewriteInfraEndpoints,
  getEnvHosts
};

