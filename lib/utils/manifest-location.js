/**
 * Canonical on-disk application manifest discovery (plan 141 Tier 1 + Tier 2).
 * Lazy-loads `./paths` inside functions to avoid circular dependency with `paths.js`.
 *
 * @fileoverview resolveApplicationManifestPathSync for cwd-first manifest picks
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { resolveApplicationConfigPath } = require('./app-config-resolver');

/**
 * @returns {import('./paths')}
 */
function getPaths() {
  return require('./paths');
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function hasApplicationConfig(dir) {
  try {
    resolveApplicationConfigPath(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function isExistingDir(dir) {
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {string} cwd
 * @param {string} targetKey
 * @returns {{ absolutePath: string, tier: string, appKey: string }|null}
 */
function tryTier1Integration(cwd, targetKey) {
  const dir = path.join(cwd, 'integration', targetKey);
  if (!isExistingDir(dir) || !hasApplicationConfig(dir)) {
    return null;
  }
  return { absolutePath: path.resolve(dir), tier: 'cwd-integration', appKey: targetKey };
}

/**
 * @param {string} cwd
 * @param {string} targetKey
 * @returns {{ absolutePath: string, tier: string, appKey: string }|null}
 */
function tryTier1Builder(cwd, targetKey) {
  const dir = path.join(cwd, 'builder', targetKey);
  if (!isExistingDir(dir) || !hasApplicationConfig(dir)) {
    return null;
  }
  return { absolutePath: path.resolve(dir), tier: 'cwd-builder', appKey: targetKey };
}

/**
 * @param {string} targetKey
 * @returns {{ absolutePath: string, tier: string, appKey: string }|null}
 */
function tryTier2SystemBuilder(targetKey) {
  const { isSystemBuilderAppName, getSystemBuilderRoot } = getPaths();
  if (!isSystemBuilderAppName(targetKey)) {
    return null;
  }
  const dir = path.join(getSystemBuilderRoot(), targetKey);
  if (!isExistingDir(dir) || !hasApplicationConfig(dir)) {
    return null;
  }
  return { absolutePath: path.resolve(dir), tier: 'system-builder', appKey: targetKey };
}

/**
 * @param {string|undefined} cwdOpt
 * @returns {string}
 */
function resolveCwdSafe(cwdOpt) {
  try {
    return path.resolve(cwdOpt ? cwdOpt : process.cwd());
  } catch {
    return path.resolve(process.cwd());
  }
}

/**
 * @param {{ targetKey?: string, mode?: string, cwd?: string }|null|undefined} opts
 * @returns {{ targetKey: string, mode: string, cwd: string }|null}
 */
function parseManifestResolveOpts(opts) {
  const targetKey = opts && typeof opts.targetKey === 'string' ? opts.targetKey.trim() : '';
  if (!targetKey) {
    return null;
  }
  const mode = opts && opts.mode ? opts.mode : 'auto';
  const cwd = resolveCwdSafe(opts && opts.cwd);
  return { targetKey, mode, cwd };
}

/**
 * @param {string} mode
 * @param {string} cwd
 * @param {string} targetKey
 * @returns {{ absolutePath: string, tier: string, appKey: string }|null}
 */
function tryTier1ByMode(mode, cwd, targetKey) {
  if (mode === 'integration' || mode === 'auto') {
    const integrationHit = tryTier1Integration(cwd, targetKey);
    if (integrationHit) {
      return integrationHit;
    }
  }
  if (mode === 'builder' || mode === 'auto') {
    const builderHit = tryTier1Builder(cwd, targetKey);
    if (builderHit) {
      return builderHit;
    }
  }
  return null;
}

/**
 * Resolves `application.yaml` (or sibling config) for an app using plan 141 order:
 * `cwd/integration/<key>` → `cwd/builder/<key>` → system `builder/<platform>` under work/home.
 *
 * @param {{ targetKey: string, mode?: 'auto'|'integration'|'builder', cwd?: string }} opts
 * @returns {{ absolutePath: string, tier: string, appKey: string }|null} Null when not found
 */
function resolveApplicationManifestPathSync(opts) {
  const parsed = parseManifestResolveOpts(opts);
  if (!parsed) {
    return null;
  }
  const { targetKey, mode, cwd } = parsed;
  const tier1 = tryTier1ByMode(mode, cwd, targetKey);
  if (tier1) {
    return tier1;
  }
  if (mode === 'auto') {
    return tryTier2SystemBuilder(targetKey);
  }
  return null;
}

module.exports = {
  resolveApplicationManifestPathSync
};
