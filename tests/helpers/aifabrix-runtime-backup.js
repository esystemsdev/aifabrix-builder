/**
 * Backup / restore live Fabrix runtime files when PRESERVE_AIFABRIX_TEST_ENV is set.
 *
 * @fileoverview Optional safety net for tests that target real ~/.aifabrix
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const RUNTIME_FILES = ['secrets.local.yaml', 'admin-secrets.env', 'urls.local.yaml'];

/**
 * @param {string} configDir - Absolute path to .aifabrix directory
 * @returns {{ backupDir: string, files: string[] }}
 */
function backupAifabrixRuntimeDir(configDir) {
  const resolved = path.resolve(configDir);
  const tmp = path.resolve(os.tmpdir());
  if (resolved === tmp || resolved.startsWith(`${tmp}${path.sep}`)) {
    return { backupDir: null, files: [] };
  }
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifx-backup-'));
  const copied = [];
  for (const name of RUNTIME_FILES) {
    const src = path.join(resolved, name);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(backupDir, name);
    fs.copyFileSync(src, dest);
    copied.push(name);
  }
  return { backupDir, files: copied };
}

/**
 * @param {string} configDir
 * @param {{ backupDir: string|null, files: string[] }} snapshot
 */
function restoreAifabrixRuntimeDir(configDir, snapshot) {
  if (!snapshot || !snapshot.backupDir) return;
  const resolved = path.resolve(configDir);
  for (const name of snapshot.files) {
    const from = path.join(snapshot.backupDir, name);
    const to = path.join(resolved, name);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
    } else if (fs.existsSync(to)) {
      fs.rmSync(to, { force: true });
    }
  }
  try {
    fs.rmSync(snapshot.backupDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

module.exports = {
  RUNTIME_FILES,
  backupAifabrixRuntimeDir,
  restoreAifabrixRuntimeDir
};
