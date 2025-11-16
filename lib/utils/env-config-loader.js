/**
 * Environment config loader
 *
 * @fileoverview Loads lib/schema/env-config.yaml for env variable interpolation
 * Merges with user's env-config file if configured in ~/.aifabrix/config.yaml
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../config');

/**
 * Loads user env-config file if configured
 * @async
 * @function loadUserEnvConfig
 * @returns {Promise<Object|null>} Parsed user env-config or null if not configured
 */
async function loadUserEnvConfig() {
  try {
    const userEnvConfigPath = await config.getAifabrixEnvConfigPath();
    if (!userEnvConfigPath) {
      return null;
    }

    // Resolve path (support absolute and relative paths)
    const resolvedPath = path.isAbsolute(userEnvConfigPath)
      ? userEnvConfigPath
      : path.resolve(process.cwd(), userEnvConfigPath);

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const userConfig = yaml.load(content);
    return userConfig && typeof userConfig === 'object' ? userConfig : null;
  } catch (error) {
    // Gracefully handle errors - fallback to base config only
    return null;
  }
}

/**
 * Merges user env-config with base env-config
 * User values override/extend base values
 * @function mergeEnvConfigs
 * @param {Object} baseConfig - Base env-config from lib/schema/env-config.yaml
 * @param {Object|null} userConfig - User env-config or null
 * @returns {Object} Merged env-config
 */
function mergeEnvConfigs(baseConfig, userConfig) {
  if (!userConfig || typeof userConfig !== 'object') {
    return baseConfig || {};
  }

  // Deep merge environments
  const merged = { ...baseConfig };
  if (userConfig.environments && typeof userConfig.environments === 'object') {
    merged.environments = { ...(baseConfig.environments || {}) };
    for (const [env, envVars] of Object.entries(userConfig.environments)) {
      if (envVars && typeof envVars === 'object') {
        merged.environments[env] = {
          ...(merged.environments[env] || {}),
          ...envVars
        };
      }
    }
  }

  return merged;
}

/**
 * Load env config YAML used for environment variable interpolation
 * Loads base config from lib/schema/env-config.yaml and merges with user config if configured
 * @async
 * @function loadEnvConfig
 * @returns {Promise<Object>} Parsed and merged env-config YAML
 * @throws {Error} If base file cannot be read or parsed
 */
async function loadEnvConfig() {
  // Load base env-config.yaml
  const envConfigPath = path.join(__dirname, '..', 'schema', 'env-config.yaml');
  const content = fs.readFileSync(envConfigPath, 'utf8');
  const baseConfig = yaml.load(content) || {};

  // Load user env-config if configured
  const userConfig = await loadUserEnvConfig();

  // Merge user config with base (user overrides/extends base)
  return mergeEnvConfigs(baseConfig, userConfig);
}

module.exports = {
  loadEnvConfig
};

