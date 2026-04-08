/**
 * Plan 124 declarative URL truth table — pathPrefix × pathActive × traefik × profile.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/paths', () => ({
  ...jest.requireActual('../../../lib/utils/paths'),
  getAifabrixHome: jest.fn(),
  getProjectRoot: jest.fn()
}));

const pathsUtil = require('../../../lib/utils/paths');
const {
  expandDeclarativeUrlsInEnvContent,
  parseSimpleEnvMap
} = require('../../../lib/utils/url-declarative-resolve');
const {
  computePathActive,
  computeDeclarativePathPrefix
} = require('../../../lib/utils/url-declarative-url-flags');

describe('url-declarative-url-flags (plan 124)', () => {
  it('computePathActive requires traefik and enabled === true', () => {
    expect(computePathActive(false, true)).toBe(false);
    expect(computePathActive(true, false)).toBe(false);
    expect(computePathActive(true, true)).toBe(true);
    expect(computePathActive(true, undefined)).toBe(false);
  });

  it('computeDeclarativePathPrefix is empty when traefik off even if scoped', () => {
    expect(computeDeclarativePathPrefix(false, true, true, 'dev')).toBe('');
    expect(computeDeclarativePathPrefix(false, true, true, 'tst')).toBe('');
  });

  it('computeDeclarativePathPrefix delegates to Plan 117 when traefik on', () => {
    expect(computeDeclarativePathPrefix(true, true, true, 'dev')).toBe('/dev');
    expect(computeDeclarativePathPrefix(true, true, true, 'tst')).toBe('/tst');
    expect(computeDeclarativePathPrefix(true, true, true, 'pro')).toBe('');
  });
});

describe('plan 124 matrix — expandDeclarativeUrlsInEnvContent', () => {
  let tmp;
  let fakeProject;

  const remote = 'https://remote.example:9000';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'url124-'));
    fakeProject = path.join(tmp, 'proj');
    fs.mkdirSync(fakeProject, { recursive: true });
    pathsUtil.getAifabrixHome.mockReturnValue(path.join(tmp, 'home'));
    pathsUtil.getProjectRoot.mockReturnValue(fakeProject);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    jest.clearAllMocks();
  });

  function writeApp(name, yaml) {
    const dir = path.join(fakeProject, 'builder', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'application.yaml'), yaml, 'utf8');
  }

  /**
   * @param {Record<string, unknown>} ctxExtra
   * @param {string} clientLine
   */
  async function expandPublic(ctxExtra, clientLine = 'MISO_CLIENTID=miso-controller-dev-app124') {
    writeApp(
      'app124',
      `port: 8080
environmentScopedResources: true
frontDoorRouting:
  pattern: /auth/*
  enabled: true
  host: ingress124.test
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'app124', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `${clientLine}
P=url://public
`,
      {
        profile: 'docker',
        currentAppKey: 'app124',
        variablesPath,
        remoteServer: remote,
        developerIdRaw: 0,
        infraTlsEnabled: false,
        useEnvironmentScopedResources: true,
        appEnvironmentScopedResources: true,
        ...ctxExtra
      }
    );
    return parseSimpleEnvMap(out).P;
  }

  it('scoped + traefik + pathActive + dev → /dev + pattern', async() => {
    const u = await expandPublic({ traefik: true });
    expect(u).toBe('https://ingress124.test/dev/auth');
  });

  it('scoped + traefik + pathActive + tst → /tst + pattern', async() => {
    const u = await expandPublic(
      { traefik: true },
      'MISO_CLIENTID=miso-controller-tst-app124'
    );
    expect(u).toBe('https://ingress124.test/tst/auth');
  });

  it('scoped + traefik + pathActive + pro → pattern only', async() => {
    const u = await expandPublic(
      { traefik: true },
      'MISO_CLIENTID=miso-controller-pro-app124'
    );
    expect(u).toBe('https://ingress124.test/auth');
  });

  it('scoped + traefik + pathActive false (enabled omit) + dev → /dev only on direct base', async() => {
    writeApp(
      'passive124',
      `port: 8080
environmentScopedResources: true
frontDoorRouting:
  pattern: /auth/*
  host: ignored.passive
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'passive124', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=miso-controller-dev-passive124
P=url://public
`,
      {
        profile: 'docker',
        currentAppKey: 'passive124',
        variablesPath,
        remoteServer: remote,
        developerIdRaw: 0,
        infraTlsEnabled: false,
        useEnvironmentScopedResources: true,
        appEnvironmentScopedResources: true,
        traefik: true
      }
    );
    expect(parseSimpleEnvMap(out).P).toBe('http://remote.example:9000/dev');
  });

  it('scoped config off + traefik + pathActive + dev → /auth only', async() => {
    const u = await expandPublic({
      traefik: true,
      useEnvironmentScopedResources: false
    });
    expect(u).toBe('https://ingress124.test/auth');
  });

  it('traefik off + scoped on + dev → no /dev, direct base + pattern omitted', async() => {
    const u = await expandPublic({ traefik: false });
    expect(u).toBe('http://remote.example:9000');
  });

  it('local profile: vdir-internal mirrors vdir-public when pathActive', async() => {
    writeApp(
      'v124',
      `port: 3000
frontDoorRouting:
  pattern: /x/*
  enabled: true
  host: v124.test
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'v124', 'application.yaml');
    const content = `MISO_CLIENTID=z
VP=url://vdir-public
VI=url://vdir-internal
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'local',
      currentAppKey: 'v124',
      variablesPath,
      remoteServer: remote,
      developerIdRaw: 0,
      traefik: true,
      infraTlsEnabled: false,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false
    });
    const m = parseSimpleEnvMap(out);
    expect(m.VP).toBe('/x');
    expect(m.VI).toBe('/x');
  });
});
