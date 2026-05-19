/**
 * @fileoverview Protection manifest directory under repo `integration/.protection/`.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  getAppsMaterializationParent,
  getCwdIntegrationRoot
} = require('../utils/paths');
const { nodeFs } = require('../internal/node-fs');

/**
 * Walk upward from cwd for the nearest directory containing `integration/`.
 *
 * @returns {string|null} Absolute path to `integration/` or null
 */
function findNearestIntegrationRootFromCwd() {
  const disk = nodeFs();
  let walk = path.resolve(process.cwd());
  for (let i = 0; i < 64; i += 1) {
    const integrationDir = path.join(walk, 'integration');
    try {
      if (disk.existsSync(integrationDir)) {
        const st = disk.statSync(integrationDir);
        if (st && typeof st.isDirectory === 'function' && st.isDirectory()) {
          return integrationDir;
        }
      }
    } catch {
      // ignore
    }
    const parent = path.dirname(walk);
    if (parent === walk) {
      break;
    }
    walk = parent;
  }
  return null;
}

/**
 * Canonical repo-local protection root: `integration/.protection/`.
 *
 * @returns {string}
 */
function getRepoProtectionRoot() {
  const cwdInt = getCwdIntegrationRoot();
  if (cwdInt) {
    return path.join(cwdInt, '.protection');
  }
  const nearest = findNearestIntegrationRootFromCwd();
  if (nearest) {
    return path.join(nearest, '.protection');
  }
  return path.join(getAppsMaterializationParent(), 'integration', '.protection');
}

/**
 * @returns {string}
 */
function getLegacyProtectionRoot() {
  return path.join(getAppsMaterializationParent(), '.protection');
}

/**
 * @param {string} root
 * @returns {boolean}
 */
function protectionRootHasManifestFiles(root) {
  if (!root || !fs.existsSync(root)) {
    return false;
  }
  try {
    return fs.readdirSync(root).some((name) => /\.(yaml|yml|json)$/i.test(name));
  } catch {
    return false;
  }
}

/**
 * @returns {string} Absolute path to protection manifests directory
 */
function getProtectionRoot() {
  const explicit = process.env.AIFABRIX_PROTECTION_ROOT;
  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    return path.resolve(explicit.trim());
  }

  const legacyFlag =
    process.env.AIFABRIX_PROTECTION_LEGACY === '1' ||
    String(process.env.AIFABRIX_PROTECTION_LEGACY || '').toLowerCase() === 'true';

  const repoRoot = getRepoProtectionRoot();
  const legacyRoot = getLegacyProtectionRoot();

  if (legacyFlag) {
    return legacyRoot;
  }

  const repoHas = protectionRootHasManifestFiles(repoRoot);
  const legacyHas = protectionRootHasManifestFiles(legacyRoot);

  if (!repoHas && legacyHas && legacyRoot !== repoRoot) {
    return legacyRoot;
  }

  return repoRoot;
}

/**
 * Human-readable folder label for batch protection TTY output.
 *
 * @returns {{ root: string, label: string, usingLegacy: boolean, migrationHint: string|null }}
 */
function describeProtectionRoot() {
  const root = getProtectionRoot();
  const legacyRoot = getLegacyProtectionRoot();
  const repoRoot = getRepoProtectionRoot();
  const usingLegacy = path.resolve(root) === path.resolve(legacyRoot);
  const legacyHas = protectionRootHasManifestFiles(legacyRoot);
  const repoHas = protectionRootHasManifestFiles(repoRoot);

  let label = 'integration/.protection';
  if (usingLegacy) {
    label = 'work/.protection (legacy)';
  } else if (process.env.AIFABRIX_PROTECTION_ROOT) {
    label = 'custom';
  }

  let migrationHint = null;
  if (usingLegacy && legacyHas) {
    migrationHint = `Move manifests to ${repoRoot} (git-friendly integration/.protection/).`;
  } else if (!usingLegacy && legacyHas && !repoHas) {
    migrationHint = `Legacy manifests remain under ${legacyRoot}; migrate to ${repoRoot}.`;
  }

  return { root, label, usingLegacy, migrationHint };
}

module.exports = {
  getProtectionRoot,
  describeProtectionRoot,
  getRepoProtectionRoot,
  getLegacyProtectionRoot,
  findNearestIntegrationRootFromCwd
};
