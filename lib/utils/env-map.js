/**
 * Environment variable mapping utilities
 *
 * @fileoverview Build interpolation map from env-config.yaml and config overrides
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { loadEnvConfig } = require('./env-config-loader');

/**
 * Build environment variable map for interpolation based on env-config.yaml
 * - Supports values like "host:port" by splitting into *_HOST (host) and *_PORT (port)
 * - Merges overrides from ~/.aifabrix/config.yaml under environments.{env}
 * - Applies aifabrix-localhost override for local context if configured
 * @async
 * @function buildEnvVarMap
 * @param {'docker'|'local'} context - Environment context
 * @param {Object} [osModule] - Optional os module (for testing). If not provided, requires 'os'
 * @returns {Promise<Object>} Map of variables for interpolation
 */
async function buildEnvVarMap(context, osModule = null) {
  // Load env-config (base + user override if configured)
  let baseVars = {};
  try {
    const envCfg = await loadEnvConfig();
    const envs = envCfg && envCfg.environments ? envCfg.environments : {};
    baseVars = { ...(envs[context] || {}) };
  } catch {
    baseVars = {};
  }

  // Get os module - use provided one or require it
  const os = osModule || require('os');

  // Merge overrides from ~/.aifabrix/config.yaml
  let overrideVars = {};
  try {
    const cfgPath = path.join(os.homedir(), '.aifabrix', 'config.yaml');
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (cfg && cfg.environments && cfg.environments[context]) {
        overrideVars = { ...cfg.environments[context] };
      }
    }
  } catch {
    // ignore overrides on error
  }

  // Apply aifabrix-localhost override for local hostnames
  let localhostOverride = null;
  if (context === 'local') {
    try {
      const cfgPath = path.join(os.homedir(), '.aifabrix', 'config.yaml');
      if (fs.existsSync(cfgPath)) {
        const cfgContent = fs.readFileSync(cfgPath, 'utf8');
        const cfg = yaml.load(cfgContent) || {};
        if (typeof cfg['aifabrix-localhost'] === 'string' && cfg['aifabrix-localhost'].trim().length > 0) {
          localhostOverride = cfg['aifabrix-localhost'].trim();
        }
      }
    } catch {
      // ignore
    }
  }

  const merged = { ...baseVars, ...overrideVars };

  // Normalize map: if VAR value is "host:port" and VAR ends with "_HOST",
  // expose VAR as host only and also provide "<ROOT>_PORT"
  // If VAR value is "host:port" but VAR doesn't end with "_HOST", still split to VAR_HOST/VAR_PORT
  const result = {};
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
        // Example: DB_HOST: "postgres:5432" -> DB_HOST="postgres", DB_PORT="5432"
        const root = key.replace(/_HOST$/, '');
        const hostValue = context === 'local' && host === 'localhost' && localhostOverride ? localhostOverride : host;
        result[key] = hostValue;
        result[`${root}_PORT`] = port;
      } else {
        // Generic key with host:port -> expose KEY_HOST and KEY_PORT, and keep KEY as host
        const hostValue = context === 'local' && host === 'localhost' && localhostOverride ? localhostOverride : host;
        result[`${key}_HOST`] = hostValue;
        result[`${key}_PORT`] = port;
        result[key] = hostValue;
      }
    } else {
      // Plain value
      let val = rawVal;
      if (context === 'local' && /_HOST$/.test(key) && rawVal === 'localhost' && localhostOverride) {
        val = localhostOverride;
      }
      result[key] = val;
    }
  }
  return result;
}

module.exports = {
  buildEnvVarMap
};

