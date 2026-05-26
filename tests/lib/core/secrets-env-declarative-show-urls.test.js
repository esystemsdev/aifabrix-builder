/**
 * @fileoverview resolveDeclarativeShowUrlsForApp (app show URL parity with .env)
 */

'use strict';

jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  getRemoteServer: jest.fn(),
  getDeveloperId: jest.fn(),
  getTlsEnabled: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../../../lib/core/config');
const pathsUtil = require('../../../lib/utils/paths');
const { resolveDeclarativeShowUrlsForApp } = require('../../../lib/core/secrets-env-declarative-expand');

describe('resolveDeclarativeShowUrlsForApp', () => {
  let tmp;
  let fakeHome;
  let fakeProject;
  /** @type {jest.SpyInstance[]} */
  let pathSpies;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'show-url-'));
    fakeHome = path.join(tmp, 'home');
    fakeProject = path.join(tmp, 'proj');
    fs.mkdirSync(fakeHome, { recursive: true });
    pathSpies = [
      jest.spyOn(pathsUtil, 'getAifabrixHome').mockReturnValue(fakeHome),
      jest.spyOn(pathsUtil, 'getConfigDirForPaths').mockReturnValue(fakeHome),
      jest.spyOn(pathsUtil, 'getProjectRoot').mockReturnValue(fakeProject),
      jest.spyOn(pathsUtil, 'getBuilderRoot').mockReturnValue(path.join(fakeProject, 'builder'))
    ];
    config.getTlsEnabled.mockResolvedValue(false);
    config.getDeveloperId.mockResolvedValue(2);
    config.getRemoteServer.mockResolvedValue('https://builder02.local');
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

  function writeMisoApp(opts = {}) {
    const originOnly = opts.internalDockerUseOriginOnly !== false;
    const dir = path.join(fakeProject, 'builder', 'miso-controller');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'application.yaml'),
      [
        'port: 3000',
        'frontDoorRouting:',
        '  pattern: /miso/*',
        '  enabled: true',
        `  internalDockerUseOriginOnly: ${originOnly}`,
        '  host: ${DEV_USERNAME}.${REMOTE_HOST}',
        '  tls: false'
      ].join('\n'),
      'utf8'
    );
  }

  it('matches Traefik public URL when proxy on (same stack as .env)', async() => {
    writeMisoApp();
    config.getConfig.mockResolvedValue({
      traefik: true,
      useEnvironmentScopedResources: false,
      applications: { 'miso-controller': { proxy: true } }
    });
    const appPath = path.join(fakeProject, 'builder', 'miso-controller');
    const variablesPath = path.join(appPath, 'application.yaml');
    const urls = await resolveDeclarativeShowUrlsForApp('miso-controller', appPath, variablesPath, 'docker');
    expect(urls.publicUrl).toBe('http://dev02.builder02.local/miso');
    expect(urls.internalUrl).toBe('http://miso-controller:3000');
  });

  it('matches localhost public URL when proxy off', async() => {
    writeMisoApp({ internalDockerUseOriginOnly: false });
    config.getConfig.mockResolvedValue({
      traefik: true,
      useEnvironmentScopedResources: false,
      applications: { 'miso-controller': { proxy: false } }
    });
    const appPath = path.join(fakeProject, 'builder', 'miso-controller');
    const variablesPath = path.join(appPath, 'application.yaml');
    const urls = await resolveDeclarativeShowUrlsForApp('miso-controller', appPath, variablesPath, 'docker');
    expect(urls.publicUrl).toBe('http://localhost:3200');
    expect(urls.internalUrl).toBe('http://miso-controller:3000');
  });

  it('appends pattern to docker internal URL when proxy on and internalDockerUseOriginOnly false', async() => {
    writeMisoApp({ internalDockerUseOriginOnly: false });
    config.getConfig.mockResolvedValue({
      traefik: true,
      useEnvironmentScopedResources: false,
      applications: { 'miso-controller': { proxy: true } }
    });
    const appPath = path.join(fakeProject, 'builder', 'miso-controller');
    const variablesPath = path.join(appPath, 'application.yaml');
    const urls = await resolveDeclarativeShowUrlsForApp('miso-controller', appPath, variablesPath, 'docker');
    expect(urls.publicUrl).toBe('http://dev02.builder02.local/miso');
    expect(urls.internalUrl).toBe('http://miso-controller:3000/miso');
  });
});
