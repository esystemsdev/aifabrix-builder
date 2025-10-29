/**
 * AI Fabrix Builder Configuration Management
 *
 * Manages stored authentication configuration for CLI
 * Stores controller URL and auth tokens securely
 *
 * @fileoverview Configuration storage for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const CONFIG_DIR = path.join(os.homedir(), '.aifabrix');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

/**
 * Get stored configuration
 * @returns {Promise<Object>} Configuration object with apiUrl and token
 */
async function getConfig() {
  try {
    const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
    return yaml.load(configContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { apiUrl: null, token: null };
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
    await fs.mkdir(CONFIG_DIR, { recursive: true });

    // Set secure permissions
    const configContent = yaml.dump(data);
    await fs.writeFile(CONFIG_FILE, configContent, {
      mode: 0o600,
      flag: 'w'
    });
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
    await fs.unlink(CONFIG_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Failed to clear config: ${error.message}`);
    }
  }
}

module.exports = {
  getConfig,
  saveConfig,
  clearConfig,
  CONFIG_DIR,
  CONFIG_FILE
};

