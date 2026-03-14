/**
 * Secure file permissions for secrets and config (ISO 27001).
 * Ensures sensitive files are restricted to owner-only (0o600) when read or written.
 *
 * @fileoverview Enforce restrictive permissions on secrets and config files
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** Mode for secrets and admin files: owner read/write only (no group/other). */
const SECRET_FILE_MODE = 0o600;

/** Mode for config file (may contain tokens): owner read/write only. */
const CONFIG_FILE_MODE = 0o600;

/**
 * Ensures a file has restrictive permissions (0o600) when it exists.
 * If the file has group or other read/write/execute bits set, chmods to owner-only.
 * Safe to call on every read path; no-op when file is missing or already 0o600.
 * On Windows, chmod restricts write access; mode bits are not fully supported.
 *
 * @param {string} filePath - Absolute or relative path to the file
 * @param {number} [mode=0o600] - Desired mode (default SECRET_FILE_MODE)
 * @returns {boolean} True if file existed and permissions were (or are now) secure
 */
function ensureSecureFilePermissions(filePath, mode = SECRET_FILE_MODE) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  try {
    if (!fs.existsSync(resolved)) {
      return false;
    }
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      return false;
    }
    const currentMode = stat.mode & 0o777;
    if ((currentMode & 0o77) === 0) {
      return true;
    }
    fs.chmodSync(resolved, mode);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures a directory has restrictive permissions (0o700) when it exists.
 * No-op when directory is missing or already 0o700 (no group/other).
 *
 * @param {string} dirPath - Absolute or relative path to the directory
 * @returns {boolean} True if directory existed and permissions were (or are now) secure
 */
function ensureSecureDirPermissions(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return false;
  }
  const resolved = path.isAbsolute(dirPath) ? dirPath : path.resolve(dirPath);
  try {
    if (!fs.existsSync(resolved)) {
      return false;
    }
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return false;
    }
    const currentMode = stat.mode & 0o777;
    if ((currentMode & 0o77) === 0) {
      return true;
    }
    fs.chmodSync(resolved, 0o700);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ensureSecureFilePermissions,
  ensureSecureDirPermissions,
  SECRET_FILE_MODE,
  CONFIG_FILE_MODE
};
