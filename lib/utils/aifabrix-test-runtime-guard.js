/**
 * Refuse writes to live ~/.aifabrix paths during Jest runs.
 *
 * @fileoverview Test-runtime write guard for secrets and admin-secrets files
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ALLOW_ENV = 'ALLOW_AIFABRIX_TEST_WRITE_REAL_CONFIG';

/**
 * @returns {boolean}
 */
function isJestTestProcess() {
  return Boolean(process.env.JEST_WORKER_ID) || process.env.NODE_ENV === 'test';
}

/** Legacy mock Fabrix dir used across unit tests (not the operator tree when homedir differs). */
const JEST_MOCK_FABRIX_ROOT = path.join('/home', 'test', '.aifabrix');

/** Additional protected trees in cloud / monorepo dev (see plan 185 Phase 2.5). */
const EXTRA_PROTECTED_FABRIX_ROOTS = ['/workspace/.aifabrix'];

/**
 * Resolve symlinks so `~/.aifabrix` → `/workspace/.aifabrix` matches both paths.
 * @param {string} p
 * @returns {string}
 */
function resolveFabrixPathKey(p) {
  const resolved = path.resolve(p);
  try {
    if (fs.existsSync(resolved)) {
      return fs.realpathSync(resolved);
    }
  } catch {
    // ignore
  }
  return resolved;
}

/**
 * @returns {string[]} Absolute live config directory paths (deduped by realpath).
 */
function getLiveFabrixConfigDirCandidates() {
  const keys = new Set();
  const dirs = [];
  const add = (dir) => {
    if (!dir || typeof dir !== 'string') return;
    const key = resolveFabrixPathKey(dir);
    if (keys.has(key)) return;
    keys.add(key);
    dirs.push(key);
  };
  add(path.join(path.resolve(os.homedir()), '.aifabrix'));
  for (const root of EXTRA_PROTECTED_FABRIX_ROOTS) {
    add(root);
  }
  return dirs;
}

/**
 * True when the path is the operator's live ~/.aifabrix tree (not the legacy /home/test mock).
 * @param {string} filePath
 * @returns {boolean}
 */
function isLiveFabrixConfigPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const normalized = resolveFabrixPathKey(filePath);
  if (
    normalized === JEST_MOCK_FABRIX_ROOT ||
    normalized.startsWith(`${JEST_MOCK_FABRIX_ROOT}${path.sep}`)
  ) {
    return false;
  }
  for (const liveRoot of getLiveFabrixConfigDirCandidates()) {
    if (normalized === liveRoot || normalized.startsWith(`${liveRoot}${path.sep}`)) {
      return true;
    }
  }
  return false;
}

/**
 * During Jest, writes are allowed everywhere except the live ~/.aifabrix tree.
 * @param {string} filePath
 * @returns {boolean}
 */
function isAllowedTestWritePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;
  if (process.env[ALLOW_ENV] === '1' || process.env[ALLOW_ENV] === 'true') {
    return true;
  }
  if (!isJestTestProcess()) return true;
  return !isLiveFabrixConfigPath(filePath);
}

/**
 * @param {string} filePath
 * @throws {Error} When Jest would write outside sandbox
 */
function assertWritableSecretsPathForTests(filePath) {
  if (!isJestTestProcess()) return;
  if (isAllowedTestWritePath(filePath)) return;
  throw new Error(
    `Refusing to write secrets to live config path during tests: ${filePath}. ` +
      'Use the Jest sandbox (default) or set ALLOW_AIFABRIX_TEST_WRITE_REAL_CONFIG=1.'
  );
}

module.exports = {
  ALLOW_ENV,
  EXTRA_PROTECTED_FABRIX_ROOTS,
  isJestTestProcess,
  resolveFabrixPathKey,
  getLiveFabrixConfigDirCandidates,
  isLiveFabrixConfigPath,
  isAllowedTestWritePath,
  assertWritableSecretsPathForTests
};
