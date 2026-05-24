/**
 * Map decrypted admin-secrets.env into platform container env keys.
 *
 * @fileoverview Overlay KEYCLOAK_* / ONBOARDING_* from admin-secrets (plan 185 Phase 2)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {Object.<string, string>} adminObj
 * @returns {Object.<string, string>}
 */
function buildPlatformEnvOverlayFromAdminSecrets(adminObj) {
  if (!adminObj || typeof adminObj !== 'object') return {};
  const platformPwd =
    adminObj.PLATFORM_ADMIN_PASSWORD ||
    adminObj.ONBOARDING_ADMIN_PASSWORD ||
    adminObj.MISO_ADMIN_PASSWORD ||
    '';
  const overlay = {};
  if (adminObj.KEYCLOAK_ADMIN_USERNAME) {
    overlay.KEYCLOAK_ADMIN_USERNAME = adminObj.KEYCLOAK_ADMIN_USERNAME;
  }
  if (adminObj.KEYCLOAK_ADMIN_PASSWORD) {
    overlay.KEYCLOAK_ADMIN_PASSWORD = adminObj.KEYCLOAK_ADMIN_PASSWORD;
    // Keycloak image reads KC_BOOTSTRAP_* on first start; keep in sync with admin-secrets (pro split bundles).
    overlay.KC_BOOTSTRAP_ADMIN_PASSWORD = adminObj.KEYCLOAK_ADMIN_PASSWORD;
    overlay.KC_BOOTSTRAP_ADMIN_USERNAME =
      adminObj.KEYCLOAK_ADMIN_USERNAME || adminObj.KC_BOOTSTRAP_ADMIN_USERNAME || 'admin';
  }
  if (platformPwd) {
    overlay.PLATFORM_ADMIN_PASSWORD = platformPwd;
    overlay.ONBOARDING_ADMIN_PASSWORD = platformPwd;
    overlay.MISO_ADMIN_PASSWORD = platformPwd;
  }
  const email = adminObj.PGADMIN_DEFAULT_EMAIL || adminObj.ONBOARDING_ADMIN_EMAIL;
  if (email) {
    overlay.ONBOARDING_ADMIN_EMAIL = email;
  }
  return overlay;
}

/**
 * Apply admin-secrets values over resolved app env (admin-secrets wins for platform keys).
 * @param {Object.<string, string>} envMap
 * @param {Object.<string, string>} adminObj
 */
function applyAdminSecretsPlatformOverlay(envMap, adminObj) {
  const overlay = buildPlatformEnvOverlayFromAdminSecrets(adminObj);
  for (const [key, value] of Object.entries(overlay)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      envMap[key] = String(value);
    }
  }
}

module.exports = {
  buildPlatformEnvOverlayFromAdminSecrets,
  applyAdminSecretsPlatformOverlay
};
