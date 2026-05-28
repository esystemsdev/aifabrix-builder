/**
 * @fileoverview Tests for setup platform mode normalization
 */

'use strict';

const {
  normalizeSetupPlatformMode,
  flagsForSetupPlatformMode
} = require('../../../lib/core/setup-platform-mode');

describe('lib/core/setup-platform-mode', () => {
  it('normalizeSetupPlatformMode defaults to single', () => {
    expect(normalizeSetupPlatformMode(undefined)).toBe('single');
    expect(normalizeSetupPlatformMode(null)).toBe('single');
    expect(normalizeSetupPlatformMode('')).toBe('single');
  });

  it('normalizeSetupPlatformMode accepts full', () => {
    expect(normalizeSetupPlatformMode('full')).toBe('full');
    expect(normalizeSetupPlatformMode(' FULL ')).toBe('full');
  });

  it('flagsForSetupPlatformMode enables traefik+scoped for full', () => {
    expect(flagsForSetupPlatformMode('full')).toEqual({
      traefik: true,
      useEnvironmentScopedResources: true
    });
    expect(flagsForSetupPlatformMode('single')).toEqual({
      traefik: false,
      useEnvironmentScopedResources: false
    });
  });
});

