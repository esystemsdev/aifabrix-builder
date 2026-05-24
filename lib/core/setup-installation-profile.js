/**
 * Setup installation profile identifiers (`dev` / `pro`).
 *
 * @fileoverview Normalization for setup wizard profile (local install, not login environment)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/** @enum {string} */
const INSTALLATION_PROFILE = Object.freeze({
  DEV: 'dev',
  PRO: 'pro'
});

/**
 * @param {unknown} value
 * @returns {'dev'|'pro'}
 */
function normalizeInstallationProfile(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === INSTALLATION_PROFILE.PRO || raw === 'production') {
    return INSTALLATION_PROFILE.PRO;
  }
  return INSTALLATION_PROFILE.DEV;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isProInstallationProfile(value) {
  return normalizeInstallationProfile(value) === INSTALLATION_PROFILE.PRO;
}

module.exports = {
  INSTALLATION_PROFILE,
  normalizeInstallationProfile,
  isProInstallationProfile
};
