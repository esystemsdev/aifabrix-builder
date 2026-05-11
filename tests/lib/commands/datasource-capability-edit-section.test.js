/**
 * @fileoverview normalizeCapabilityEditSection (CLI guard for --section)
 */

const {
  normalizeCapabilityEditSection
} = require('../../../lib/commands/datasource-capability');

describe('normalizeCapabilityEditSection', () => {
  it('returns undefined for empty / missing', () => {
    expect(normalizeCapabilityEditSection(undefined)).toBeUndefined();
    expect(normalizeCapabilityEditSection('')).toBeUndefined();
  });

  it('accepts openapi, cip, profile (case-insensitive)', () => {
    expect(normalizeCapabilityEditSection('openapi')).toBe('openapi');
    expect(normalizeCapabilityEditSection('CIP')).toBe('cip');
    expect(normalizeCapabilityEditSection(' Profile ')).toBe('profile');
  });

  it('throws for invalid section', () => {
    expect(() => normalizeCapabilityEditSection('graphql')).toThrow(
      /--section must be openapi, cip, or profile/
    );
  });
});
