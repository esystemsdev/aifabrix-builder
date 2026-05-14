/**
 * @fileoverview getBuilderPath / listBuilderAppNames for platform apps (project vs ~/.aifabrix/builder)
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

describe('paths system builder app resolution', () => {
  let tmp;
  let proj;
  let cfgDir;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afb-paths-sys-'));
    proj = path.join(tmp, 'project');
    cfgDir = path.join(tmp, 'aifabrix-cfg');
    fs.mkdirSync(proj, { recursive: true });
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}\n');
    const rtMod = require('../../../lib/utils/aifabrix-runtime-config-dir');
    rtMod.getAifabrixRuntimeConfigDir.mockReturnValue(cfgDir);
    // Align POSIX home override with mocked config dir so `getAifabrixHome()` matches runtime config
    // (same parent as `resolveSystemBuilderParentDir` expects for isolated tests).
    process.env.AIFABRIX_HOME = cfgDir;
    delete process.env.AIFABRIX_BUILDER_DIR;
    delete process.env.AIFABRIX_WORK;
    global.PROJECT_ROOT = proj;
    jest.spyOn(process, 'cwd').mockReturnValue(proj);
  });

  afterEach(() => {
    delete process.env.AIFABRIX_HOME;
    delete global.PROJECT_ROOT;
    process.cwd.mockRestore?.();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function loadPaths() {
    const paths = require('../../../lib/utils/paths');
    paths.clearProjectRootCache();
    return paths;
  }

  it('SYSTEM_BUILDER_APP_KEYS and isSystemBuilderAppName', () => {
    const paths = loadPaths();
    expect(paths.SYSTEM_BUILDER_APP_KEYS).toEqual(['keycloak', 'miso-controller', 'dataplane']);
    expect(paths.isSystemBuilderAppName('keycloak')).toBe(true);
    expect(paths.isSystemBuilderAppName('custom')).toBe(false);
  });

  it('getBuilderPath prefers project builder/keycloak when application config exists there', () => {
    const kc = path.join(proj, 'builder', 'keycloak');
    fs.mkdirSync(kc, { recursive: true });
    fs.writeFileSync(path.join(kc, 'application.yaml'), 'app:\n  key: keycloak\n');
    const paths = loadPaths();
    expect(paths.getBuilderPath('keycloak')).toBe(kc);
    expect(paths.getProjectBuilderAppPath('keycloak')).toBe(kc);
    expect(paths.getSystemBuilderRoot()).toBe(path.join(cfgDir, 'builder'));
  });

  it('getBuilderPath uses system builder when project has only an empty keycloak directory', () => {
    const kc = path.join(proj, 'builder', 'keycloak');
    fs.mkdirSync(kc, { recursive: true });
    const paths = loadPaths();
    expect(paths.getBuilderPath('keycloak')).toBe(path.join(cfgDir, 'builder', 'keycloak'));
  });

  it('getBuilderPath uses config-dir builder when project keycloak is absent', () => {
    const paths = loadPaths();
    expect(paths.getBuilderPath('keycloak')).toBe(path.join(cfgDir, 'builder', 'keycloak'));
  });

  it('getBuilderPath for non-system app uses project builder only', () => {
    const paths = loadPaths();
    expect(paths.getBuilderPath('my-service')).toBe(path.join(proj, 'builder', 'my-service'));
  });

  it('getBuilderPath for non-system app uses config/home stable base when cwd is outside project root', () => {
    const outside = path.join(tmp, 'outside-repo');
    fs.mkdirSync(outside, { recursive: true });
    process.cwd.mockReturnValue(outside);
    const paths = loadPaths();
    expect(paths.getBuilderPath('my-service')).toBe(path.join(cfgDir, 'builder', 'my-service'));
  });

  it('resolveIntegrationAppKeyFromCwd finds app when cwd is under an ancestor integration/ (cwd not under PROJECT_ROOT)', () => {
    const checkout = path.join(tmp, 'training-checkout');
    fs.mkdirSync(path.join(checkout, 'integration', 'hubspot'), { recursive: true });
    process.cwd.mockReturnValue(path.join(checkout, 'integration', 'hubspot'));
    global.PROJECT_ROOT = proj;
    const paths = loadPaths();
    expect(paths.resolveIntegrationAppKeyFromCwd()).toBe('hubspot');
  });

  it('AIFABRIX_WORK is honored when work tree has builder/ but no integration/', () => {
    const workTree = path.join(tmp, 'work-only-builder');
    fs.mkdirSync(path.join(workTree, 'builder', 'svc-a'), { recursive: true });
    process.env.AIFABRIX_WORK = workTree;
    process.cwd.mockReturnValue(path.join(tmp, 'random-cwd'));
    global.PROJECT_ROOT = proj;
    const paths = loadPaths();
    expect(paths.getBuilderPath('svc-a')).toBe(path.join(workTree, 'builder', 'svc-a'));
    delete process.env.AIFABRIX_WORK;
  });

  // Nested describe so inner beforeEach runs after the outer beforeEach that sets
  // AIFABRIX_HOME=cfgDir. Global setup.js beforeEach clears Fabrix env first; hook order
  // must not leave cfgDir as the final value before assertions.
  describe('aifabrix-home vs config dir', () => {
    let dataHome;

    beforeEach(() => {
      dataHome = path.join(tmp, 'data-home');
      fs.mkdirSync(dataHome, { recursive: true });
      process.env.AIFABRIX_HOME = dataHome;
    });

    it('getBuilderPath uses aifabrix-home when config dir is not under resolved home', () => {
      const paths = loadPaths();
      expect(paths.getSystemBuilderRoot()).toBe(path.join(dataHome, 'builder'));
      expect(paths.getBuilderPath('dataplane')).toBe(path.join(dataHome, 'builder', 'dataplane'));
    });

    it('getPrimaryUserSecretsLocalPath is under config dir when AIFABRIX_HOME differs from config', () => {
      const paths = loadPaths();
      expect(paths.getPrimaryUserSecretsLocalPath()).toBe(path.join(cfgDir, 'secrets.local.yaml'));
    });
  });

  it('getBuilderPath prefers cwd builder manifest over AIFABRIX_BUILDER_DIR for platform apps (plan 141 Tier 1)', () => {
    const alt = path.join(tmp, 'alt-builder');
    fs.mkdirSync(alt, { recursive: true });
    process.env.AIFABRIX_BUILDER_DIR = alt;
    const kc = path.join(proj, 'builder', 'keycloak');
    fs.mkdirSync(kc, { recursive: true });
    fs.writeFileSync(path.join(kc, 'application.yaml'), 'app:\n  type: node\n');
    const paths = loadPaths();
    expect(paths.getBuilderPath('keycloak')).toBe(kc);
    delete process.env.AIFABRIX_BUILDER_DIR;
  });

  it('getBuilderPath respects AIFABRIX_BUILDER_DIR', () => {
    const alt = path.join(tmp, 'alt-builder');
    fs.mkdirSync(alt, { recursive: true });
    process.env.AIFABRIX_BUILDER_DIR = alt;
    const paths = loadPaths();
    expect(paths.getBuilderPath('keycloak')).toBe(path.join(alt, 'keycloak'));
    delete process.env.AIFABRIX_BUILDER_DIR;
  });

  it('listBuilderAppNames merges project dirs and system platform dirs', () => {
    fs.mkdirSync(path.join(proj, 'builder', 'custom'), { recursive: true });
    fs.mkdirSync(path.join(cfgDir, 'builder', 'dataplane'), { recursive: true });
    const paths = loadPaths();
    expect(paths.listBuilderAppNames()).toEqual(['custom', 'dataplane']);
  });

  it('getAppPath delegates to getBuilderPath for builder apps', () => {
    const kc = path.join(proj, 'builder', 'keycloak');
    fs.mkdirSync(kc, { recursive: true });
    fs.writeFileSync(path.join(kc, 'application.yaml'), 'app:\n  key: keycloak\n');
    const paths = loadPaths();
    expect(paths.getAppPath('keycloak')).toBe(kc);
  });
});
