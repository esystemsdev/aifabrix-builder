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
const { encryptToken, decryptToken, isTokenEncrypted } = require('../utils/token-encryption');
// Avoid importing paths here to prevent circular dependency.
// Config location (first match wins):
//   1. AIFABRIX_CONFIG env = full path to config.yaml
//   2. AIFABRIX_HOME env = directory containing config.yaml
//   3. ~/.aifabrix
// Set AIFABRIX_HOME=/workspace/.aifabrix or AIFABRIX_CONFIG=/workspace/.aifabrix/config.yaml when config is not in default home.

function getConfigDir() {
  const configFile = process.env.AIFABRIX_CONFIG && typeof process.env.AIFABRIX_CONFIG === 'string';
  if (configFile) {
    return path.dirname(path.resolve(process.env.AIFABRIX_CONFIG.trim()));
  }
  if (process.env.AIFABRIX_HOME && typeof process.env.AIFABRIX_HOME === 'string') {
    return path.resolve(process.env.AIFABRIX_HOME.trim());
  }
  return path.join(os.homedir(), '.aifabrix');
}

// Runtime config directory and file (respect AIFABRIX_HOME)
const RUNTIME_CONFIG_DIR = getConfigDir();
const RUNTIME_CONFIG_FILE = path.join(RUNTIME_CONFIG_DIR, 'config.yaml');

// Legacy exports (same as runtime when module loads)
const CONFIG_DIR = RUNTIME_CONFIG_DIR;
const CONFIG_FILE = RUNTIME_CONFIG_FILE;

// Cache for developer ID - loaded when getConfig() is first called
let cachedDeveloperId = null;

/**
 * Normalize controller URL for consistent storage and lookup
 * Removes trailing slashes and normalizes the URL format
 * @param {string} url - Controller URL to normalize
 * @returns {string} Normalized controller URL
 */
function normalizeControllerUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  // Remove trailing slashes
  let normalized = url.trim().replace(/\/+$/, '');
  // Ensure it starts with http:// or https://
  if (!normalized.match(/^https?:\/\//)) {
    // If it doesn't start with protocol, assume http://
    normalized = `http://${normalized}`;
  }
  return normalized;
}

/**
 * Validate and normalize developer ID
 * @param {*} developerId - Developer ID value (can be string, number, undefined, or null)
 * @returns {string} Normalized developer ID as string
 * @throws {Error} If developer ID is invalid
 */
function validateAndNormalizeDeveloperId(developerId) {
  const DEV_ID_DIGITS_REGEX = /^[0-9]+$/;

  if (typeof developerId === 'undefined' || developerId === null) {
    return '0';
  }

  if (typeof developerId === 'number') {
    if (developerId < 0 || !Number.isFinite(developerId)) {
      throw new Error('Developer ID must be a non-negative digit string or number');
    }
    return String(developerId);
  }

  if (typeof developerId === 'string') {
    if (!DEV_ID_DIGITS_REGEX.test(developerId)) {
      throw new Error('Developer ID must be a non-negative digit string or number');
    }
    return developerId;
  }

  throw new Error('Developer ID must be a non-negative digit string or number');
}

/**
 * Ensure default config values exist
 * @param {Object} config - Configuration object
 * @returns {Object} Config with defaults applied
 */
function applyConfigDefaults(config) {
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
  // Ensure controller field exists (but don't set defaults)
  // It will be set by login or auth config commands
  return config;
}

/**
 * Get default config when file doesn't exist
 * @returns {Object} Default configuration
 */
function getDefaultConfig() {
  cachedDeveloperId = '0';
  return {
    'developer-id': '0',
    environment: 'dev',
    controller: undefined,
    environments: {},
    device: {}
  };
}

async function getConfig() {
  try {
    const configContent = await fs.readFile(RUNTIME_CONFIG_FILE, 'utf8');
    let config = yaml.load(configContent);

    // Handle empty file or null/undefined result from yaml.load
    if (!config || typeof config !== 'object') {
      config = {};
    }

    // Validate and normalize developer ID
    config['developer-id'] = validateAndNormalizeDeveloperId(config['developer-id']);

    // Apply defaults
    config = applyConfigDefaults(config);

    // Cache developer ID as property for easy access (string, default "0")
    cachedDeveloperId = config['developer-id'] !== undefined ? config['developer-id'] : '0';
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return getDefaultConfig();
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

/**
 * Verifies developer ID was saved correctly
 * @async
 * @function verifyDeveloperIdSaved
 * @param {string} devIdString - Developer ID string
 * @throws {Error} If verification fails
 */
async function verifyDeveloperIdSaved(devIdString) {
  await new Promise(resolve => setTimeout(resolve, 100));
  const savedContent = await fs.readFile(RUNTIME_CONFIG_FILE, 'utf8');
  const savedConfig = yaml.load(savedContent);
  const savedDevIdString = String(savedConfig['developer-id']);
  if (savedDevIdString !== devIdString) {
    throw new Error(`Failed to save developer ID: expected ${devIdString}, got ${savedDevIdString}. File content: ${savedContent.substring(0, 200)}`);
  }
}

async function setDeveloperId(developerId) {
  const devIdString = validateAndNormalizeDeveloperId(developerId);

  cachedDeveloperId = null;
  const config = await getConfig();
  config['developer-id'] = devIdString;
  cachedDeveloperId = devIdString;
  await saveConfig(config);
  await verifyDeveloperIdSaved(devIdString);
  cachedDeveloperId = null;
}

async function getCurrentEnvironment() {
  const config = await getConfig();
  return config.environment || 'dev';
}

/**
 * Resolve environment from configuration
 * Uses config.environment, defaults to 'dev'
 * @async
 * @function resolveEnvironment
 * @returns {Promise<string>} Environment key
 */
async function resolveEnvironment() {
  return await getCurrentEnvironment();
}

async function setCurrentEnvironment(environment) {
  if (!environment || typeof environment !== 'string') {
    throw new Error('Environment must be a non-empty string');
  }
  const config = await getConfig();
  config.environment = environment;
  await saveConfig(config);
}

/**
 * Set controller URL in configuration
 * @async
 * @function setControllerUrl
 * @param {string} controllerUrl - Controller URL to save
 * @returns {Promise<void>}
 * @throws {Error} If controller URL is invalid
 */
async function setControllerUrl(controllerUrl) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('Controller URL is required and must be a string');
  }
  const normalizedUrl = normalizeControllerUrl(controllerUrl);
  const config = await getConfig();
  config.controller = normalizedUrl;
  await saveConfig(config);
}

