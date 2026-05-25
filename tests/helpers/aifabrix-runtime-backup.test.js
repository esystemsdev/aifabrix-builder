/**
 * @fileoverview Backup/restore round-trip for live Fabrix runtime files (plan 185 Phase 2.5).
 */

'use strict';

const fs = jest.requireActual('node:fs');
const path = require('path');
const os = require('os');

const {
  RUNTIME_FILES,
  backupAifabrixRuntimeDir,
  restoreAifabrixRuntimeDir
} = require('./aifabrix-runtime-backup');

describe('aifabrix-runtime-backup', () => {
  /** Simulated operator config dir (not under os.tmpdir — backup must run). */
  let simLiveDir;
  /** @type {Record<string, Buffer>} */
  let originalBytes;

  beforeEach(() => {
    simLiveDir = path.join(__dirname, 'fixture-live-runtime', `pid-${process.pid}`);
    fs.mkdirSync(simLiveDir, { recursive: true, mode: 0o700 });
    originalBytes = {};
    for (const name of RUNTIME_FILES) {
      const content = `${name}-backup-test-${Date.now()}-${Math.random()}\n`;
      fs.writeFileSync(path.join(simLiveDir, name), content, 'utf8');
      originalBytes[name] = Buffer.from(content, 'utf8');
    }
  });

  afterEach(() => {
    try {
      fs.rmSync(simLiveDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('skips backup when config dir is under os.tmpdir', () => {
    const tmpConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'aifx-jest-'));
    const snap = backupAifabrixRuntimeDir(tmpConfig);
    expect(snap.backupDir).toBeNull();
    expect(snap.files).toEqual([]);
  });

  it('restore returns runtime files byte-equal to pre-mutation backup', () => {
    const snap = backupAifabrixRuntimeDir(simLiveDir);
    expect(snap.backupDir).not.toBeNull();
    expect(snap.files.sort()).toEqual([...RUNTIME_FILES].sort());

    for (const name of RUNTIME_FILES) {
      fs.writeFileSync(path.join(simLiveDir, name), `MUTATED-${name}\n`, 'utf8');
    }

    restoreAifabrixRuntimeDir(simLiveDir, snap);

    for (const name of RUNTIME_FILES) {
      const restored = fs.readFileSync(path.join(simLiveDir, name));
      expect(restored).toEqual(originalBytes[name]);
    }
  });

});
