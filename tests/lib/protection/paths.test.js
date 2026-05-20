'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../lib/utils/paths', () => ({
  getAppsMaterializationParent: jest.fn(),
  getCwdIntegrationRoot: jest.fn()
}));

const pathsUtil = require('../../../lib/utils/paths');
const pathsModule = require('../../../lib/protection/paths');
const {
  getProtectionRoot,
  getRepoProtectionRoot,
  describeProtectionRoot
} = pathsModule;

describe('protection paths', () => {
  let tmpWork;
  let originalCwd;
  let originalEnv;
  let findNearestSpy;

  beforeEach(() => {
    tmpWork = fs.mkdtempSync(path.join(os.tmpdir(), 'prot-paths-'));
    originalCwd = process.cwd();
    process.chdir(tmpWork);
    originalEnv = {
      root: process.env.AIFABRIX_PROTECTION_ROOT,
      legacy: process.env.AIFABRIX_PROTECTION_LEGACY
    };
    delete process.env.AIFABRIX_PROTECTION_ROOT;
    delete process.env.AIFABRIX_PROTECTION_LEGACY;
    pathsUtil.getAppsMaterializationParent.mockReturnValue(tmpWork);
    pathsUtil.getCwdIntegrationRoot.mockReturnValue(null);
    findNearestSpy = jest
      .spyOn(pathsModule, 'findNearestIntegrationRootFromCwd')
      .mockReturnValue(null);
  });

  afterEach(() => {
    findNearestSpy.mockRestore();
    process.chdir(originalCwd);
    process.env.AIFABRIX_PROTECTION_ROOT = originalEnv.root;
    process.env.AIFABRIX_PROTECTION_LEGACY = originalEnv.legacy;
    fs.rmSync(tmpWork, { recursive: true, force: true });
  });

  it('defaults to integration/.protection under materialization parent', () => {
    expect(getRepoProtectionRoot()).toBe(path.join(tmpWork, 'integration', '.protection'));
    expect(getProtectionRoot()).toBe(path.join(tmpWork, 'integration', '.protection'));
  });

  it('prefers cwd integration/.protection when present', () => {
    const cwdInt = path.join(tmpWork, 'integration');
    pathsUtil.getCwdIntegrationRoot.mockReturnValue(cwdInt);
    expect(getProtectionRoot()).toBe(path.join(cwdInt, '.protection'));
  });

  it('honors AIFABRIX_PROTECTION_ROOT override', () => {
    const custom = path.join(tmpWork, 'custom-protection');
    process.env.AIFABRIX_PROTECTION_ROOT = custom;
    expect(getProtectionRoot()).toBe(custom);
  });

  it('describeProtectionRoot labels integration path', () => {
    const described = describeProtectionRoot();
    expect(described.label).toBe('integration/.protection');
    expect(described.root).toBe(getProtectionRoot());
  });

  it('falls back to legacy .protection when repo folder is empty but legacy has manifests', () => {
    const legacyDir = path.join(tmpWork, '.protection');
    const repoDir = path.join(tmpWork, 'integration', '.protection');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.mkdirSync(repoDir, { recursive: true });
    const { writeHubspotCompaniesManifest } = require('./protection-test-fixtures');
    writeHubspotCompaniesManifest(legacyDir);
    expect(getProtectionRoot()).toBe(legacyDir);
    const described = describeProtectionRoot();
    expect(described.usingLegacy).toBe(true);
    expect(described.label).toBe('work/.protection (legacy)');
    expect(described.migrationHint).toMatch(/integration\/\.protection/);
  });

  it('AIFABRIX_PROTECTION_LEGACY forces legacy root', () => {
    const legacyDir = path.join(tmpWork, '.protection');
    fs.mkdirSync(legacyDir, { recursive: true });
    process.env.AIFABRIX_PROTECTION_LEGACY = '1';
    expect(getProtectionRoot()).toBe(legacyDir);
  });
});
