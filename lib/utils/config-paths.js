/**
 * AI Fabrix Builder - Configuration Path Utilities
 *
 * Helper functions for managing path configuration in config.yaml
 *
 * @fileoverview Path configuration utilities for config management
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');

/**
 * Get path configuration value
 * @async
 * @param {Function} getConfigFn - Function to get config
 * @param {string} key - Configuration key
 * @returns {Promise<string|null>} Path value or null
 */
async function getPathConfig(getConfigFn, key) {
  const config = await getConfigFn();
  return config[key] || null;
}

/**
 * Set path configuration value
 * @async
 * @param {Function} getConfigFn - Function to get config
 * @param {Function} saveConfigFn - Function to save config
 * @param {string} key - Configuration key
 * @param {string} value - Path value
 * @param {string} errorMsg - Error message if validation fails
 * @returns {Promise<void>}
 */
async function setPathConfig(getConfigFn, saveConfigFn, key, value, errorMsg) {
  if (!value || typeof value !== 'string') {
    throw new Error(errorMsg);
  }
  const config = await getConfigFn();
  config[key] = value;
  await saveConfigFn(config);
}

function createHomeAndSecretsPathFunctions(getConfigFn, saveConfigFn) {
  return {
    async getAifabrixHomeOverride() {
      return getPathConfig(getConfigFn, 'aifabrix-home');
    },
    async setAifabrixHomeOverride(homePath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-home', homePath, 'Home path is required and must be a string');
    },
    async getAifabrixSecretsPath() {
      return getPathConfig(getConfigFn, 'aifabrix-secrets');
    },
    async setAifabrixSecretsPath(secretsPath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-secrets', secretsPath, 'Secrets path is required and must be a string');
    }
  };
}

function createEnvConfigPathFunctions(getConfigFn, saveConfigFn) {
  return {
    async getAifabrixEnvConfigPath() {
      return getPathConfig(getConfigFn, 'aifabrix-env-config');
    },
    async setAifabrixEnvConfigPath(envConfigPath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-env-config', envConfigPath, 'Env config path is required and must be a string');
    },
    async getAifabrixBuilderDir() {
      const envConfigPath = await getPathConfig(getConfigFn, 'aifabrix-env-config');
      return envConfigPath && typeof envConfigPath === 'string' ? path.dirname(envConfigPath) : null;
    }
  };
}

/**
 * Create path configuration functions with config access
 * @param {Function} getConfigFn - Function to get config
 * @param {Function} saveConfigFn - Function to save config
 * @returns {Object} Path configuration functions
 */
function createPathConfigFunctions(getConfigFn, saveConfigFn) {
  return {
    ...createHomeAndSecretsPathFunctions(getConfigFn, saveConfigFn),
    ...createEnvConfigPathFunctions(getConfigFn, saveConfigFn)
  };
}

module.exports = {
  getPathConfig,
  setPathConfig,
  createPathConfigFunctions
};

