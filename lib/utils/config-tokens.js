/**
 * AI Fabrix Builder - Configuration Token Management
 *
 * Token management functions for device and client tokens in config.yaml
 *
 * @fileoverview Token management utilities for config
 * @author AI Fabrix Team
 * @version 2.0.0
 */

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
 * Create token management functions with config access
 * @param {Function} getConfigFn - Function to get config
 * @param {Function} saveConfigFn - Function to save config
 * @param {Function} getSecretsEncryptionKeyFn - Function to get encryption key
 * @param {Function} encryptTokenValueFn - Function to encrypt token
 * @param {Function} decryptTokenValueFn - Function to decrypt token
 * @param {Function} isTokenEncryptedFn - Function to check if token is encrypted
 * @returns {Object} Token management functions
 */
function createTokenManagementFunctions(
  getConfigFn,
  saveConfigFn,
  getSecretsEncryptionKeyFn,
  encryptTokenValueFn,
  decryptTokenValueFn,
  isTokenEncryptedFn
) {
  /**
   * Extract device token information with encryption/decryption handling
   * @param {Object} deviceToken - Device token object from config
   * @param {string} controllerUrl - Controller URL
   * @returns {Promise<{controller: string, token: string, refreshToken: string, expiresAt: string}>} Device token info
   */
  async function extractDeviceTokenInfo(deviceToken, controllerUrl) {
    // Migration: If tokens are plain text and encryption key exists, encrypt them first
    const encryptionKey = await getSecretsEncryptionKeyFn();
    if (encryptionKey) {
      let needsSave = false;

      if (deviceToken.token && !isTokenEncryptedFn(deviceToken.token)) {
        // Token is plain text, encrypt it
        deviceToken.token = await encryptTokenValueFn(deviceToken.token);
        needsSave = true;
      }

      if (deviceToken.refreshToken && !isTokenEncryptedFn(deviceToken.refreshToken)) {
        // Refresh token is plain text, encrypt it
        deviceToken.refreshToken = await encryptTokenValueFn(deviceToken.refreshToken);
        needsSave = true;
      }

      if (needsSave) {
        // Save encrypted tokens back to config
        const config = await getConfigFn();
        await saveConfigFn(config);
      }
    }
    // Decrypt tokens if encrypted (for return value)
    const token = deviceToken.token ? await decryptTokenValueFn(deviceToken.token) : undefined;
    const refreshToken = deviceToken.refreshToken ? await decryptTokenValueFn(deviceToken.refreshToken) : null;

    return {
      controller: controllerUrl,
      token: token,
      refreshToken: refreshToken,
      expiresAt: deviceToken.expiresAt
    };
  }

  /**
   * Get device token for controller
   * @param {string} controllerUrl - Controller URL
   * @returns {Promise<{controller: string, token: string, refreshToken: string, expiresAt: string}|null>} Device token info or null
   */
  async function getDeviceToken(controllerUrl) {
    const config = await getConfigFn();
    if (!controllerUrl) return null;

    // Normalize URL for consistent lookup
    const normalizedUrl = normalizeControllerUrl(controllerUrl);

    // Try exact match first
    if (config.device && config.device[normalizedUrl]) {
      const deviceToken = config.device[normalizedUrl];
      return extractDeviceTokenInfo(deviceToken, normalizedUrl);
    }

    // Try to find matching URL by normalizing all stored URLs
    if (config.device) {
      for (const storedUrl of Object.keys(config.device)) {
        if (normalizeControllerUrl(storedUrl) === normalizedUrl) {
          const deviceToken = config.device[storedUrl];
          // Migrate to normalized URL if different
          if (storedUrl !== normalizedUrl) {
            config.device[normalizedUrl] = deviceToken;
            delete config.device[storedUrl];
            await saveConfigFn(config);
          }
          return extractDeviceTokenInfo(deviceToken, normalizedUrl);
        }
      }
    }

    return null;
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
    const config = await getConfigFn();
    if (!config.device) config.device = {};

    // Normalize URL for consistent storage
    const normalizedUrl = normalizeControllerUrl(controllerUrl);

    // If there's an existing entry with a different URL format, remove it
    if (config.device) {
      for (const storedUrl of Object.keys(config.device)) {
        if (normalizeControllerUrl(storedUrl) === normalizedUrl && storedUrl !== normalizedUrl) {
          delete config.device[storedUrl];
        }
      }
    }

    // Encrypt tokens before saving
    const encryptedToken = await encryptTokenValueFn(token);
    const encryptedRefreshToken = refreshToken ? await encryptTokenValueFn(refreshToken) : null;

    config.device[normalizedUrl] = {
      token: encryptedToken,
      refreshToken: encryptedRefreshToken,
      expiresAt
    };
    await saveConfigFn(config);
  }

  /**
   * Get client token for environment and app
   * @param {string} environment - Environment key
   * @param {string} appName - Application name
   * @returns {Promise<{controller: string, token: string, expiresAt: string}|null>} Client token info or null
   */
  async function getClientToken(environment, appName) {
    const config = await getConfigFn();
    if (!config.environments || !config.environments[environment]) return null;
    if (!config.environments[environment].clients || !config.environments[environment].clients[appName]) return null;

    const clientToken = config.environments[environment].clients[appName];

    // Migration: If token is plain text and encryption key exists, encrypt it first
    const encryptionKey = await getSecretsEncryptionKeyFn();
    if (encryptionKey && clientToken.token && !isTokenEncryptedFn(clientToken.token)) {
      // Token is plain text, encrypt it
      clientToken.token = await encryptTokenValueFn(clientToken.token);
      // Save encrypted token back to config
      await saveConfigFn(config);
    }

    // Decrypt token if encrypted (for return value)
    const token = await decryptTokenValueFn(clientToken.token);

    return {
      controller: clientToken.controller,
      token: token,
      expiresAt: clientToken.expiresAt
    };
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
    const config = await getConfigFn();
    if (!config.environments) config.environments = {};
    if (!config.environments[environment]) config.environments[environment] = { clients: {} };
    if (!config.environments[environment].clients) config.environments[environment].clients = {};

    // Encrypt token before saving
    const encryptedToken = await encryptTokenValueFn(token);

    config.environments[environment].clients[appName] = {
      controller: controllerUrl,
      token: encryptedToken,
      expiresAt
    };
    await saveConfigFn(config);
  }

  /**
   * Clear device token for specific controller
   * @param {string} controllerUrl - Controller URL
   * @returns {Promise<boolean>} True if token was cleared, false if it didn't exist
   */
  async function clearDeviceToken(controllerUrl) {
    const config = await getConfigFn();
    if (!config.device || !controllerUrl) return false;

    const normalizedUrl = normalizeControllerUrl(controllerUrl);
    let cleared = false;

    // Try exact match first
    if (config.device[normalizedUrl]) {
      delete config.device[normalizedUrl];
      cleared = true;
    } else {
      // Try to find matching URL by normalizing all stored URLs
      for (const storedUrl of Object.keys(config.device)) {
        if (normalizeControllerUrl(storedUrl) === normalizedUrl) {
          delete config.device[storedUrl];
          cleared = true;
          break;
        }
      }
    }

    if (cleared) {
      await saveConfigFn(config);
    }

    return cleared;
  }

  /**
   * Clear all device tokens
   * @returns {Promise<number>} Number of tokens cleared
   */
  async function clearAllDeviceTokens() {
    const config = await getConfigFn();
    if (!config.device) return 0;

    const count = Object.keys(config.device).length;
    if (count > 0) {
      config.device = {};
      await saveConfigFn(config);
    }

    return count;
  }

  /**
   * Clear client token for specific environment and app
   * @param {string} environment - Environment key
   * @param {string} appName - Application name
   * @returns {Promise<boolean>} True if token was cleared, false if it didn't exist
   */
  async function clearClientToken(environment, appName) {
    const config = await getConfigFn();
    if (!config.environments || !config.environments[environment]) return false;
    if (!config.environments[environment].clients || !config.environments[environment].clients[appName]) return false;

    delete config.environments[environment].clients[appName];

    // Clean up empty clients object if no clients remain
    if (Object.keys(config.environments[environment].clients).length === 0) {
      delete config.environments[environment].clients;
    }

    // Clean up empty environment object if no clients remain
    if (Object.keys(config.environments[environment]).length === 0) {
      delete config.environments[environment];
    }

    await saveConfigFn(config);
    return true;
  }

  /**
   * Clear all client tokens for a specific environment
   * @param {string} environment - Environment key
   * @returns {Promise<number>} Number of tokens cleared
   */
  async function clearClientTokensForEnvironment(environment) {
    const config = await getConfigFn();
    if (!config.environments || !config.environments[environment]) return 0;
    if (!config.environments[environment].clients) return 0;

    const count = Object.keys(config.environments[environment].clients).length;
    if (count > 0) {
      delete config.environments[environment].clients;
      // Clean up empty environment object if no other properties remain
      if (Object.keys(config.environments[environment]).length === 0) {
        delete config.environments[environment];
      }
      await saveConfigFn(config);
    }

    return count;
  }

  /**
   * Clear all client tokens across all environments
   * @returns {Promise<number>} Number of tokens cleared
   */
  async function clearAllClientTokens() {
    const config = await getConfigFn();
    if (!config.environments) return 0;

    let totalCount = 0;
    const environmentsToRemove = [];

    for (const env of Object.keys(config.environments)) {
      if (config.environments[env].clients) {
        const count = Object.keys(config.environments[env].clients).length;
        totalCount += count;
        delete config.environments[env].clients;
        // Mark environment for removal if no other properties remain
        if (Object.keys(config.environments[env]).length === 0) {
          environmentsToRemove.push(env);
        }
      }
    }

    // Remove empty environments
    environmentsToRemove.forEach(env => {
      delete config.environments[env];
    });

    if (totalCount > 0) {
      await saveConfigFn(config);
    }

    return totalCount;
  }

  return {
    getDeviceToken,
    getClientToken,
    saveDeviceToken,
    saveClientToken,
    clearDeviceToken,
    clearAllDeviceTokens,
    clearClientToken,
    clearClientTokensForEnvironment,
    clearAllClientTokens
  };
}

module.exports = {
  createTokenManagementFunctions
};

