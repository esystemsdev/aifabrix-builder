/**
 * Walk ancestors of `startDir` for `<dir>/.aifabrix/config.yaml`.
 *
 * @fileoverview Config directory discovery from cwd
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');

/**
 * @param {string} startDir
 * @param {(p: string) => boolean} existsSyncFn
 * @returns {string|null} Absolute path to `.aifabrix` directory containing `config.yaml`
 */
function findAifabrixConfigDirFromAncestors(startDir, existsSyncFn) {
  if (!startDir || typeof startDir !== 'string') {
    return null;
  }
  let dir = path.resolve(startDir);
  const maxSteps = 64;
  for (let i = 0; i < maxSteps; i += 1) {
    const candidate = path.join(dir, '.aifabrix', 'config.yaml');
    if (existsSyncFn(candidate)) {
      return path.join(dir, '.aifabrix');
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

module.exports = {
  findAifabrixConfigDirFromAncestors
};
