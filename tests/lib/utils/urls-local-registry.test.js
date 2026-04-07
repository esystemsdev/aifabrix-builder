/**
 * @fileoverview Tests for urls.local.yaml registry helpers (plan 122)
 */

'use strict';

// Prefer real fs if this worker loaded jest.mock('fs') from another suite.
jest.unmock('fs');

const fs = require('node:fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/paths', () => ({
  ...jest.requireActual('../../../lib/utils/paths'),
  getAifabrixHome: jest.fn(),
  getConfigDirForPaths: jest.fn(),
  getProjectRoot: jest.fn()
}));

const pathsUtil = require('../../../lib/utils/paths');
const {
  getUrlsLocalYamlPath,
  readUrlsLocalRegistrySync,
  writeUrlsLocalRegistrySync,
  refreshUrlsLocalRegistryFromBuilder,
  normalizePatternForUrl,
  getRegistryEntryForApp
} = require('../../../lib/utils/urls-local-registry');

describe('urls-local-registry', () => {
  let tmp;
  let fakeHome;
  let fakeProject;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urls-reg-'));
    fakeHome = path.join(tmp, 'aifhome');
    fakeProject = path.join(tmp, 'project');
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.mkdirSync(path.join(fakeProject, 'builder', 'alpha'), { recursive: true });
    pathsUtil.getAifabrixHome.mockReturnValue(fakeHome);
    pathsUtil.getConfigDirForPaths.mockReturnValue(fakeHome);
    pathsUtil.getProjectRoot.mockReturnValue(fakeProject);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    // Do not jest.clearAllMocks() here — it can clear mockReturnValue on paths before the next
    // beforeEach runs in the same tick as other suites, breaking getAifabrixHome/getProjectRoot.
  });

  describe('normalizePatternForUrl', () => {
    it('returns / for empty or non-string', () => {
      expect(normalizePatternForUrl('')).toBe('/');
      expect(normalizePatternForUrl(null)).toBe('/');
      expect(normalizePatternForUrl(undefined)).toBe('/');
      expect(normalizePatternForUrl(123)).toBe('/');
    });

    it('ensures leading slash and strips trailing wildcards and slashes', () => {
      expect(normalizePatternForUrl('data')).toBe('/data');
      expect(normalizePatternForUrl('/api/**')).toBe('/api');
      expect(normalizePatternForUrl('/v1/')).toBe('/v1');
    });
  });

  describe('getRegistryEntryForApp', () => {
    it('returns null when port missing or invalid', () => {
      expect(getRegistryEntryForApp('x', {})).toBeNull();
      expect(getRegistryEntryForApp('x', { 'x-port': 'nope' })).toBeNull();
      expect(getRegistryEntryForApp('x', { 'x-port': 0 })).toBeNull();
    });

    it('returns port and pattern', () => {
      const r = getRegistryEntryForApp('dataplane', {
        'dataplane-port': 3001,
        'dataplane-pattern': '/data/*'
      });
      expect(r).toEqual({ port: 3001, pattern: '/data/*' });
    });

    it('defaults pattern to / when not a string', () => {
      const r = getRegistryEntryForApp('a', { 'a-port': 80, 'a-pattern': 1 });
      expect(r).toEqual({ port: 80, pattern: '/' });
    });
  });

  describe('getUrlsLocalYamlPath + read/write', () => {
    it('read returns {} when file missing', () => {
      expect(readUrlsLocalRegistrySync()).toEqual({});
    });

    it('round-trips yaml', () => {
      writeUrlsLocalRegistrySync({ 'myapp-port': 3000, note: 'x' });
      expect(getUrlsLocalYamlPath()).toBe(path.join(fakeHome, 'urls.local.yaml'));
      const doc = readUrlsLocalRegistrySync();
      expect(doc['myapp-port']).toBe(3000);
      expect(doc.note).toBe('x');
    });

    it('reads legacy file under getAifabrixHome when config-dir file is missing', () => {
      const cfgDir = path.join(fakeHome, 'dot-aifabrix');
      fs.mkdirSync(cfgDir, { recursive: true });
      pathsUtil.getConfigDirForPaths.mockReturnValue(cfgDir);
      pathsUtil.getAifabrixHome.mockReturnValue(fakeHome);
      const legacyPath = path.join(fakeHome, 'urls.local.yaml');
      fs.writeFileSync(legacyPath, 'migrated-port: 7777\n', 'utf8');
      expect(getUrlsLocalYamlPath()).toBe(path.join(cfgDir, 'urls.local.yaml'));
      expect(readUrlsLocalRegistrySync()).toEqual({ 'migrated-port': 7777 });
    });

    it('prefers config-dir urls.local.yaml over legacy when both exist', () => {
      const cfgDir = path.join(fakeHome, 'dot-aifabrix');
      fs.mkdirSync(cfgDir, { recursive: true });
      pathsUtil.getConfigDirForPaths.mockReturnValue(cfgDir);
      pathsUtil.getAifabrixHome.mockReturnValue(fakeHome);
      fs.writeFileSync(path.join(fakeHome, 'urls.local.yaml'), 'legacy: 1\n', 'utf8');
      fs.writeFileSync(path.join(cfgDir, 'urls.local.yaml'), 'primary: 2\n', 'utf8');
      expect(readUrlsLocalRegistrySync()).toEqual({ primary: 2 });
    });
  });

  describe('refreshUrlsLocalRegistryFromBuilder', () => {
    it('merges builder application.yaml entries and preserves existing keys', () => {
      writeUrlsLocalRegistrySync({ legacyKey: 1 });

      const alphaYaml = path.join(fakeProject, 'builder', 'alpha', 'application.yaml');
      fs.writeFileSync(
        alphaYaml,
        `port: 3001
app:
  key: alpha-app
frontDoorRouting:
  pattern: /data/*
`,
        'utf8'
      );

      const merged = refreshUrlsLocalRegistryFromBuilder(fakeProject);
      expect(merged.legacyKey).toBe(1);
      expect(merged['alpha-app-port']).toBe(3001);
      expect(merged['alpha-app-pattern']).toBe('/data/*');

      const disk = readUrlsLocalRegistrySync();
      expect(disk['alpha-app-port']).toBe(3001);
    });

    it('uses directory name when app.key missing', () => {
      const betaDir = path.join(fakeProject, 'builder', 'beta-only');
      fs.mkdirSync(betaDir, { recursive: true });
      fs.writeFileSync(path.join(betaDir, 'application.yaml'), 'port: 8080\n', 'utf8');

      const merged = refreshUrlsLocalRegistryFromBuilder(fakeProject);
      expect(merged['beta-only-port']).toBe(8080);
    });

    it('skips folders without valid port', () => {
      const badDir = path.join(fakeProject, 'builder', 'no-port');
      fs.mkdirSync(badDir, { recursive: true });
      fs.writeFileSync(path.join(badDir, 'application.yaml'), 'name: x\n', 'utf8');

      const merged = refreshUrlsLocalRegistryFromBuilder(fakeProject);
      expect(merged['no-port-port']).toBeUndefined();
    });

    it('writes empty merge when project root null', () => {
      pathsUtil.getProjectRoot.mockReturnValue(null);
      writeUrlsLocalRegistrySync({ keep: true });
      const merged = refreshUrlsLocalRegistryFromBuilder(null);
      expect(merged.keep).toBe(true);
    });
  });
});
