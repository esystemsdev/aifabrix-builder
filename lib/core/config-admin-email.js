/**
 * Admin email field in `config.yaml` (Keycloak / pgAdmin), written by `aifabrix setup`.
 *
 * @fileoverview config.yaml adminEmail helpers (keeps config.js under max-lines)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {unknown} email
 * @returns {string} Trimmed valid email
 * @throws {Error} When empty or not a plausible email
 */
function validateAdminEmailForConfig(email) {
  const value = String(email ?? '').trim();
  if (!value) {
    throw new Error('Admin email must be a non-empty string');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error('Admin email must be a valid email address');
  }
  return value;
}

/**
 * @param {() => Promise<Object>} getConfig
 * @returns {Promise<string>}
 */
async function getAdminEmailFromConfig(getConfig) {
  const cfg = await getConfig();
  if (cfg && typeof cfg.adminEmail === 'string' && cfg.adminEmail.trim()) {
    return cfg.adminEmail.trim();
  }
  return '';
}

/**
 * @param {() => Promise<Object>} getConfig
 * @param {(data: Object) => Promise<void>} saveConfig
 * @param {string} email
 * @returns {Promise<void>}
 */
async function setAdminEmailInConfig(getConfig, saveConfig, email) {
  const trimmed = validateAdminEmailForConfig(email);
  const cfg = await getConfig();
  cfg.adminEmail = trimmed;
  await saveConfig(cfg);
}

module.exports = {
  validateAdminEmailForConfig,
  getAdminEmailFromConfig,
  setAdminEmailInConfig
};
