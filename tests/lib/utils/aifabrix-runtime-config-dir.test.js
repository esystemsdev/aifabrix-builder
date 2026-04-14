/**
 * @fileoverview Tests for aifabrix-runtime-config-dir.js
 */

// Real disk I/O; workers can retain jest.mock('fs') from other suites in the same process.
jest.unmock('fs');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('getAifabrixRuntimeConfigDir', () => {
  let origConfig;
  let origHome;

  beforeEach(() => {
    origConfig = process.env.AIFABRIX_CONFIG;
    origHome = process.env.AIFABRIX_HOME;
  });

  afterEach(() => {
    if (origConfig === undefined) {
      delete process.env.AIFABRIX_CONFIG;
    } else {
      process.env.AIFABRIX_CONFIG = origConfig;
    }
    if (origHome === undefined) {
      delete process.env.AIFABRIX_HOME;
    } else {
      process.env.AIFABRIX_HOME = origHome;
    }
    jest.resetModules();
  });

  it('uses dirname of AIFABRIX_CONFIG', () => {
    process.env.AIFABRIX_CONFIG = '/opt/aifabrix/cfg/config.yaml';
    delete process.env.AIFABRIX_HOME;
    const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
    expect(getAifabrixRuntimeConfigDir()).toBe(path.resolve('/opt/aifabrix/cfg'));
  });

  it('when AIFABRIX_HOME has direct config.yaml, uses that directory', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afx-cfg-'));
    fs.writeFileSync(path.join(tmp, 'config.yaml'), 'x: 1\n', 'utf8');
    process.env.AIFABRIX_HOME = tmp;
    delete process.env.AIFABRIX_CONFIG;
    const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
    expect(getAifabrixRuntimeConfigDir()).toBe(tmp);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('when only $AIFABRIX_HOME/.aifabrix/config.yaml exists, uses nested .aifabrix', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afx-nested-'));
    const nested = path.join(tmp, '.aifabrix');
    fs.mkdirSync(nested, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(nested, 'config.yaml'), 'x: 1\n', 'utf8');
    expect(fs.existsSync(path.join(tmp, 'config.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(nested, 'config.yaml'))).toBe(true);
    process.env.AIFABRIX_HOME = tmp;
    delete process.env.AIFABRIX_CONFIG;
    jest.isolateModules(() => {
      const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
      expect(getAifabrixRuntimeConfigDir()).toBe(nested);
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('prefers direct config.yaml over nested when both exist', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afx-both-'));
    fs.writeFileSync(path.join(tmp, 'config.yaml'), 'direct: true\n', 'utf8');
    const nested = path.join(tmp, '.aifabrix');
    fs.mkdirSync(nested, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(nested, 'config.yaml'), 'nested: true\n', 'utf8');
    process.env.AIFABRIX_HOME = tmp;
    delete process.env.AIFABRIX_CONFIG;
    const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
    expect(getAifabrixRuntimeConfigDir()).toBe(tmp);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('when no env and no files, falls back to os.homedir()/.aifabrix', () => {
    delete process.env.AIFABRIX_CONFIG;
    delete process.env.AIFABRIX_HOME;
    const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
    expect(getAifabrixRuntimeConfigDir()).toBe(path.join(os.homedir(), '.aifabrix'));
  });

  it('anchors bare relative AIFABRIX_HOME to user home when cwd is filesystem root', () => {
    const origCwd = process.cwd();
    const rel = `afx-rel-${Date.now()}`;
    const expected = path.join(os.homedir(), rel);
    try {
      process.chdir(path.parse(origCwd).root);
      process.env.AIFABRIX_HOME = rel;
      delete process.env.AIFABRIX_CONFIG;
      jest.isolateModules(() => {
        const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
        expect(getAifabrixRuntimeConfigDir()).toBe(expected);
      });
    } finally {
      process.chdir(origCwd);
    }
  });

  it('resolves AIFABRIX_HOME=. from cwd (explicit project-relative)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afx-cwd-home-'));
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      process.env.AIFABRIX_HOME = '.';
      delete process.env.AIFABRIX_CONFIG;
      jest.isolateModules(() => {
        const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
        expect(getAifabrixRuntimeConfigDir()).toBe(tmp);
      });
    } finally {
      process.chdir(origCwd);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('anchors bare relative AIFABRIX_CONFIG under user home', () => {
    const slug = `training-${Date.now()}`;
    const cfgDir = path.join(os.homedir(), slug, '.aifabrix');
    const cfgFile = path.join(cfgDir, 'config.yaml');
    fs.mkdirSync(cfgDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(cfgFile, 'x: 1\n', 'utf8');
    const relFromHome = path.join(slug, '.aifabrix', 'config.yaml');
    const origCwd = process.cwd();
    try {
      process.chdir(path.parse(origCwd).root);
      process.env.AIFABRIX_CONFIG = relFromHome.split(path.sep).join('/');
      delete process.env.AIFABRIX_HOME;
      jest.isolateModules(() => {
        const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
        expect(getAifabrixRuntimeConfigDir()).toBe(cfgDir);
      });
    } finally {
      process.chdir(origCwd);
      try {
        fs.rmSync(path.join(os.homedir(), slug), { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('uses cwd for AIFABRIX_CONFIG starting with ./', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afx-cwd-cfg-'));
    fs.writeFileSync(path.join(tmp, 'config.yaml'), 'x: 1\n', 'utf8');
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      process.env.AIFABRIX_CONFIG = './config.yaml';
      delete process.env.AIFABRIX_HOME;
      jest.isolateModules(() => {
        const { getAifabrixRuntimeConfigDir } = require('../../../lib/utils/aifabrix-runtime-config-dir');
        expect(getAifabrixRuntimeConfigDir()).toBe(tmp);
      });
    } finally {
      process.chdir(origCwd);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
