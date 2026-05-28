/**
 * `setupPlatformMode` field in `config.yaml` (`single` | `full`).
 *
 * @fileoverview Persists setup wizard platform mode
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const {
  normalizeSetupPlatformMode,
  SETUP_PLATFORM_MODE
} = require('./setup-platform-mode');

/**
 * @param {() => Promise<Object>} getConfig
 * @returns {Promise<'single'|'full'>}
 */
async function getSetupPlatformModeFromConfig(getConfig) {
  const cfg = await getConfig();
  if (cfg && cfg.setupPlatformMode) {
    return normalizeSetupPlatformMode(cfg.setupPlatformMode);
  }
  return SETUP_PLATFORM_MODE.SINGLE;
}

/**
 * @param {() => Promise<Object>} getConfig
 * @param {(data: Object) => Promise<void>} saveConfig
 * @param {unknown} mode
 * @returns {Promise<'single'|'full'>}
 */
async function setSetupPlatformModeInConfig(getConfig, saveConfig, mode) {
  const normalized = normalizeSetupPlatformMode(mode);
  const cfg = await getConfig();
  cfg.setupPlatformMode = normalized;
  await saveConfig(cfg);
  return normalized;
}

module.exports = {
  getSetupPlatformModeFromConfig,
  setSetupPlatformModeInConfig
};

