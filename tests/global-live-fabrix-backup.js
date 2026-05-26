/**
 * Jest globalSetup / globalTeardown: backup live ~/.aifabrix runtime files once per
 * `jest` process (not once per test file). Per-file backup in setup.js can snapshot an
 * already-corrupted secrets file when setupFilesAfterEnv re-runs.
 *
 * @fileoverview One-shot backup/restore for operator Fabrix config during tests
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  discoverLiveFabrixRuntimeConfigDirs,
  backupAifabrixRuntimeDir,
  restoreAifabrixRuntimeDir
} = require('./helpers/aifabrix-runtime-backup');
const { isPreserveFabrixTestEnv } = require('./helpers/aifabrix-runtime-sandbox');

const STATE_BASENAME = 'aifx-jest-live-runtime-backup-state.json';

/**
 * @returns {string}
 */
function stateFilePath() {
  return path.join(os.tmpdir(), STATE_BASENAME);
}

/**
 * @param {{ entries: { configDir: string, snapshot: object }[] }} payload
 */
function writeState(payload) {
  fs.writeFileSync(stateFilePath(), JSON.stringify(payload), 'utf8');
}

/**
 * @returns {{ entries: { configDir: string, snapshot: object }[] }}
 */
function readState() {
  const file = stateFilePath();
  if (!fs.existsSync(file)) {
    return { entries: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && Array.isArray(parsed.entries) ? parsed : { entries: [] };
  } catch {
    return { entries: [] };
  }
}

/**
 * @returns {Promise<void>}
 */
async function globalSetup() {
  if (isPreserveFabrixTestEnv()) {
    return;
  }
  const entries = [];
  for (const configDir of discoverLiveFabrixRuntimeConfigDirs()) {
    const snapshot = backupAifabrixRuntimeDir(configDir);
    if (snapshot.backupDir) {
      entries.push({ configDir, snapshot });
    }
  }
  writeState({ entries });
}

/**
 * @returns {Promise<void>}
 */
async function globalTeardown() {
  if (isPreserveFabrixTestEnv()) {
    return;
  }
  const { entries } = readState();
  for (const { configDir, snapshot } of entries) {
    restoreAifabrixRuntimeDir(configDir, snapshot);
  }
  try {
    fs.rmSync(stateFilePath(), { force: true });
  } catch {
    // ignore
  }
}

module.exports = globalSetup;
module.exports.globalTeardown = globalTeardown;
