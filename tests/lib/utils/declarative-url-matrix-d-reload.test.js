/**
 * Plan 122 Matrix D — `aifabrix run --reload` / envOutputPath parity with docker-profile url:// expansions.
 * Golden rows reference `.cursor/plans/122-declarative_url_resolution.plan.md` § Matrix D.
 */

'use strict';

// Other suites in the same worker use jest.mock('fs'); real fs is required for
// application.yaml + urls.local.yaml refresh during url:// expansion.
jest.unmock('fs');

const fs = require('node:fs');
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

describe('Matrix D (plan 122) — reload uses docker-profile url:// expansions', () => {
  let tmp;
  let fakeHome;
  let fakeProject;
  let variablesPath;

  const envBody = `MISO_CLIENTID=miso-controller-dev-dataplane
PUBLIC_URL=url://public
INTERNAL_URL=url://internal
`;

  const envBodyTst = `MISO_CLIENTID=miso-controller-tst-dataplane
PUBLIC_URL=url://public
INTERNAL_URL=url://internal
`;

  const envBodyPro = `MISO_CLIENTID=miso-controller-pro-dataplane
PUBLIC_URL=url://public
INTERNAL_URL=url://internal
`;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'url-mxd-'));
    fakeHome = path.join(tmp, 'home');
    fakeProject = path.join(tmp, 'proj');
    fs.mkdirSync(fakeHome, { recursive: true });
    pathsUtil.getAifabrixHome.mockReturnValue(fakeHome);
    pathsUtil.getProjectRoot.mockReturnValue(fakeProject);
    const appDir = path.join(fakeProject, 'builder', 'dataplane');
    fs.mkdirSync(appDir, { recursive: true });
    variablesPath = path.join(appDir, 'application.yaml');
    fs.writeFileSync(
      variablesPath,
      `app:
  key: dataplane
port: 3001
frontDoorRouting:
  pattern: /data/*
`,
      'utf8'
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    jest.clearAllMocks();
  });

  async function expand(content, overrides) {
    const base = {
      currentAppKey: 'dataplane',
      variablesPath,
      developerIdRaw: '01'
    };
    const out = await expandDeclarativeUrlsInEnvContent(content, { ...base, ...overrides });
    return parseSimpleEnvMap(out);
  }

  it('D1: docker profile matches Matrix A1 (remote + scoped dev); local profile differs on internal', async() => {
    const dockerMap = await expand(envBody, {
      profile: 'docker',
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: true,
      remoteServer: 'https://builder02.local'
    });
    expect(dockerMap.PUBLIC_URL).toBe('https://builder02.local/dev/data');
    expect(dockerMap.INTERNAL_URL).toBe('http://dataplane:3001');

    const localMap = await expand(envBody, {
      profile: 'local',
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: true,
      remoteServer: 'https://builder02.local'
    });
    expect(localMap.PUBLIC_URL).toBe('https://builder02.local/dev/data');
    expect(localMap.INTERNAL_URL).toBe('https://builder02.local/dev/data');
    expect(localMap.INTERNAL_URL).not.toBe(dockerMap.INTERNAL_URL);
  });

  it('D1 parity: simulated reload output (docker) is stable and is what host envOutputPath must match', async() => {
    const a = await expand(envBody, {
      profile: 'docker',
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: true,
      remoteServer: 'https://builder02.local'
    });
    const b = await expand(envBody, {
      profile: 'docker',
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: true,
      remoteServer: 'https://builder02.local'
    });
    expect(a.PUBLIC_URL).toBe(b.PUBLIC_URL);
    expect(a.INTERNAL_URL).toBe(b.INTERNAL_URL);
  });

  it('D2: useEnvironmentScopedResources false → Matrix C1 docker shape', async() => {
    const m = await expand(envBody, {
      profile: 'docker',
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: true,
      remoteServer: 'https://builder02.local'
    });
    expect(m.PUBLIC_URL).toBe('https://builder02.local/data');
    expect(m.INTERNAL_URL).toBe('http://dataplane:3001');
  });

  it('D3: app environmentScopedResources false → Matrix C1 docker', async() => {
    const m = await expand(envBody, {
      profile: 'docker',
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: false,
      remoteServer: 'https://builder02.local'
    });
    expect(m.PUBLIC_URL).toBe('https://builder02.local/data');
  });

  it('D4: no remote-server → Matrix A3 docker (localhost published port)', async() => {
    const m = await expand(envBody, {
      profile: 'docker',
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: true,
      remoteServer: null
    });
    expect(m.PUBLIC_URL).toBe('http://localhost:3101/dev/data');
    expect(m.INTERNAL_URL).toBe('http://dataplane:3001');
  });

  it('D6: tst derived env key → Matrix B1 public docker', async() => {
    const m = await expand(envBodyTst, {
      profile: 'docker',
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: true,
      remoteServer: 'https://builder02.local'
    });
    expect(m.PUBLIC_URL).toBe('https://dev01.builder02.local/tst/data');
    expect(m.INTERNAL_URL).toBe('http://dataplane:3001');
  });

  it('D7: pro derived env key → no /dev prefix (Matrix C1 public with remote)', async() => {
    const m = await expand(envBodyPro, {
      profile: 'docker',
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: true,
      remoteServer: 'https://builder02.local'
    });
    expect(m.PUBLIC_URL).toBe('https://builder02.local/data');
    expect(m.INTERNAL_URL).toBe('http://dataplane:3001');
  });
});
