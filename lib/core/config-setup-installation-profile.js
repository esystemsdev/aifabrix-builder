/**
 * `setupInstallationProfile` field in `config.yaml` (`dev` | `pro`).
 *
 * @fileoverview Persists setup wizard installation profile
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { normalizeInstallationProfile, INSTALLATION_PROFILE } = require('./setup-installation-profile');

/**
 * @param {() => Promise<Object>} getConfig
 * @returns {Promise<'dev'|'pro'>}
 */
async function getSetupInstallationProfileFromConfig(getConfig) {
  const cfg = await getConfig();
  if (cfg && cfg.setupInstallationProfile) {
    return normalizeInstallationProfile(cfg.setupInstallationProfile);
  }
  return INSTALLATION_PROFILE.DEV;
}

/**
 * @param {() => Promise<Object>} getConfig
 * @param {(data: Object) => Promise<void>} saveConfig
 * @param {unknown} profile
 * @returns {Promise<'dev'|'pro'>}
 */
async function setSetupInstallationProfileInConfig(getConfig, saveConfig, profile) {
  const normalized = normalizeInstallationProfile(profile);
  const cfg = await getConfig();
  cfg.setupInstallationProfile = normalized;
  await saveConfig(cfg);
  return normalized;
}

module.exports = {
  getSetupInstallationProfileFromConfig,
  setSetupInstallationProfileInConfig
};
