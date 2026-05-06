/**
 * Timestamped backups under integration/<app>/backup/ (same layout as datasource capability copy).
 *
 * @fileoverview Backup before mutating integration JSON/YAML
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * True if path exists and is a regular file (not mocked by typical existsSync spies in unit tests).
 * @param {string} filePath
 * @returns {boolean}
 */
function isRegularFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Copies filePath into neighbor backup/ with ISO timestamp suffix.
 * @param {string} filePath - Absolute path to file to copy
 * @param {boolean} noBackup - When true, skip and return null
 * @returns {string|null} Destination path or null
 */
function writeBackup(filePath, noBackup) {
  if (noBackup) {
    return null;
  }
  const dir = path.dirname(filePath);
  const backupDir = path.join(dir, 'backup');
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.basename(filePath);
  const dest = path.join(backupDir, `${base}.${ts}.bak`);
  fs.copyFileSync(filePath, dest);
  return dest;
}

/**
 * Backs up an existing file once per repair run (dedupes by absolute path).
 * @param {string} filePath - Path to file that will be overwritten
 * @param {{ dryRun?: boolean, noBackup?: boolean, backupPaths?: string[], backedUpFiles?: Set<string> }} ctx
 * @returns {string|null}
 */
function backupIntegrationFile(filePath, ctx) {
  const { dryRun, noBackup, backupPaths, backedUpFiles } = ctx || {};
  if (dryRun || noBackup || !filePath || !isRegularFile(filePath)) {
    return null;
  }
  const abs = path.resolve(filePath);
  if (backedUpFiles) {
    if (backedUpFiles.has(abs)) return null;
    backedUpFiles.add(abs);
  }
  const dest = writeBackup(filePath, false);
  if (dest && Array.isArray(backupPaths)) {
    backupPaths.push(dest);
  }
  return dest;
}

module.exports = {
  writeBackup,
  backupIntegrationFile,
  isRegularFile
};
