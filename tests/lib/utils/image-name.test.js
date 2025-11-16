/**
 * Tests for image name helper
 *
 * @fileoverview Unit tests for lib/utils/image-name.js
 * @version 2.0.0
 */

'use strict';

const { buildDevImageName } = require('../../../lib/utils/image-name');

describe('image-name helper', () => {
  it('should append -dev<id> for numeric developer id', () => {
    expect(buildDevImageName('myapp', 7)).toBe('myapp-dev7');
    expect(buildDevImageName('myapp', '42')).toBe('myapp-dev42');
  });

  it('should use -extra when id is 0', () => {
    expect(buildDevImageName('myapp', 0)).toBe('myapp-extra');
    expect(buildDevImageName('myapp', '0')).toBe('myapp-extra');
  });

  it('should use -extra when id is missing or invalid', () => {
    expect(buildDevImageName('myapp')).toBe('myapp-extra');
    expect(buildDevImageName('myapp', null)).toBe('myapp-extra');
    expect(buildDevImageName('myapp', undefined)).toBe('myapp-extra');
    expect(buildDevImageName('myapp', 'abc')).toBe('myapp-extra');
  });

  it('should throw when base name is invalid', () => {
    expect(() => buildDevImageName()).toThrow('Base image name is required');
    expect(() => buildDevImageName(123)).toThrow('Base image name is required');
  });
});

