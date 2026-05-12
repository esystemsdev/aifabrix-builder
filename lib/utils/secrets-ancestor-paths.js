/**
 * Collect `secrets.local.yaml` paths along the cwd → root walk so parent workspace
 * secrets (e.g. `/workspace/.aifabrix/`) merge when the active config is nested
 * (e.g. `repo/.aifabrix/` from cwd).
 *
 * @fileoverview Ancestor secrets.local.yaml discovery for loadSecrets cascade
 */

'use strict';

const path = require('path');

const MAX_ANCESTOR_STEPS = 64;

/**
 * @param {string} startDir - Directory to start from (typically process.cwd())
 * @param {(p: string) => boolean} existsSyncFn - Sync existence check
 * @returns {string[]} Absolute paths, nearest ancestor first (cwd-side), then parents
 */
function collectAncestorAifabrixSecretsLocalYamlPaths(startDir, existsSyncFn) {
  if (!startDir || typeof startDir !== 'string' || typeof existsSyncFn !== 'function') {
    return [];
  }
  const out = [];
  const seen = new Set();
  let dir = path.resolve(startDir);
  for (let i = 0; i < MAX_ANCESTOR_STEPS; i += 1) {
    const secretsPath = path.join(dir, '.aifabrix', 'secrets.local.yaml');
    if (existsSyncFn(secretsPath)) {
      const abs = path.resolve(secretsPath);
      if (!seen.has(abs)) {
        seen.add(abs);
        out.push(abs);
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return out;
}

module.exports = {
  collectAncestorAifabrixSecretsLocalYamlPaths
};
