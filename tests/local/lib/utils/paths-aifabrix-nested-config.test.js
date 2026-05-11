/**
 * Nested config.yaml under $AIFABRIX_HOME/.aifabrix/ (builder-server layout).
 *
 * Local-only: real disk + jest.resetModules + fs-real-sync worker ordering is flaky in
 * CI simulation / GitHub Actions (same class as url-declarative local suites).
 *
 * @fileoverview getApplicationsBaseDir with nested runtime config dir
 */

'use strict';

jest.mock('fs');
jest.unmock('../../../../lib/internal/fs-real-sync');

const path = require('path');
const os = require('os');

describe('Path Utilities - nested AIFABRIX_HOME config (local)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('getApplicationsBaseDir uses ~/.aifabrix when AIFABRIX_HOME is that homedir and config is nested', () => {
    const fsRealSync = require('../../../../lib/internal/fs-real-sync');
    const ex = fsRealSync.existsSync;
    const rf = fsRealSync.readFileSync;
    if (ex && typeof ex.mockRestore === 'function') {
      ex.mockRestore();
    }
    if (rf && typeof rf.mockRestore === 'function') {
      rf.mockRestore();
    }

    const GFS = jest.requireActual('node:fs');
    const tmp = GFS.mkdtempSync(path.join(os.tmpdir(), 'afx-app-home-'));
    const nest = path.join(tmp, '.aifabrix');
    GFS.mkdirSync(nest, { recursive: true });
    const nestedConfigPath = path.join(nest, 'config.yaml');
    GFS.writeFileSync(nestedConfigPath, 'x: 1\n', 'utf8');
    const directConfigPath = path.join(tmp, 'config.yaml');
    expect(GFS.existsSync(nestedConfigPath)).toBe(true);
    expect(GFS.existsSync(directConfigPath)).toBe(false);

    const origHome = process.env.AIFABRIX_HOME;
    const origCfg = process.env.AIFABRIX_CONFIG;
    try {
      process.env.AIFABRIX_HOME = tmp;
      delete process.env.AIFABRIX_CONFIG;
      jest.resetModules();
      const { getAifabrixRuntimeConfigDir } = require('../../../../lib/utils/aifabrix-runtime-config-dir');
      expect(getAifabrixRuntimeConfigDir()).toBe(nest);
      const pathsMod = require('../../../../lib/utils/paths');
      expect(pathsMod.getApplicationsBaseDir('02')).toBe(path.join(nest, 'applications-dev-02'));
      expect(pathsMod.getApplicationsBaseDir(0)).toBe(path.join(nest, 'applications'));
    } finally {
      if (origHome === undefined) {
        delete process.env.AIFABRIX_HOME;
      } else {
        process.env.AIFABRIX_HOME = origHome;
      }
      if (origCfg === undefined) {
        delete process.env.AIFABRIX_CONFIG;
      } else {
        process.env.AIFABRIX_CONFIG = origCfg;
      }
      try {
        GFS.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });
});
