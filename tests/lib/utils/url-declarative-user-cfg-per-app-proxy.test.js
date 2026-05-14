/**
 * Per-target `applications.<app>.proxy` when `ctx.userCfg` is passed (plan: af run --no-proxy for one app
 * must not force localhost public URLs for another app that still has proxy: true).
 *
 * @fileoverview
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

jest.unmock('../../../lib/internal/fs-real-sync');

const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/paths', () => ({
  ...jest.requireActual('../../../lib/utils/paths'),
  getAifabrixHome: jest.fn(),
  getProjectRoot: jest.fn(),
  getBuilderRoot: jest.fn()
}));

const pathsUtil = require('../../../lib/utils/paths');
const { expandDeclarativeUrlsInEnvContent } = require('../../../lib/utils/url-declarative-resolve');

describe('expandDeclarativeUrlsInEnvContent userCfg per-target proxy', () => {
  let tmp;
  let fakeHome;
  let fakeProject;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'url-ucfg-'));
    fakeHome = path.join(tmp, 'home');
    fakeProject = path.join(tmp, 'proj');
    fs.mkdirSync(fakeHome, { recursive: true });
    pathsUtil.getAifabrixHome.mockReturnValue(fakeHome);
    pathsUtil.getProjectRoot.mockReturnValue(fakeProject);
    pathsUtil.getBuilderRoot.mockReturnValue(path.join(fakeProject, 'builder'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    jest.clearAllMocks();
  });

  function writeApp(appDirName, yamlText) {
    const dir = path.join(fakeProject, 'builder', appDirName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'application.yaml'), yamlText, 'utf8');
  }

  it('userCfg traefik false: url://keycloak-public uses localhost even when applications.keycloak.proxy true', async() => {
    writeApp('miso-controller', 'port: 3000\n');
    writeApp('keycloak', 'port: 8282\n');
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const content = `MISO_CLIENTID=miso-controller-dev-x
KEYCLOAK_SERVER_URL=url://keycloak-public
`;
    const userCfg = {
      traefik: false,
      applications: {
        'miso-controller': { proxy: false, reload: true },
        keycloak: { proxy: true, reload: false }
      }
    };
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'miso-controller',
      variablesPath,
      projectRoot: fakeProject,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: 'builder02.local',
      developerIdRaw: 2,
      infraTlsEnabled: true,
      userCfg
    });
    expect(out).toMatch(/^KEYCLOAK_SERVER_URL=http:\/\/localhost:\d+/m);
    expect(out).not.toContain('builder02.local');
  });

  it('without userCfg keeps legacy ctx.declarativePublicUrlsUseLocalhost for all tokens', async() => {
    writeApp('miso-controller', 'port: 3000\n');
    writeApp('keycloak', 'port: 8282\n');
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const content = `KEYCLOAK_SERVER_URL=url://keycloak-public
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'miso-controller',
      variablesPath,
      projectRoot: fakeProject,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: 'builder02.local',
      developerIdRaw: 2,
      infraTlsEnabled: true,
      declarativePublicUrlsUseLocalhost: true
    });
    expect(out).toMatch(/^KEYCLOAK_SERVER_URL=http:\/\/localhost:\d+$/m);
  });

  it('local profile + applications.<app>.proxy false uses localhost for url://public (resolve/run .env)', async() => {
    writeApp('miso-controller', 'port: 3000\n');
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const content = `MISO_WEB_SERVER_URL=url://public
`;
    const userCfg = {
      traefik: true,
      applications: {
        'miso-controller': { proxy: false }
      }
    };
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'local',
      currentAppKey: 'miso-controller',
      variablesPath,
      projectRoot: fakeProject,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: 'https://builder02.local',
      developerIdRaw: 2,
      infraTlsEnabled: false,
      userCfg
    });
    expect(out).toMatch(/^MISO_WEB_SERVER_URL=http:\/\/localhost:3210/m);
    expect(out).not.toContain('builder02.local');
  });
});
