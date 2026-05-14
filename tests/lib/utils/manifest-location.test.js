/**
 * @fileoverview manifest-location (plan 141 cwd + system builder tiers)
 */

'use strict';

const fs = jest.requireActual('node:fs');
const os = require('os');
const path = require('path');

jest.mock('../../../lib/utils/aifabrix-runtime-config-dir', () => {
  const pathMod = require('path');
  return {
    getAifabrixRuntimeConfigDir: jest.fn(),
    resolveAifabrixHomeLikePath: (x) => pathMod.resolve(String(x))
  };
});

describe('manifest-location', () => {
  let tmp;
  let proj;
  let cfgDir;
  /** @type {string|undefined} */
  let savedAifabrixConfig;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    savedAifabrixConfig = process.env.AIFABRIX_CONFIG;
    delete process.env.AIFABRIX_CONFIG;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afb-mloc-'));
    proj = path.join(tmp, 'project');
    cfgDir = path.join(tmp, 'aifabrix-cfg');
    fs.mkdirSync(proj, { recursive: true });
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}\n');
    const rtMod = require('../../../lib/utils/aifabrix-runtime-config-dir');
    rtMod.getAifabrixRuntimeConfigDir.mockReturnValue(cfgDir);
    process.env.AIFABRIX_HOME = cfgDir;
    delete process.env.AIFABRIX_WORK;
    delete process.env.AIFABRIX_BUILDER_DIR;
    global.PROJECT_ROOT = proj;
    jest.spyOn(process, 'cwd').mockReturnValue(proj);
  });

  afterEach(() => {
    delete process.env.AIFABRIX_HOME;
    if (savedAifabrixConfig === undefined) {
      delete process.env.AIFABRIX_CONFIG;
    } else {
      process.env.AIFABRIX_CONFIG = savedAifabrixConfig;
    }
    delete global.PROJECT_ROOT;
    process.cwd.mockRestore?.();
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    } catch {
      /* best-effort: occasional ENOTEMPTY under parallel test load */
    }
  });

  function loadManifestLocation() {
    const paths = require('../../../lib/utils/paths');
    paths.clearProjectRootCache();
    return require('../../../lib/utils/manifest-location');
  }

  it('returns cwd-integration tier when application.json exists under cwd/integration/<key>', () => {
    const intDir = path.join(proj, 'integration', 'hubspot');
    fs.mkdirSync(intDir, { recursive: true });
    fs.writeFileSync(
      path.join(intDir, 'application.json'),
      JSON.stringify({ app: { type: 'external', name: 'hubspot' } }, null, 2)
    );
    const ml = loadManifestLocation();
    const r = ml.resolveApplicationManifestPathSync({ targetKey: 'hubspot', cwd: proj });
    expect(r).toEqual({
      absolutePath: path.resolve(intDir),
      tier: 'cwd-integration',
      appKey: 'hubspot'
    });
  });

  it('returns cwd-builder tier when application.yaml exists under cwd/builder/<app>', () => {
    const appDir = path.join(proj, 'builder', 'my-app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'application.yaml'), 'app:\n  type: node\n');
    const ml = loadManifestLocation();
    const r = ml.resolveApplicationManifestPathSync({ targetKey: 'my-app', cwd: proj });
    expect(r).toEqual({
      absolutePath: path.resolve(appDir),
      tier: 'cwd-builder',
      appKey: 'my-app'
    });
  });

  it('returns cwd-integration tier when config exists under cwd/integration/<key>', () => {
    const intDir = path.join(proj, 'integration', 'crm');
    fs.mkdirSync(intDir, { recursive: true });
    fs.writeFileSync(path.join(intDir, 'application.yaml'), 'app:\n  type: external\n');
    const ml = loadManifestLocation();
    const r = ml.resolveApplicationManifestPathSync({ targetKey: 'crm', cwd: proj });
    expect(r.tier).toBe('cwd-integration');
    expect(r.absolutePath).toBe(path.resolve(intDir));
  });

  it('returns system-builder tier under aifabrix-work when work and config-dir both have builder copies', () => {
    const workRoot = path.join(tmp, 'monorepo');
    const workDp = path.join(workRoot, 'builder', 'dataplane');
    fs.mkdirSync(workDp, { recursive: true });
    fs.writeFileSync(
      path.join(workDp, 'application.yaml'),
      'app:\n  type: node\n'
    );
    const cfgDp = path.join(cfgDir, 'builder', 'dataplane');
    fs.mkdirSync(cfgDp, { recursive: true });
    fs.writeFileSync(path.join(cfgDp, 'application.yaml'), 'app:\n  type: node\n');
    process.env.AIFABRIX_WORK = workRoot;
    jest.spyOn(process, 'cwd').mockReturnValue(path.join(tmp, 'unrelated-cwd'));
    global.PROJECT_ROOT = proj;
    const ml = loadManifestLocation();
    const r = ml.resolveApplicationManifestPathSync({ targetKey: 'dataplane', cwd: process.cwd() });
    expect(r.tier).toBe('system-builder');
    expect(r.absolutePath).toBe(path.resolve(workDp));
    delete process.env.AIFABRIX_WORK;
  });

  it('returns system-builder under aifabrix-work when only work builder has a copy', () => {
    const workRoot = path.join(tmp, 'work-only-platform');
    const dp = path.join(workRoot, 'builder', 'dataplane');
    fs.mkdirSync(dp, { recursive: true });
    fs.writeFileSync(path.join(dp, 'application.yaml'), 'app:\n  type: node\n');
    process.env.AIFABRIX_WORK = workRoot;
    jest.spyOn(process, 'cwd').mockReturnValue(path.join(tmp, 'unrelated-cwd'));
    global.PROJECT_ROOT = proj;
    const ml = loadManifestLocation();
    const r = ml.resolveApplicationManifestPathSync({ targetKey: 'dataplane', cwd: process.cwd() });
    expect(r).toEqual({
      absolutePath: path.resolve(dp),
      tier: 'system-builder',
      appKey: 'dataplane'
    });
    delete process.env.AIFABRIX_WORK;
  });

  it('returns system-builder under aifabrix-home when work unset and cwd has no builder copy', () => {
    const dp = path.join(cfgDir, 'builder', 'dataplane');
    fs.mkdirSync(dp, { recursive: true });
    fs.writeFileSync(path.join(dp, 'application.yaml'), 'app:\n  type: node\n');
    const ml = loadManifestLocation();
    const r = ml.resolveApplicationManifestPathSync({ targetKey: 'dataplane', cwd: proj });
    expect(r.tier).toBe('system-builder');
    expect(r.absolutePath).toBe(path.resolve(dp));
  });

  it('prefers cwd-builder over system-builder when both exist', () => {
    const cwdDp = path.join(proj, 'builder', 'dataplane');
    fs.mkdirSync(cwdDp, { recursive: true });
    fs.writeFileSync(path.join(cwdDp, 'application.yaml'), 'app:\n  type: node\n');
    const sysDp = path.join(cfgDir, 'builder', 'dataplane');
    fs.mkdirSync(sysDp, { recursive: true });
    fs.writeFileSync(path.join(sysDp, 'application.yaml'), 'app:\n  type: node\n');
    const ml = loadManifestLocation();
    const r = ml.resolveApplicationManifestPathSync({ targetKey: 'dataplane', cwd: proj });
    expect(r.tier).toBe('cwd-builder');
    expect(r.absolutePath).toBe(path.resolve(cwdDp));
  });

  it('getSystemPlatformMaterializationParent follows AIFABRIX_WORK when set', () => {
    const workRoot = path.join(tmp, 'work-for-platform');
    fs.mkdirSync(workRoot, { recursive: true });
    process.env.AIFABRIX_WORK = workRoot;
    const p = require('../../../lib/utils/paths');
    p.clearProjectRootCache();
    expect(p.getSystemPlatformMaterializationParent()).toBe(path.resolve(workRoot));
    expect(p.getSystemBuilderRoot()).toBe(path.join(path.resolve(workRoot), 'builder'));
    delete process.env.AIFABRIX_WORK;
  });

  it('does not resolve Tier 2 to a sibling repo under aifabrix-work (only work/builder/<key>)', () => {
    const workspaceRoot = path.join(tmp, 'mono-sibling');
    const training = path.join(workspaceRoot, 'aifabrix-training');
    const miso = path.join(workspaceRoot, 'aifabrix-miso');
    fs.mkdirSync(training, { recursive: true });
    fs.writeFileSync(path.join(training, 'package.json'), '{}\n');
    const misoDp = path.join(miso, 'builder', 'dataplane');
    fs.mkdirSync(misoDp, { recursive: true });
    fs.writeFileSync(path.join(misoDp, 'application.yaml'), 'app:\n  type: node\n');
    process.env.AIFABRIX_WORK = workspaceRoot;
    jest.spyOn(process, 'cwd').mockReturnValue(training);
    global.PROJECT_ROOT = proj;
    const ml = loadManifestLocation();
    expect(ml.resolveApplicationManifestPathSync({ targetKey: 'dataplane', cwd: training })).toBeNull();
    delete process.env.AIFABRIX_WORK;
  });

  it('returns null when nothing matches', () => {
    const ml = loadManifestLocation();
    expect(ml.resolveApplicationManifestPathSync({ targetKey: 'missing-app-xyz', cwd: proj })).toBeNull();
  });

  it('returns system-builder tier for non-platform app under material builder', () => {
    const appDir = path.join(cfgDir, 'builder', 'internal-svc');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'application.yaml'), 'app:\n  type: node\n');
    const ml = loadManifestLocation();
    const r = ml.resolveApplicationManifestPathSync({
      targetKey: 'internal-svc',
      cwd: path.join(tmp, 'no-manifest-here')
    });
    expect(r).toEqual({
      absolutePath: path.resolve(appDir),
      tier: 'system-builder',
      appKey: 'internal-svc'
    });
  });
});
