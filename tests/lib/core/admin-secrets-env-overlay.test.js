/**
 * @fileoverview Tests admin-secrets → platform env overlay (plan 185 Phase 2).
 */

'use strict';

const {
  buildPlatformEnvOverlayFromAdminSecrets,
  applyAdminSecretsPlatformOverlay
} = require('../../../lib/core/admin-secrets-env-overlay');

describe('admin-secrets-env-overlay', () => {
  it('maps split pro keys into platform env overlay', () => {
    const overlay = buildPlatformEnvOverlayFromAdminSecrets({
      KEYCLOAK_ADMIN_USERNAME: 'admin',
      KEYCLOAK_ADMIN_PASSWORD: 'kc-secret',
      PLATFORM_ADMIN_PASSWORD: 'ui-secret',
      PGADMIN_DEFAULT_EMAIL: 'admin@example.com'
    });
    expect(overlay.KEYCLOAK_ADMIN_PASSWORD).toBe('kc-secret');
    expect(overlay.KC_BOOTSTRAP_ADMIN_PASSWORD).toBe('kc-secret');
    expect(overlay.KC_BOOTSTRAP_ADMIN_USERNAME).toBe('admin');
    expect(overlay.ONBOARDING_ADMIN_PASSWORD).toBe('ui-secret');
    expect(overlay.MISO_ADMIN_PASSWORD).toBe('ui-secret');
    expect(overlay.ONBOARDING_ADMIN_EMAIL).toBe('admin@example.com');
  });

  it('overlays admin-secrets on top of app-resolved env (admin wins)', () => {
    const env = {
      KEYCLOAK_ADMIN_PASSWORD: 'from-kv',
      ONBOARDING_ADMIN_PASSWORD: 'from-kv',
      OTHER: 'keep'
    };
    applyAdminSecretsPlatformOverlay(env, {
      KEYCLOAK_ADMIN_PASSWORD: 'from-admin-file',
      PLATFORM_ADMIN_PASSWORD: 'ui-from-file'
    });
    expect(env.KEYCLOAK_ADMIN_PASSWORD).toBe('from-admin-file');
    expect(env.ONBOARDING_ADMIN_PASSWORD).toBe('ui-from-file');
    expect(env.OTHER).toBe('keep');
  });
});
