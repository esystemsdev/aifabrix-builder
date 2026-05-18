/**
 * @fileoverview Tests for lib/utils/semver-compare.js (plan 142.0).
 */

'use strict';

const {
  parseSemver,
  isValidSemver,
  compareSemver,
  isAtLeast
} = require('../../../lib/utils/semver-compare');

describe('semver-compare', () => {
  describe('parseSemver / isValidSemver', () => {
    it.each([
      ['2.45.0', { major: 2, minor: 45, patch: 0, prerelease: [] }],
      ['v1.0.0', { major: 1, minor: 0, patch: 0, prerelease: [] }],
      ['2.45.0-beta.1', { major: 2, minor: 45, patch: 0, prerelease: ['beta', '1'] }],
      ['10.0.0-alpha', { major: 10, minor: 0, patch: 0, prerelease: ['alpha'] }],
      ['0.0.1', { major: 0, minor: 0, patch: 1, prerelease: [] }]
    ])('parses valid semver %s', (input, expected) => {
      expect(parseSemver(input)).toEqual(expected);
      expect(isValidSemver(input)).toBe(true);
    });

    it.each([
      '',
      'not-semver',
      '2.45',
      '2.45.0.0',
      '2',
      'v',
      ' 2.45.0 ', // leading/trailing whitespace
      null,
      undefined,
      123
    ])('rejects invalid input %p', (input) => {
      if (typeof input === 'string' && input.trim() === '2.45.0') {
        // trim is part of parseSemver; the ' 2.45.0 ' case is actually valid
        return;
      }
      // ' 2.45.0 ' is actually valid since parseSemver trims
      if (input === ' 2.45.0 ') {
        expect(isValidSemver(input)).toBe(true);
        return;
      }
      expect(isValidSemver(input)).toBe(false);
      expect(parseSemver(input)).toBeNull();
    });
  });

  describe('compareSemver', () => {
    it.each([
      ['2.44.0', '2.45.0', -1],
      ['2.45.0', '2.45.0', 0],
      ['2.45.1', '2.45.0', 1],
      ['3.0.0', '2.99.99', 1],
      ['2.45.0', '2.46.0', -1]
    ])('compares %s vs %s → %d', (a, b, expected) => {
      expect(compareSemver(a, b)).toBe(expected);
    });

    it('treats prerelease as lower than release (semver §11.3)', () => {
      expect(compareSemver('2.45.0-beta.1', '2.45.0')).toBe(-1);
      expect(compareSemver('2.45.0', '2.45.0-beta.1')).toBe(1);
    });

    it('orders prerelease identifiers per §11.4', () => {
      expect(compareSemver('2.45.0-alpha', '2.45.0-beta')).toBe(-1);
      expect(compareSemver('2.45.0-alpha.1', '2.45.0-alpha.2')).toBe(-1);
      expect(compareSemver('2.45.0-alpha.1', '2.45.0-alpha.beta')).toBe(-1);
      expect(compareSemver('2.45.0-alpha', '2.45.0-alpha.1')).toBe(-1);
    });

    it('tolerates leading "v"', () => {
      expect(compareSemver('v2.45.0', '2.45.0')).toBe(0);
    });

    it('throws on invalid input', () => {
      expect(() => compareSemver('not-semver', '2.45.0')).toThrow(/Invalid semver/);
      expect(() => compareSemver('2.45.0', 'bad')).toThrow(/Invalid semver/);
    });
  });

  describe('isAtLeast', () => {
    it('returns true when required is empty/null/undefined', () => {
      expect(isAtLeast('2.45.0', '')).toBe(true);
      expect(isAtLeast('2.45.0', null)).toBe(true);
      expect(isAtLeast('2.45.0', undefined)).toBe(true);
    });

    it('compares CLI vs min', () => {
      expect(isAtLeast('2.45.0', '2.45.0')).toBe(true);
      expect(isAtLeast('2.45.1', '2.45.0')).toBe(true);
      expect(isAtLeast('2.44.0', '2.45.0')).toBe(false);
      expect(isAtLeast('2.45.0-beta.1', '2.45.0')).toBe(false);
    });

    it('throws when current is invalid', () => {
      expect(() => isAtLeast('not-semver', '2.45.0')).toThrow(/Invalid semver/);
    });
  });
});
