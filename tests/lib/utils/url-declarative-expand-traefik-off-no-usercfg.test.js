/**
 * Traefik off + remote-server in config: public url:// tokens use localhost (no userCfg).
 * With `ctx.userCfg`, root `traefik: false` also forces localhost; see
 * url-declarative-user-cfg-per-app-proxy.
 *
 * @fileoverview expandDeclarativeUrlsInEnvContent without userCfg (af setup / env resolve path)
 */

'use strict';

jest.unmock('../../../lib/internal/fs-real-sync');

const fs = require('fs');
const path = require('path');
const os = require('os');

const pathsUtil = require('../../../lib/utils/paths');
const {
  expandDeclarativeUrlsInEnvContent,
  parseSimpleEnvMap
} = require('../../../lib/utils/url-declarative-resolve');

describe('expandDeclarativeUrlsInEnvContent (traefik off, remote-server, no userCfg)', () => {
  let tmp;
  let fakeHome;
  let fakeProject;
  /** @type {jest.SpyInstance[]} */
  let pathSpies;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'url-tfnu-'));
    fakeHome = path.join(tmp, 'home');
    fakeProject = path.join(tmp, 'proj');
    fs.mkdirSync(fakeHome, { recursive: true });
    pathSpies = [
      jest.spyOn(pathsUtil, 'getAifabrixHome').mockReturnValue(fakeHome),
      jest.spyOn(pathsUtil, 'getProjectRoot').mockReturnValue(fakeProject),
      jest.spyOn(pathsUtil, 'getBuilderRoot').mockReturnValue(path.join(fakeProject, 'builder'))
    ];
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    for (const s of pathSpies || []) {
      s.mockRestore();
    }
    jest.clearAllMocks();
  });

  function writeApp(appDirName, yamlText) {
    const dir = path.join(fakeProject, 'builder', appDirName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'application.yaml'), yamlText, 'utf8');
  }

  it('expands url://public on same app to localhost published port (not remote-server host)', async() => {
    writeApp(
      'keycloak',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
  tls: false
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'keycloak', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
KC=url://public
`,
      {
        profile: 'docker',
        currentAppKey: 'keycloak',
        variablesPath,
        projectRoot: fakeProject,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: 'https://builder02.local',
        developerIdRaw: '02',
        traefik: false,
        infraTlsEnabled: true
      }
    );
    expect(parseSimpleEnvMap(out).KC).toBe('http://localhost:8282');
  });

  it('expands url://host-public to localhost origin when traefik off and remote-server set', async() => {
    writeApp(
      'keycloak',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
  tls: false
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'keycloak', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
H=url://host-public
`,
      {
        profile: 'docker',
        currentAppKey: 'keycloak',
        variablesPath,
        projectRoot: fakeProject,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: 'https://builder02.local',
        developerIdRaw: '02',
        traefik: false,
        infraTlsEnabled: false
      }
    );
    expect(parseSimpleEnvMap(out).H).toBe('http://localhost:8282');
  });

  it('cross-app url://keycloak-public from another app uses localhost when traefik off and no userCfg', async() => {
    writeApp(
      'keycloak',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
  tls: false
`
    );
    writeApp('miso-controller', 'port: 3000\n');
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
KP=url://keycloak-public
`,
      {
        profile: 'docker',
        currentAppKey: 'miso-controller',
        variablesPath,
        projectRoot: fakeProject,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: 'https://builder02.local',
        developerIdRaw: '02',
        traefik: false,
        infraTlsEnabled: false
      }
    );
    expect(parseSimpleEnvMap(out).KP).toBe('http://localhost:8282');
  });
});
