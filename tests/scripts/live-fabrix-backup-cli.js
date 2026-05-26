#!/usr/bin/env node
/**
 * Backup / restore live ~/.aifabrix runtime files outside Jest (e.g. ci-simulate.sh).
 *
 * @fileoverview CLI for operator config backup before long test runs
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  discoverLiveFabrixRuntimeConfigDirs,
  backupAifabrixRuntimeDir,
  restoreAifabrixRuntimeDir
} = require('../helpers/aifabrix-runtime-backup');

const STATE_BASENAME = 'aifx-ci-simulate-live-runtime-backup-state.json';

/**
 * @returns {string}
 */
function stateFilePath() {
  return path.join(os.tmpdir(), STATE_BASENAME);
}

/**
 * @param {{ entries: object[] }} payload
 */
function writeState(payload) {
  fs.writeFileSync(stateFilePath(), JSON.stringify(payload), 'utf8');
}

/**
 * @returns {{ entries: object[] }}
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

function backup() {
  const entries = [];
  for (const configDir of discoverLiveFabrixRuntimeConfigDirs()) {
    const snapshot = backupAifabrixRuntimeDir(configDir);
    if (snapshot.backupDir) {
      entries.push({ configDir, snapshot });
    }
  }
  writeState({ entries });
  if (entries.length === 0) {
    process.stderr.write('live-fabrix-backup: no operator config dirs found to back up\n');
  } else {
    process.stderr.write(
      `live-fabrix-backup: backed up ${entries.map((e) => e.snapshot.files.join(',')).join('; ')}\n`
    );
  }
}

function restore() {
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

const cmd = process.argv[2];
if (cmd === 'backup') {
  backup();
} else if (cmd === 'restore') {
  restore();
} else {
  process.stderr.write('Usage: node live-fabrix-backup-cli.js backup|restore\n');
  process.exit(1);
}
