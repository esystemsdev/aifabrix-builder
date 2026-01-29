/**
 * Environment variable mapping utilities
 *
 * @fileoverview Build interpolation map from env-config.yaml and config overrides
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const { loadEnvConfig, loadSchemaEnvConfig } = require('./env-config-loader');
const config = require('../core/config');

/**
 * Load base environment variables from env-config.yaml
 * @async
 * @function loadBaseVars
 * @param {'docker'|'local'} context - Environment context
 * @returns {Promise<Object>} Base environment variables
 */
async function loadBaseVars(context) {
  try {
    const envCfg = await loadEnvConfig();
    const envs = envCfg && envCfg.environments ? envCfg.environments : {};
    return { ...(envs[context] || {}) };
  } catch {
    return {};
  }
}

/**
 * Load override variables from ~/.aifabrix/config.yaml
 * @function loadOverrideVars
 * @param {'docker'|'local'} context - Environment context
 * @param {Object} os - OS module instance
 * @returns {Object} Override environment variables
 */
function loadOverrideVars(context, _os) {
  try {
    const cfgPath = config.CONFIG_FILE;
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (cfg && cfg.environments && cfg.environments[context]) {
        return { ...cfg.environments[context] };
      }
    }
  } catch {
    // ignore overrides on error
  }
  return {};
}

/**
 * Get localhost override value from config
 * @function getLocalhostOverride
 * @param {Object} os - OS module instance
 * @returns {string|null} Localhost override value or null
 */
