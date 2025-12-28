/**
 * AI Fabrix Builder - Configuration Path Utilities
 *
 * Helper functions for managing path configuration in config.yaml
 *
 * @fileoverview Path configuration utilities for config management
 * @author AI Fabrix Team
 * @version 2.0.0
 */

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

/**
 * Create path configuration functions with config access
 * @param {Function} getConfigFn - Function to get config
 * @param {Function} saveConfigFn - Function to save config
 * @returns {Object} Path configuration functions
 */
function createPathConfigFunctions(getConfigFn, saveConfigFn) {
  return {
    /**
     * Get aifabrix-home override path
     * @async
     * @returns {Promise<string|null>} Home path or null
     */
    async getAifabrixHomeOverride() {
      return getPathConfig(getConfigFn, 'aifabrix-home');
    },

    /**
     * Set aifabrix-home override path
     * @async
     * @param {string} homePath - Home path
     * @returns {Promise<void>}
     */
    async setAifabrixHomeOverride(homePath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-home', homePath, 'Home path is required and must be a string');
    },

    /**
     * Get aifabrix-secrets path
     * @async
     * @returns {Promise<string|null>} Secrets path or null
     */
    async getAifabrixSecretsPath() {
      return getPathConfig(getConfigFn, 'aifabrix-secrets');
    },

    /**
     * Set aifabrix-secrets path
     * @async
     * @param {string} secretsPath - Secrets path
     * @returns {Promise<void>}
     */
    async setAifabrixSecretsPath(secretsPath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-secrets', secretsPath, 'Secrets path is required and must be a string');
    },

    /**
     * Get aifabrix-env-config path
     * @async
     * @returns {Promise<string|null>} Env config path or null
     */
    async getAifabrixEnvConfigPath() {
      return getPathConfig(getConfigFn, 'aifabrix-env-config');
    },

    /**
     * Set aifabrix-env-config path
     * @async
     * @param {string} envConfigPath - Env config path
     * @returns {Promise<void>}
     */
    async setAifabrixEnvConfigPath(envConfigPath) {
      await setPathConfig(getConfigFn, saveConfigFn, 'aifabrix-env-config', envConfigPath, 'Env config path is required and must be a string');
    }
  };
}

module.exports = {
  createPathConfigFunctions
};

