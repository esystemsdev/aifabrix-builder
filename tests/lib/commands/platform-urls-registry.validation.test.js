/**
 * Validation tests: urls.local.yaml materialization for platform up flows.
 *
 * @fileoverview Ensures refreshUrlsLocalRegistryForCurrentProject writes urls.local.yaml beside
 *   config.yaml (getConfigDirForPaths) from builder/ and packages/ application.yaml.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

jest.unmock('../../../lib/internal/fs-real-sync');

const fs = jest.requireActual('node:fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

jest.mock('../../../lib/utils/paths', () => ({
  ...jest.requireActual('../../../lib/utils/paths'),
  getAifabrixHome: jest.fn(),
  getConfigDirForPaths: jest.fn(),
  getProjectRoot: jest.fn(),
  getBuilderRoot: jest.fn(),
  getSystemBuilderRoot: jest.fn(),
  getIntegrationBuilderBaseDir: jest.fn()
}));

const pathsUtil = require('../../../lib/utils/paths');
const { refreshUrlsLocalRegistryForCurrentProject } = require('../../../lib/commands/up-common');

describe('platform urls.local registry (validation)', () => {
  let tmp;
  let fakeHome;
  let fakeConfigDir;
  let fakeProject;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'af-platform-urls-'));
    fakeHome = path.join(tmp, 'aifabrix-home');
    fakeConfigDir = path.join(tmp, 'config-dir');
    fakeProject = path.join(tmp, 'workspace');
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.mkdirSync(fakeConfigDir, { recursive: true });
    fs.mkdirSync(path.join(fakeProject, 'builder', 'keycloak'), { recursive: true });
    fs.mkdirSync(path.join(fakeProject, 'builder', 'miso-controller'), { recursive: true });
    pathsUtil.getAifabrixHome.mockReset();
    pathsUtil.getConfigDirForPaths.mockReset();
    pathsUtil.getProjectRoot.mockReset();
    pathsUtil.getBuilderRoot.mockReset();
    pathsUtil.getSystemBuilderRoot.mockReset();
    pathsUtil.getIntegrationBuilderBaseDir.mockReset();
    pathsUtil.getAifabrixHome.mockReturnValue(fakeHome);
    pathsUtil.getConfigDirForPaths.mockReturnValue(fakeConfigDir);
    pathsUtil.getProjectRoot.mockReturnValue(fakeProject);
    pathsUtil.getBuilderRoot.mockImplementation(() => path.join(fakeProject, 'builder'));
    pathsUtil.getIntegrationBuilderBaseDir.mockReturnValue(fakeProject);
    pathsUtil.getSystemBuilderRoot.mockImplementation(() => path.join(fakeHome, 'system-builder'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('writes urls.local.yaml under aifabrix home with ports from builder keycloak and miso-controller', () => {
    fs.writeFileSync(
      path.join(fakeProject, 'builder', 'keycloak', 'application.yaml'),
      `port: 8180
app:
  key: keycloak
`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml'),
      `port: 3100
app:
  key: miso-controller
`,
      'utf8'
    );

    refreshUrlsLocalRegistryForCurrentProject();

    const regPath = path.join(fakeConfigDir, 'urls.local.yaml');
    expect(fs.existsSync(regPath)).toBe(true);
    const doc = yaml.load(fs.readFileSync(regPath, 'utf8'));
    expect(doc['keycloak-port']).toBe(8180);
    expect(doc['miso-controller-port']).toBe(3100);
    expect(doc['keycloak-pattern']).toBeDefined();
    expect(doc['miso-controller-pattern']).toBeDefined();
  });

  it('merges packages/*/application.yaml into the same registry file', () => {
    const pkgDir = path.join(fakeProject, 'packages', 'mono-api');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'application.yaml'),
      `port: 9200
app:
  key: mono-api
`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(fakeProject, 'builder', 'keycloak', 'application.yaml'),
      `port: 8180
app:
  key: keycloak
`,
      'utf8'
    );

    refreshUrlsLocalRegistryForCurrentProject();

    const doc = yaml.load(fs.readFileSync(path.join(fakeConfigDir, 'urls.local.yaml'), 'utf8'));
    expect(doc['mono-api-port']).toBe(9200);
    expect(doc['keycloak-port']).toBe(8180);
  });
});
