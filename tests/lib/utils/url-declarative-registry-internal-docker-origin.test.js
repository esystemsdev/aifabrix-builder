/**
 * `urls.local.yaml` `appKey-internalDockerUseOriginOnly` overrides declarative internal full URLs
 * when `application.yaml` is missing for the target app (registry-only port/pattern).
 *
 * @fileoverview
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/paths', () => ({
  ...jest.requireActual('../../../lib/utils/paths'),
  getAifabrixHome: jest.fn(),
  getConfigDirForPaths: jest.fn(),
  getProjectRoot: jest.fn(),
  getBuilderRoot: jest.fn()
}));

const pathsUtil = require('../../../lib/utils/paths');
const { writeUrlsLocalRegistrySync } = require('../../../lib/utils/urls-local-registry');
const { expandDeclarativeUrlsInEnvContent } = require('../../../lib/utils/url-declarative-resolve');

describe('url:// internal + urls.local internalDockerUseOriginOnly', () => {
  let tmp;
  let fakeHome;
  let fakeProject;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'url-idoo-'));
    fakeHome = path.join(tmp, 'cfg');
    fakeProject = path.join(tmp, 'proj');
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.mkdirSync(path.join(fakeProject, 'builder', 'miso-controller'), { recursive: true });
    pathsUtil.getAifabrixHome.mockReturnValue(fakeHome);
    pathsUtil.getConfigDirForPaths.mockReturnValue(fakeHome);
    pathsUtil.getProjectRoot.mockReturnValue(fakeProject);
    pathsUtil.getBuilderRoot.mockImplementation(() => path.join(fakeProject, 'builder'));
    fs.writeFileSync(
      path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml'),
      'port: 3000\n',
      'utf8'
    );
    writeUrlsLocalRegistrySync({
      'keycloak-port': 8282,
      'keycloak-pattern': '/auth/*',
      'keycloak-containerPort': 8080,
      'keycloak-internalDockerUseOriginOnly': true
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    jest.clearAllMocks();
  });

  it('omits KC relative path for docker internal URL when registry sets origin-only', async() => {
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const content = 'KEYCLOAK_INTERNAL_SERVER_URL=url://keycloak-internal\n';
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'miso-controller',
      variablesPath,
      projectRoot: fakeProject,
      excludeCwdBuilderScan: true,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 0,
      traefik: false
    });
    expect(out.trim()).toBe('KEYCLOAK_INTERNAL_SERVER_URL=http://keycloak:8080');
  });
});
