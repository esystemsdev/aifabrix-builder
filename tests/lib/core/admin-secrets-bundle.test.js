/**
 * @fileoverview Tests for admin password bundle mapping
 */

'use strict';

const {
  singlePasswordBundle,
  splitPasswordBundle,
  applyPasswordBundleToAdminObj,
  passwordBundleFromCliOptions
} = require('../../../lib/core/admin-secrets-bundle');

describe('lib/core/admin-secrets-bundle', () => {
  it('applyPasswordBundleToAdminObj sets all keys for single mode', () => {
    const merged = applyPasswordBundleToAdminObj({}, singlePasswordBundle('one-pass'));
    expect(merged.POSTGRES_PASSWORD).toBe('one-pass');
    expect(merged.KEYCLOAK_ADMIN_PASSWORD).toBe('one-pass');
    expect(merged.PLATFORM_ADMIN_PASSWORD).toBe('one-pass');
    expect(merged.KEYCLOAK_ADMIN_USERNAME).toBe('admin');
  });

  it('applyPasswordBundleToAdminObj maps split roles', () => {
    const merged = applyPasswordBundleToAdminObj(
      {},
      splitPasswordBundle({ infra: 'i', keycloak: 'k', platform: 'p' })
    );
    expect(merged.POSTGRES_PASSWORD).toBe('i');
    expect(merged.KEYCLOAK_ADMIN_PASSWORD).toBe('k');
    expect(merged.PLATFORM_ADMIN_PASSWORD).toBe('p');
  });

  it('passwordBundleFromCliOptions prefers explicit bundle', () => {
    const bundle = singlePasswordBundle('x');
    expect(passwordBundleFromCliOptions({ passwordBundle: bundle })).toEqual(bundle);
  });

  it('passwordBundleFromCliOptions builds split from role flags', () => {
    const bundle = passwordBundleFromCliOptions({
      infraAdminPassword: 'i',
      keycloakAdminPassword: 'k',
      platformAdminPassword: 'p'
    });
    expect(bundle.mode).toBe('split');
    expect(bundle.infra).toBe('i');
  });
});
