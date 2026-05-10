/**
 * Tests for image name helper
 *
 * @fileoverview Unit tests for lib/utils/image-name.js
 * @version 2.0.0
 */

'use strict';

const { buildDevImageName, buildDevImageRepositoryPath } = require('../../../lib/utils/image-name');

describe('image-name helper', () => {
  it('should append -dev<id> for numeric developer id', () => {
    expect(buildDevImageName('myapp', 7)).toBe('myapp-dev7');
    expect(buildDevImageName('myapp', '42')).toBe('myapp-dev42');
  });

  it('should return base name when id is 0', () => {
    expect(buildDevImageName('myapp', 0)).toBe('myapp');
    expect(buildDevImageName('myapp', '0')).toBe('myapp');
  });

  it('should return base name when id is missing or invalid', () => {
    expect(buildDevImageName('myapp')).toBe('myapp');
    expect(buildDevImageName('myapp', null)).toBe('myapp');
    expect(buildDevImageName('myapp', undefined)).toBe('myapp');
    expect(buildDevImageName('myapp', 'abc')).toBe('myapp');
  });

  it('buildDevImageRepositoryPath suffixes last segment for qualified repos', () => {
    expect(buildDevImageRepositoryPath('registry/ns/myapp', 3)).toBe('registry/ns/myapp-dev3');
    expect(buildDevImageRepositoryPath('registry/ns/myapp', 0)).toBe('registry/ns/myapp');
  });

  it('should throw when base name is invalid', () => {
    expect(() => buildDevImageName()).toThrow('Base image name is required');
    expect(() => buildDevImageName(123)).toThrow('Base image name is required');
  });
});

