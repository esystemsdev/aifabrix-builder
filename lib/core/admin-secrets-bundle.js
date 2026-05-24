/**
 * Map setup password bundles onto admin-secrets.env keys.
 *
 * @fileoverview Single (dev) vs split (pro) admin credential bundles
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const DEFAULT_REDIS_HOST = 'local:redis:6379:0:';
const DEFAULT_REDIS_COMMANDER_USER = 'admin';
const DEFAULT_KEYCLOAK_ADMIN_USERNAME = 'admin';

/**
 * @typedef {'single'|'split'} AdminPasswordBundleMode
 */

/**
 * @typedef {Object} AdminPasswordBundleSingle
 * @property {'single'} mode
 * @property {string} password
 */

/**
 * @typedef {Object} AdminPasswordBundleSplit
 * @property {'split'} mode
 * @property {string} infra
 * @property {string} keycloak
 * @property {string} platform
 */

/**
 * @param {string} password
 * @returns {AdminPasswordBundleSingle}
 */
function singlePasswordBundle(password) {
  return { mode: 'single', password: String(password) };
}

/**
 * @param {{ infra: string, keycloak: string, platform: string }} parts
 * @returns {AdminPasswordBundleSplit}
 */
function splitPasswordBundle(parts) {
  return {
    mode: 'split',
    infra: String(parts.infra),
    keycloak: String(parts.keycloak),
    platform: String(parts.platform)
  };
}

/**
 * Apply bundle onto a decrypted admin-secrets object (mutates copy).
 * @param {Object.<string, string>} adminObj
 * @param {AdminPasswordBundleSingle|AdminPasswordBundleSplit} bundle
 * @returns {Object.<string, string>}
 */
function applyPasswordBundleToAdminObj(adminObj, bundle) {
  const merged = { ...(adminObj || {}) };
  merged.REDIS_HOST = merged.REDIS_HOST || DEFAULT_REDIS_HOST;
  merged.REDIS_COMMANDER_USER = merged.REDIS_COMMANDER_USER || DEFAULT_REDIS_COMMANDER_USER;
  merged.KEYCLOAK_ADMIN_USERNAME = DEFAULT_KEYCLOAK_ADMIN_USERNAME;

  if (bundle.mode === 'single') {
    const p = bundle.password;
    merged.POSTGRES_PASSWORD = p;
    merged.PGADMIN_DEFAULT_PASSWORD = p;
    merged.REDIS_COMMANDER_PASSWORD = p;
    merged.KEYCLOAK_ADMIN_PASSWORD = p;
    merged.PLATFORM_ADMIN_PASSWORD = p;
    return merged;
  }

  merged.POSTGRES_PASSWORD = bundle.infra;
  merged.PGADMIN_DEFAULT_PASSWORD = bundle.infra;
  merged.REDIS_COMMANDER_PASSWORD = bundle.infra;
  merged.KEYCLOAK_ADMIN_PASSWORD = bundle.keycloak;
  merged.PLATFORM_ADMIN_PASSWORD = bundle.platform;
  return merged;
}

/**
 * Build bundle from setup / up-infra CLI options.
 * @param {Object} [options]
 * @returns {AdminPasswordBundleSingle|AdminPasswordBundleSplit|null}
 */
function passwordBundleFromCliOptions(options = {}) {
  if (options.passwordBundle && options.passwordBundle.mode) {
    return options.passwordBundle;
  }
  const infra = String(options.infraAdminPassword || '').trim();
  const keycloak = String(options.keycloakAdminPassword || '').trim();
  const platform = String(options.platformAdminPassword || '').trim();
  if (infra && keycloak && platform) {
    return splitPasswordBundle({ infra, keycloak, platform });
  }
  const single = String(options.adminPassword || options.adminPwd || '').trim();
  if (single) {
    return singlePasswordBundle(single);
  }
  return null;
}

module.exports = {
  singlePasswordBundle,
  splitPasswordBundle,
  applyPasswordBundleToAdminObj,
  passwordBundleFromCliOptions
};
