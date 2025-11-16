/**
 * AI Fabrix Builder Configuration Management
 * Manages stored authentication configuration for CLI
 * Stores controller URL and auth tokens securely
 *
 * @fileoverview Configuration storage for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const os = require('os');
// Avoid importing paths here to prevent circular dependency.
// Config location is always under OS home at ~/.aifabrix/config.yaml

// Default (for tests and constants): always reflects OS home
const CONFIG_DIR = path.join(os.homedir(), '.aifabrix');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

// Runtime config directory (always under OS home)
const RUNTIME_CONFIG_DIR = path.join(os.homedir(), '.aifabrix');
const RUNTIME_CONFIG_FILE = path.join(RUNTIME_CONFIG_DIR, 'config.yaml');

// Cache for developer ID - loaded when getConfig() is first called
let cachedDeveloperId = null;

/**
 * Get stored configuration
 * Loads developer ID and caches it as a property for easy access
 * @returns {Promise<Object>} Configuration object with new structure
 */
async function getConfig() {
  try {
    const configContent = await fs.readFile(RUNTIME_CONFIG_FILE, 'utf8');
    let config = yaml.load(configContent);

    // Handle empty file or null/undefined result from yaml.load
    if (!config || typeof config !== 'object') {
      config = {};
    }

    // Ensure developer-id exists as a digit-only string (default "0") and validate
    const DEV_ID_DIGITS_REGEX = /^[0-9]+$/;
    if (typeof config['developer-id'] === 'undefined' || config['developer-id'] === null) {
      config['developer-id'] = '0';
    } else if (typeof config['developer-id'] === 'number') {
      // Convert numeric to string to preserve type consistency
      if (config['developer-id'] < 0 || !Number.isFinite(config['developer-id'])) {
        throw new Error(`Invalid developer-id value: "${config['developer-id']}". Must be a non-negative digit string.`);
      }
      config['developer-id'] = String(config['developer-id']);
    } else if (typeof config['developer-id'] === 'string') {
      if (!DEV_ID_DIGITS_REGEX.test(config['developer-id'])) {
        throw new Error(`Invalid developer-id value: "${config['developer-id']}". Must contain only digits 0-9.`);
      }
    } else {
      throw new Error(`Invalid developer-id value type: ${typeof config['developer-id']}. Must be a non-negative digit string.`);
    }

    // Ensure environment defaults to 'dev' if not set
    if (typeof config.environment === 'undefined') {
      config.environment = 'dev';
    }
    // Ensure environments object exists
    if (typeof config.environments !== 'object' || config.environments === null) {
      config.environments = {};
    }
    // Ensure device object exists at root level
    if (typeof config.device !== 'object' || config.device === null) {
      config.device = {};
    }
    // Cache developer ID as property for easy access (string, default "0")
    cachedDeveloperId = config['developer-id'] !== undefined ? config['developer-id'] : '0';
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Default developer ID is "0", default environment is 'dev'
      cachedDeveloperId = '0';
      return {
        'developer-id': '0',
        environment: 'dev',
        environments: {},
        device: {}
      };
    }
    throw new Error(`Failed to read config: ${error.message}`);
  }
}

/**
 * Save configuration
 * @param {Object} data - Configuration data with apiUrl and token
 * @returns {Promise<void>}
 */
