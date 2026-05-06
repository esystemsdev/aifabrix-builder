/**
 * @fileoverview Tests for capability-key normalization
 */

const { normalizeCapabilityKey } = require('../../../lib/datasource/capability/capability-key');

describe('normalizeCapabilityKey', () => {
  it('accepts valid keys', () => {
    expect(normalizeCapabilityKey('create')).toBe('create');
    expect(normalizeCapabilityKey('createBasic')).toBe('createBasic');
    expect(normalizeCapabilityKey('update_address')).toBe('update_address');
  });

  it('trims whitespace', () => {
    expect(normalizeCapabilityKey('  list  ')).toBe('list');
  });

  it('rejects empty input', () => {
    expect(() => normalizeCapabilityKey('', 'Label')).toThrow(/Label key is required/);
    expect(() => normalizeCapabilityKey('   ', 'x')).toThrow(/x key is required/);
  });

  it('rejects invalid patterns', () => {
    expect(() => normalizeCapabilityKey('Create')).toThrow(/invalid/);
    expect(() => normalizeCapabilityKey('9create')).toThrow(/invalid/);
    expect(() => normalizeCapabilityKey('create-basic')).toThrow(/invalid/);
  });
});
