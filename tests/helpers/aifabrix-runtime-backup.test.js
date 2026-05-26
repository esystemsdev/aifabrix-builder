/**
 * @fileoverview Backup/restore round-trip for live Fabrix runtime files (plan 185 Phase 2.5).
 */

'use strict';

const fs = jest.requireActual('node:fs');
const path = require('path');
const os = require('os');

const {
  RUNTIME_FILES,
  isConfigDirUnderOsTmpdir,
  backupAifabrixRuntimeDir,
  restoreAifabrixRuntimeDir
} = require('./aifabrix-runtime-backup');

/** Linux CI often mounts the repo under os.tmpdir(); use /var/tmp for a stable non-tmp fixture. */
const VAR_TMP_FIXTURE_ROOT = path.join('/var', 'tmp', 'aifx-runtime-backup-fixture');

/**
 * Directory that simulates ~/.aifabrix but is guaranteed outside os.tmpdir().
 *
 * @returns {string}
 */
function resolveSimLiveDirForBackupTest() {
  const candidates = [
    path.join(__dirname, 'fixture-live-runtime', `pid-${process.pid}`),
    path.join(global.PROJECT_ROOT || path.resolve(__dirname, '..', '..'), 'tests', 'helpers', 'fixture-live-runtime', `pid-${process.pid}`)
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!isConfigDirUnderOsTmpdir(resolved)) {
      return resolved;
    }
  }
  return path.join(VAR_TMP_FIXTURE_ROOT, String(process.pid));
}

describe('aifabrix-runtime-backup', () => {
  /** Simulated operator config dir (not under os.tmpdir — backup must run). */
  let simLiveDir;
  /** @type {Record<string, Buffer>} */
  let originalBytes;

  beforeEach(() => {
    simLiveDir = resolveSimLiveDirForBackupTest();
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
    expect(isConfigDirUnderOsTmpdir(simLiveDir)).toBe(false);
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
