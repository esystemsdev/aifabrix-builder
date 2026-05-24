/**
 * @fileoverview Tests for setup installation profile normalization
 */

'use strict';

const {
  INSTALLATION_PROFILE,
  normalizeInstallationProfile,
  isProInstallationProfile
} = require('../../../lib/core/setup-installation-profile');

describe('lib/core/setup-installation-profile', () => {
  it('normalizes dev aliases to dev', () => {
    expect(normalizeInstallationProfile('dev')).toBe(INSTALLATION_PROFILE.DEV);
    expect(normalizeInstallationProfile('development')).toBe(INSTALLATION_PROFILE.DEV);
    expect(normalizeInstallationProfile('')).toBe(INSTALLATION_PROFILE.DEV);
  });

  it('normalizes pro and production to pro', () => {
    expect(normalizeInstallationProfile('pro')).toBe(INSTALLATION_PROFILE.PRO);
    expect(normalizeInstallationProfile('production')).toBe(INSTALLATION_PROFILE.PRO);
    expect(isProInstallationProfile('pro')).toBe(true);
    expect(isProInstallationProfile('dev')).toBe(false);
  });
});