/**
 * Get controller URL from configuration
 * @async
 * @function getControllerUrl
 * @returns {Promise<string|null>} Controller URL or null if not set
 */
async function getControllerUrl() {
  const config = await getConfig();
  return config.controller || null;
}

function isTokenExpired(expiresAt) {
  if (!expiresAt) return true;
  const expirationTime = new Date(expiresAt).getTime();
  const now = Date.now();
  return now >= (expirationTime - 5 * 60 * 1000);
}

function shouldRefreshToken(expiresAt) {
  if (!expiresAt) return true;
  const expirationTime = new Date(expiresAt).getTime();
  const now = Date.now();
  return now >= (expirationTime - 15 * 60 * 1000);
}
async function encryptTokenValue(value) {
  if (!value || typeof value !== 'string') return value;
  try {
    const encryptionKey = await getSecretsEncryptionKey();
    if (!encryptionKey) return value;
    if (isTokenEncrypted(value)) return value;
    const encrypted = encryptToken(value, encryptionKey);
    // Ensure we never return undefined for valid inputs
    return encrypted !== undefined && encrypted !== null ? encrypted : value;
  } catch (error) {
    return value;
  }
}
async function decryptTokenValue(value) {
  if (!value || typeof value !== 'string') return value;
  try {
    const encryptionKey = await getSecretsEncryptionKey();
    if (!encryptionKey) return value;
    if (!isTokenEncrypted(value)) return value;
    const decrypted = decryptToken(value, encryptionKey);
    // Ensure we never return undefined for valid inputs
    if (decrypted !== undefined && decrypted !== null) {
      return decrypted;
    }
    // Encrypted value but decryption produced nothing - do not return encrypted string to callers (e.g. refresh API)
    throw new Error('Could not decrypt stored token. If you changed the secrets-encryption key, run "aifabrix login" again.');
  } catch (error) {
    if (error.message && error.message.includes('Could not decrypt stored token')) {
      throw error;
    }
    // Decryption failed (wrong key, corrupted data, etc.) - do not pass encrypted value to callers
    throw new Error('Could not decrypt stored token. If you changed the secrets-encryption key, run "aifabrix login" again.');
  }
}
// Token management functions moved to lib/utils/config-tokens.js to reduce file size

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
  const { validateEncryptionKey } = require('../utils/secrets-encryption');
  validateEncryptionKey(key);

  const config = await getConfig();
  config['secrets-encryption'] = key;
  await saveConfig(config);
}

/**
 * Ensure secrets encryption key exists (empty install). Delegates to ensure-encryption-key module.
 * @returns {Promise<void>}
 */
async function ensureSecretsEncryptionKey() {
  const { ensureSecretsEncryptionKey: run } = require('./ensure-encryption-key');
  await run({ getSecretsEncryptionKey, setSecretsEncryptionKey, getSecretsPath });
}

/**
 * Expand leading ~ to home directory so config paths like ~/.aifabrix/secrets.local.yaml resolve correctly.
 * @param {string} filePath - Path that may start with ~ or ~/
 * @returns {string} Path with ~ expanded, or unchanged if no leading ~
 */
function expandTilde(filePath) {
  if (!filePath || typeof filePath !== 'string') return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~' + path.sep)) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

async function getSecretsPath() {
  const config = await getConfig();
  const raw = config['aifabrix-secrets'] || config['secrets-path'] || null;
  return raw ? expandTilde(raw) : null;
}

async function setSecretsPath(secretsPath) {
  if (!secretsPath || typeof secretsPath !== 'string') {
    throw new Error('Secrets path is required and must be a string');
  }
  const config = await getConfig();
  config['aifabrix-secrets'] = secretsPath;
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
  resolveEnvironment,
  isTokenExpired,
  shouldRefreshToken,
  encryptTokenValue,
  decryptTokenValue,
  getSecretsEncryptionKey,
  setSecretsEncryptionKey,
  ensureSecretsEncryptionKey,
  getSecretsPath,
  setSecretsPath,
  normalizeControllerUrl,
  setControllerUrl,
  getControllerUrl,
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

// Token management functions - created after dependencies are defined
const { createTokenManagementFunctions } = require('../utils/config-tokens');
const tokenFunctions = createTokenManagementFunctions({
  getConfigFn: getConfig,
  saveConfigFn: saveConfig,
  getSecretsEncryptionKeyFn: getSecretsEncryptionKey,
  encryptTokenValueFn: encryptTokenValue,
  decryptTokenValueFn: decryptTokenValue,
  isTokenEncryptedFn: require('../utils/token-encryption').isTokenEncrypted
});
Object.assign(exportsObj, tokenFunctions);

// Path configuration functions - created after getConfig/saveConfig are defined
const { createPathConfigFunctions } = require('../utils/config-paths');
const pathConfigFunctions = createPathConfigFunctions(getConfig, saveConfig);
Object.assign(exportsObj, pathConfigFunctions);

module.exports = exportsObj;