function getLocalhostOverride(_os) {
  try {
    const cfgPath = config.CONFIG_FILE;
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (typeof cfg['aifabrix-localhost'] === 'string' && cfg['aifabrix-localhost'].trim().length > 0) {
        return cfg['aifabrix-localhost'].trim();
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Get host value with localhost override applied if needed
 * @function getHostValue
 * @param {string} host - Original host value
 * @param {'docker'|'local'} context - Environment context
 * @param {string|null} localhostOverride - Localhost override value
 * @returns {string} Host value with override applied
 */
function getHostValue(host, context, localhostOverride) {
  if (context === 'local' && host === 'localhost' && localhostOverride) {
    return localhostOverride;
  }
  return host;
}

/**
 * Handle host:port value for key ending with _HOST
 * @function handleHostPortWithHostSuffix
 * @param {Object} result - Result object to update
 * @param {string} key - Environment variable key
 * @param {string} host - Host value
 * @param {string} port - Port value
 * @param {Object} options - Normalization options
 * @param {'docker'|'local'} options.context - Environment context
 * @param {string|null} options.localhostOverride - Localhost override value
 */
function handleHostPortWithHostSuffix(result, key, host, port, options) {
  const root = key.replace(/_HOST$/, '');
  const hostValue = getHostValue(host, options.context, options.localhostOverride);
  result[key] = hostValue;
  result[`${root}_PORT`] = port;
}

/**
 * Handle host:port value for generic key
 * @function handleHostPortGeneric
 * @param {Object} result - Result object to update
 * @param {string} key - Environment variable key
 * @param {string} host - Host value
 * @param {string} port - Port value
 * @param {Object} options - Normalization options
 * @param {'docker'|'local'} options.context - Environment context
 * @param {string|null} options.localhostOverride - Localhost override value
 */
function handleHostPortGeneric(result, key, host, port, options) {
  const hostValue = getHostValue(host, options.context, options.localhostOverride);
  result[`${key}_HOST`] = hostValue;
  result[`${key}_PORT`] = port;
  result[key] = hostValue;
}

/**
 * Handle plain value (non-host:port)
 * @function handlePlainValue
 * @param {Object} result - Result object to update
 * @param {string} key - Environment variable key
 * @param {string} rawVal - Raw value
 * @param {Object} options - Normalization options
 * @param {'docker'|'local'} options.context - Environment context
 * @param {string|null} options.localhostOverride - Localhost override value
 */
function handlePlainValue(result, key, rawVal, options) {
  let val = rawVal;
  if (options.context === 'local' && /_HOST$/.test(key) && rawVal === 'localhost' && options.localhostOverride) {
    val = options.localhostOverride;
  }
  result[key] = val;
}

/**
 * Normalize environment variable map by splitting host:port values
 * @function normalizeEnvVars
 * @param {Object} merged - Merged environment variables
 * @param {'docker'|'local'} context - Environment context
 * @param {string|null} localhostOverride - Localhost override value
 * @returns {Object} Normalized environment variables
 */
function normalizeEnvVars(merged, context, localhostOverride) {
  const result = {};
  const options = { context, localhostOverride };
  for (const [key, rawVal] of Object.entries(merged)) {
    if (typeof rawVal !== 'string') {
      result[key] = rawVal;
      continue;
    }
    const hostPortMatch = rawVal.match(/^([A-Za-z0-9._-]+):(\d+)$/);
    if (hostPortMatch) {
      const host = hostPortMatch[1];
      const port = hostPortMatch[2];
      if (/_HOST$/.test(key)) {
        handleHostPortWithHostSuffix(result, key, host, port, options);
      } else {
        handleHostPortGeneric(result, key, host, port, options);
      }
    } else {
      handlePlainValue(result, key, rawVal, options);
    }
  }
  return result;
}

/**
 * Get developer ID number from parameter or config
 * @async
 * @function getDeveloperIdNumber
 * @param {number|null} developerId - Optional developer ID parameter
 * @returns {Promise<number>} Developer ID number (0 if not available)
 */
async function getDeveloperIdNumber(developerId) {
  if (developerId !== null && developerId !== undefined) {
    const parsed = typeof developerId === 'number' ? developerId : parseInt(developerId, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  try {
    const devId = await config.getDeveloperId();
    if (devId !== null && devId !== undefined) {
      const parsed = parseInt(devId, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore, will use 0
  }
  return 0;
}

/**
 * Apply developer-id adjustment to port variables for local context
 * @function applyLocalPortAdjustment
 * @param {Object} result - Environment variable map
 * @param {number} devIdNum - Developer ID number
 */
function applyLocalPortAdjustment(result, devIdNum) {
  if (devIdNum === 0) {
    return;
  }
  for (const [key, value] of Object.entries(result)) {
    if (/_PORT$/.test(key)) {
      let portVal;
      if (typeof value === 'string') {
        portVal = parseInt(value, 10);
      } else if (typeof value === 'number') {
        portVal = value;
      } else {
        continue;
      }
      if (!Number.isNaN(portVal)) {
        result[key] = String(portVal + (devIdNum * 100));
      }
    }
  }
}

/**
 * Calculate public ports for docker context
 * Uses schema env-config ports only so *_PUBLIC_PORT is always canonical base + devId*100
 * (e.g. KEYCLOAK_PUBLIC_PORT = 8082 + 600 = 8682 for dev 6, even if user env-config or config overrides KEYCLOAK_PORT to 8080)
 *
 * @function calculateDockerPublicPorts
 * @param {Object} result - Environment variable map (merged base + overrides)
 * @param {number} devIdNum - Developer ID number
 * @param {Object} [schemaBaseVars] - Schema-only env-config vars (lib/schema/env-config.yaml) for *_PUBLIC_PORT
 */
function calculateDockerPublicPorts(result, devIdNum, schemaBaseVars = {}) {
  if (devIdNum <= 0) {
    return;
  }
  for (const [key, value] of Object.entries(result)) {
    // Match any variable ending with _PORT (e.g., MISO_PORT, KEYCLOAK_PORT, DB_PORT)
    if (/_PORT$/.test(key) && !/_PUBLIC_PORT$/.test(key)) {
      const publicPortKey = key.replace(/_PORT$/, '_PUBLIC_PORT');
      // Use schema port when available so PUBLIC_PORT is canonical (e.g. 8082), not overridden (e.g. 8080)
      const schemaPort = schemaBaseVars[key];
      const sourceVal = schemaPort !== undefined && schemaPort !== null ? schemaPort : value;
      let portVal;
      if (typeof sourceVal === 'string') {
        portVal = parseInt(sourceVal, 10);
      } else if (typeof sourceVal === 'number') {
        portVal = sourceVal;
      } else {
        continue;
      }
      if (!Number.isNaN(portVal)) {
        result[publicPortKey] = String(portVal + (devIdNum * 100));
      }
    }
  }
}

/**
 * Build environment variable map for interpolation based on env-config.yaml
 * - Supports values like "host:port" by splitting into *_HOST (host) and *_PORT (port)
 * - Merges overrides from ~/.aifabrix/config.yaml under environments.{env}
 * - Applies aifabrix-localhost override for local context if configured
 * - Applies developer-id adjustment to port variables for local context
 * - Calculates *_PUBLIC_PORT for docker context (basePort + developer-id * 100)
 * @async
 * @function buildEnvVarMap
 * @param {'docker'|'local'} context - Environment context
 * @param {Object} [osModule] - Optional os module (for testing). If not provided, requires 'os'
 * @param {number|null} [developerId] - Optional developer ID for port adjustment. If not provided, will be fetched from config for local context.
 * @returns {Promise<Object>} Map of variables for interpolation
 */
async function buildEnvVarMap(context, osModule = null, developerId = null) {
  const baseVars = await loadBaseVars(context);
  const os = osModule || require('os');
  const overrideVars = loadOverrideVars(context, os);
  const localhostOverride = context === 'local' ? getLocalhostOverride(os) : null;
  const merged = { ...baseVars, ...overrideVars };
  const result = normalizeEnvVars(merged, context, localhostOverride);

  if (context === 'local') {
    const devIdNum = await getDeveloperIdNumber(developerId);
    applyLocalPortAdjustment(result, devIdNum);
  } else if (context === 'docker') {
    const devIdNum = await getDeveloperIdNumber(developerId);
    const schemaCfg = loadSchemaEnvConfig();
    const schemaBaseVars = (schemaCfg && schemaCfg.environments && schemaCfg.environments[context]) ? schemaCfg.environments[context] : {};
    calculateDockerPublicPorts(result, devIdNum, schemaBaseVars);
  }

  return result;
}

module.exports = {
  buildEnvVarMap,
  getDeveloperIdNumber
};

