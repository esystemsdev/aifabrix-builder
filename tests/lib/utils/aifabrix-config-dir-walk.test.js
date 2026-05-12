/**
 * @fileoverview findAifabrixConfigDirFromAncestors
 */

'use strict';

const path = require('path');
const { findAifabrixConfigDirFromAncestors } = require('../../../lib/utils/aifabrix-config-dir-walk');

describe('findAifabrixConfigDirFromAncestors', () => {
  it('returns null when no config exists on the ancestor chain', () => {
    const exists = jest.fn(() => false);
    const start = path.join('/tmp', 'a', 'b', 'c');
    expect(findAifabrixConfigDirFromAncestors(start, exists)).toBeNull();
    expect(exists).toHaveBeenCalled();
  });

  it('returns .aifabrix dir when config exists on an ancestor', () => {
    const cfg = path.join('/tmp', 'walk-root', '.aifabrix', 'config.yaml');
    const exists = jest.fn((p) => path.normalize(p) === path.normalize(cfg));
    const deep = path.join('/tmp', 'walk-root', 'proj', 'sub', 'app');
    expect(findAifabrixConfigDirFromAncestors(deep, exists)).toBe(path.join('/tmp', 'walk-root', '.aifabrix'));
  });

  it('finds config in startDir itself', () => {
    const root = path.join('/tmp', 'walk-one');
    const cfg = path.join(root, '.aifabrix', 'config.yaml');
    const exists = jest.fn((p) => path.normalize(p) === path.normalize(cfg));
    expect(findAifabrixConfigDirFromAncestors(root, exists)).toBe(path.join(root, '.aifabrix'));
  });
});
