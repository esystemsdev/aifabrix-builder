/**
 * Resolves the directory that contains `config.yaml` for CLI runtime.
 * Shared by `paths.getConfigDirForPaths` and `config.getConfigDir` (no circular imports).
 *
 * When `AIFABRIX_HOME` is set to the POSIX home (builder-server pattern) but the real
 * config file is under `~/.aifabrix/config.yaml`, use that nested directory so
 * `secrets.local.yaml` and auth config stay beside `config.yaml`.
 *
 * Relative `AIFABRIX_HOME` / `AIFABRIX_CONFIG` values are anchored to the user home
 * directory (not `process.cwd()`), so a mistaken `aifabrix-training` does not become
 * `/aifabrix-training` when the shell cwd is `/` (EACCES on mkdir).
 * Paths starting with `./` or `../` still resolve from cwd for project-local overrides.
 *
 * @fileoverview AIFABRIX_CONFIG / AIFABRIX_HOME → config directory
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { existsSync } = require('../internal/fs-real-sync');
const path = require('path');
const os = require('os');

/**
 * @returns {string}
 */
function safeHomedir() {
  try {
    const h = os.homedir();
    if (typeof h === 'string' && h.length > 0) {
      return h;
    }
  } catch {
    // ignore
  }
  return process.env.HOME || process.env.USERPROFILE || '/';
}

/**
 * @param {string} raw
 * @returns {string}
 */
function expandLeadingTilde(raw) {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t) {
    return t;
  }
  if (t === '~') {
    return safeHomedir();
  }
  if (t.startsWith('~/') || t.startsWith('~\\')) {
    return path.join(safeHomedir(), t.slice(2));
  }
  return t;
}

/**
 * True when the path is explicitly relative to cwd (project-local).
 * @param {string} t
 * @returns {boolean}
 */
function isExplicitRelativeToCwd(t) {
  if (t === '.' || t === '..') {
    return true;
  }
  return (
    t.startsWith('./') ||
    t.startsWith('../') ||
    t.startsWith('.\\') ||
    t.startsWith('..\\')
  );
}

/**
 * Resolve `AIFABRIX_HOME` and config `aifabrix-home`: bare relative segments live under user home.
 *
 * @param {string} raw
 * @returns {string}
 */
function resolveAifabrixHomeLikePath(raw) {
  const expanded = expandLeadingTilde(raw);
  if (!expanded) {
    return expanded;
  }
  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }
  if (isExplicitRelativeToCwd(expanded)) {
    return path.resolve(expanded);
  }
  return path.resolve(safeHomedir(), expanded);
}

/**
 * Resolve `AIFABRIX_CONFIG`: same rules as home-like (bare `foo/bar.yaml` → under ~).
 *
 * @param {string} raw
 * @returns {string}
 */
function resolveAifabrixConfigEnvPath(raw) {
  return resolveAifabrixHomeLikePath(raw);
}

/**
 * @returns {string} Absolute directory containing `config.yaml`
 */
function getAifabrixRuntimeConfigDir() {
  if (process.env.AIFABRIX_CONFIG && typeof process.env.AIFABRIX_CONFIG === 'string') {
    const resolved = resolveAifabrixConfigEnvPath(process.env.AIFABRIX_CONFIG.trim());
    return path.dirname(resolved);
  }
  if (process.env.AIFABRIX_HOME && typeof process.env.AIFABRIX_HOME === 'string') {
    const homeDir = resolveAifabrixHomeLikePath(process.env.AIFABRIX_HOME.trim());
    const directConfig = path.join(homeDir, 'config.yaml');
    if (existsSync(directConfig)) {
      return homeDir;
    }
    const nestedConfig = path.join(homeDir, '.aifabrix', 'config.yaml');
    if (existsSync(nestedConfig)) {
      return path.join(homeDir, '.aifabrix');
    }
    return homeDir;
  }
  return path.join(safeHomedir(), '.aifabrix');
}

module.exports = {
  getAifabrixRuntimeConfigDir,
  resolveAifabrixHomeLikePath,
  resolveAifabrixConfigEnvPath
};