async function saveConfig(data) {
  try {
    // Create directory if it doesn't exist
    await fs.mkdir(RUNTIME_CONFIG_DIR, { recursive: true });

    // Set secure permissions
    // Force quotes to ensure numeric-like strings (e.g., "01") remain strings in YAML
    const configContent = yaml.dump(data, { forceQuotes: true });
    // Write file first
    await fs.writeFile(RUNTIME_CONFIG_FILE, configContent, {
      mode: 0o600,
      flag: 'w'
    });
    // Open file descriptor and fsync to ensure write is flushed to disk
    // This is critical on Windows where file writes may be cached
    const fd = await fs.open(RUNTIME_CONFIG_FILE, 'r+');
    try {
      await fd.sync();
    } finally {
      await fd.close();
    }
  } catch (error) {
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

/**
 * Clear stored configuration
 * @returns {Promise<void>}
 */
async function clearConfig() {
  try {
    await fs.unlink(RUNTIME_CONFIG_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Failed to clear config: ${error.message}`);
    }
  }
}

/**
 * Get developer ID from configuration
 * Loads config if not already cached, then returns cached developer ID
 * Developer ID: 0 = default infra, > 0 = developer-specific
 * @returns {Promise<string>} Developer ID as string (defaults to "0")
 */
async function getDeveloperId() {
  // Always reload from file to ensure we have the latest value
  // This ensures the cache matches what's actually in the file
  // Clear cache first to force a fresh read
  cachedDeveloperId = null;
  await getConfig();
  return cachedDeveloperId;
}

/**
 * Set developer ID in configuration
 * @param {number|string} developerId - Developer ID to set (digit-only string preserved, or number). "0" = default infra, > "0" = developer-specific
 * @returns {Promise<void>}
 */
async function setDeveloperId(developerId) {
  const DEV_ID_DIGITS_REGEX = /^[0-9]+$/;
  let devIdString;
  if (typeof developerId === 'number') {
    if (!Number.isFinite(developerId) || developerId < 0) {
      throw new Error('Developer ID must be a non-negative digit string or number (0 = default infra, > 0 = developer-specific)');
    }
    devIdString = String(developerId);
  } else if (typeof developerId === 'string') {
    if (!DEV_ID_DIGITS_REGEX.test(developerId)) {
      throw new Error('Developer ID must be a non-negative digit string or number (0 = default infra, > 0 = developer-specific)');
    }
    devIdString = developerId;
  } else {
    throw new Error('Developer ID must be a non-negative digit string or number (0 = default infra, > 0 = developer-specific)');
  }
  // Clear cache first to ensure we get fresh data from file
  cachedDeveloperId = null;
  // Read file directly to avoid any caching issues
  const config = await getConfig();
  // Update developer ID
  config['developer-id'] = devIdString;
  // Update cache before saving
  cachedDeveloperId = devIdString;
  // Save the entire config object to ensure all fields are preserved
  await saveConfig(config);
  // Verify the file was saved correctly by reading it back
  // This ensures the file system has written the data
  // Add a small delay to ensure file system has flushed the write
  await new Promise(resolve => setTimeout(resolve, 100));
  // Read file again with fresh file handle to avoid OS caching
  const savedContent = await fs.readFile(RUNTIME_CONFIG_FILE, 'utf8');
  const savedConfig = yaml.load(savedContent);
  // YAML may parse numbers as numbers, so convert to string for comparison
  const savedDevIdString = String(savedConfig['developer-id']);
  if (savedDevIdString !== devIdString) {
    throw new Error(`Failed to save developer ID: expected ${devIdString}, got ${savedDevIdString}. File content: ${savedContent.substring(0, 200)}`);
  }
  // Clear the cache to force reload from file on next getDeveloperId() call
  // This ensures we get the value that was actually saved to disk
  cachedDeveloperId = null;
}

/**
 * Get current environment from root-level config
 * @returns {Promise<string>} Current environment (defaults to 'dev')
 */
async function getCurrentEnvironment() {
  const config = await getConfig();
  return config.environment || 'dev';
}

/**
 * Set current environment in root-level config
 * @param {string} environment - Environment to set (e.g., 'miso', 'dev', 'tst', 'pro')
 * @returns {Promise<void>}
 */
async function setCurrentEnvironment(environment) {
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment must be a non-empty string');
  }
  const config = await getConfig();
  config.environment = environment;
  await saveConfig(config);
}

/**
 * Check if token is expired
 * @param {string} expiresAt - ISO timestamp string
 * @returns {boolean} True if token is expired
 */
function isTokenExpired(expiresAt) {
  if (!expiresAt) {
    return true;
  }
  const expirationTime = new Date(expiresAt).getTime();
  const now = Date.now();
  // Add 5 minute buffer to refresh before actual expiration
  return now >= (expirationTime - 5 * 60 * 1000);
}

/**
 * Get device token for controller
 * @param {string} controllerUrl - Controller URL
 * @returns {Promise<{controller: string, token: string, refreshToken: string, expiresAt: string}|null>} Device token info or null
 */
async function getDeviceToken(controllerUrl) {
  const config = await getConfig();
  if (!config.device || !config.device[controllerUrl]) {
    return null;
  }
  const deviceToken = config.device[controllerUrl];
  return {
    controller: controllerUrl,
    token: deviceToken.token,
    refreshToken: deviceToken.refreshToken,
    expiresAt: deviceToken.expiresAt
  };
}

/**
 * Get client token for environment and app
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @returns {Promise<{controller: string, token: string, expiresAt: string}|null>} Client token info or null
 */
async function getClientToken(environment, appName) {
  const config = await getConfig();
  if (!config.environments || !config.environments[environment]) {
    return null;
  }
  if (!config.environments[environment].clients || !config.environments[environment].clients[appName]) {
    return null;
  }
  return config.environments[environment].clients[appName];
}

/**
 * Save device token for controller (root level)
 * @param {string} controllerUrl - Controller URL (used as key)
 * @param {string} token - Device access token
 * @param {string} refreshToken - Refresh token for token renewal
 * @param {string} expiresAt - ISO timestamp string
 * @returns {Promise<void>}
 */
async function saveDeviceToken(controllerUrl, token, refreshToken, expiresAt) {
  const config = await getConfig();
  if (!config.device) {
    config.device = {};
  }
  config.device[controllerUrl] = {
    token: token,
    refreshToken: refreshToken,
    expiresAt: expiresAt
  };
  await saveConfig(config);
}

/**
 * Save client token for environment and app
 * @param {string} environment - Environment key
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @param {string} token - Client token
 * @param {string} expiresAt - ISO timestamp string
 * @returns {Promise<void>}
 */
async function saveClientToken(environment, appName, controllerUrl, token, expiresAt) {
  const config = await getConfig();
  if (!config.environments) {
    config.environments = {};
  }
  if (!config.environments[environment]) {
    config.environments[environment] = { clients: {} };
  }
  if (!config.environments[environment].clients) {
    config.environments[environment].clients = {};
  }
  config.environments[environment].clients[appName] = {
    controller: controllerUrl,
    token: token,
    expiresAt: expiresAt
  };
  await saveConfig(config);
}

/**
 * Initialize and load developer ID
 * Call this to ensure developerId is loaded and cached
 * @returns {Promise<string>} Developer ID (string)
 */
async function loadDeveloperId() {
  if (cachedDeveloperId === null) {
    await getConfig();
  }
  return cachedDeveloperId;
}

/**
 * Get secrets encryption key from configuration
 * @returns {Promise<string|null>} Encryption key or null if not set
 */
async function getSecretsEncryptionKey() {
  const config = await getConfig();
  return config['secrets-encryption'] || null;
}

/**
 * Set secrets encryption key in configuration
 * @param {string} key - Encryption key (32 bytes, hex or base64)
 * @returns {Promise<void>}
 * @throws {Error} If key format is invalid
 */
async function setSecretsEncryptionKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Encryption key is required and must be a string');
  }

  // Validate key format using encryption utilities
  const { validateEncryptionKey } = require('./utils/secrets-encryption');
  validateEncryptionKey(key);

  const config = await getConfig();
  config['secrets-encryption'] = key;
  await saveConfig(config);
}

/**
 * Get general secrets path from configuration
 * Returns aifabrix-secrets path from config.yaml if configured
 * @returns {Promise<string|null>} Secrets path or null if not set
 */
async function getSecretsPath() {
  const config = await getConfig();
  // Backward compatibility: prefer new key, fallback to legacy
  return config['aifabrix-secrets'] || config['secrets-path'] || null;
}

/**
 * Set general secrets path in configuration
 * @param {string} secretsPath - Path to general secrets file
 * @returns {Promise<void>}
 */
async function setSecretsPath(secretsPath) {
  if (!secretsPath || typeof secretsPath !== 'string') {
    throw new Error('Secrets path is required and must be a string');
  }

  const config = await getConfig();
  // Store under new canonical key
  config['aifabrix-secrets'] = secretsPath;
  await saveConfig(config);
}

/**
 * Get aifabrix-home override from configuration
 * @returns {Promise<string|null>} Home override path or null if not set
 */
async function getAifabrixHomeOverride() {
  const config = await getConfig();
  return config['aifabrix-home'] || null;
}

/**
 * Set aifabrix-home override in configuration
 * @param {string} homePath - Base directory path for AI Fabrix files
 * @returns {Promise<void>}
 */
async function setAifabrixHomeOverride(homePath) {
  if (!homePath || typeof homePath !== 'string') {
    throw new Error('Home path is required and must be a string');
  }
  const config = await getConfig();
  config['aifabrix-home'] = homePath;
  await saveConfig(config);
}

/**
 * Get aifabrix-secrets path from configuration (canonical)
 * @returns {Promise<string|null>} Secrets path or null if not set
 */
async function getAifabrixSecretsPath() {
  const config = await getConfig();
  return config['aifabrix-secrets'] || null;
}

/**
 * Set aifabrix-secrets path in configuration (canonical)
 * @param {string} secretsPath - Path to default secrets file
 * @returns {Promise<void>}
 */
async function setAifabrixSecretsPath(secretsPath) {
  if (!secretsPath || typeof secretsPath !== 'string') {
    throw new Error('Secrets path is required and must be a string');
  }
  const config = await getConfig();
  config['aifabrix-secrets'] = secretsPath;
  await saveConfig(config);
}

/**
 * Get aifabrix-env-config path from configuration
 * @returns {Promise<string|null>} Env config path or null if not set
 */
async function getAifabrixEnvConfigPath() {
  const config = await getConfig();
  return config['aifabrix-env-config'] || null;
}

/**
 * Set aifabrix-env-config path in configuration
 * @param {string} envConfigPath - Path to user env-config file
 * @returns {Promise<void>}
 */
async function setAifabrixEnvConfigPath(envConfigPath) {
  if (!envConfigPath || typeof envConfigPath !== 'string') {
    throw new Error('Env config path is required and must be a string');
  }
  const config = await getConfig();
  config['aifabrix-env-config'] = envConfigPath;
  await saveConfig(config);
}

// Create exports object
const exportsObj = {
  getConfig,
  saveConfig,
  clearConfig,
  getDeveloperId,
  setDeveloperId,
  loadDeveloperId,
  getCurrentEnvironment,
  setCurrentEnvironment,
  isTokenExpired,
  getDeviceToken,
  getClientToken,
  saveDeviceToken,
  saveClientToken,
  getSecretsEncryptionKey,
  setSecretsEncryptionKey,
  getSecretsPath,
  setSecretsPath,
  getAifabrixHomeOverride,
  setAifabrixHomeOverride,
  getAifabrixSecretsPath,
  setAifabrixSecretsPath,
  getAifabrixEnvConfigPath,
  setAifabrixEnvConfigPath,
  CONFIG_DIR,
  CONFIG_FILE
};

// Add developerId as a property getter for direct access
// After getConfig() or getDeveloperId() is called, config.developerId will be available
// Developer ID: 0 = default infra, > 0 = developer-specific
Object.defineProperty(exportsObj, 'developerId', {
  get() {
    return cachedDeveloperId !== null ? cachedDeveloperId : '0'; // Default to "0" if not loaded yet
  },
  enumerable: true,
  configurable: true
});
module.exports = exportsObj;
