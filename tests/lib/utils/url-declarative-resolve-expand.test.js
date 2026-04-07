/**
 * @fileoverview expandDeclarativeUrlsInEnvContent + parseSimpleEnvMap (plan 122 E2E-style)
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
  parseSimpleEnvMap,
  parseUrlToken
} = require('../../../lib/utils/url-declarative-resolve');

describe('parseUrlToken', () => {
  it('parses full, host, and vdir variants (current and cross-app)', () => {
    expect(parseUrlToken('public')).toEqual({ targetKey: '', kind: 'public', surface: 'full' });
    expect(parseUrlToken('internal')).toEqual({ targetKey: '', kind: 'internal', surface: 'full' });
    expect(parseUrlToken('dataplane-public')).toEqual({
      targetKey: 'dataplane',
      kind: 'public',
      surface: 'full'
    });
    expect(parseUrlToken('miso-controller-internal')).toEqual({
      targetKey: 'miso-controller',
      kind: 'internal',
      surface: 'full'
    });
    expect(parseUrlToken('host-public')).toEqual({ targetKey: '', kind: 'public', surface: 'host' });
    expect(parseUrlToken('vdir-internal')).toEqual({ targetKey: '', kind: 'internal', surface: 'vdir' });
    expect(parseUrlToken('keycloak-host-public')).toEqual({
      targetKey: 'keycloak',
      kind: 'public',
      surface: 'host'
    });
    expect(parseUrlToken('keycloak-vdir-public')).toEqual({
      targetKey: 'keycloak',
      kind: 'public',
      surface: 'vdir'
    });
  });

  it('does not treat public-<appKey> as cross-app', () => {
    expect(parseUrlToken('public-dataplane')).toEqual({
      targetKey: '',
      kind: 'public',
      surface: 'full'
    });
  });
});

describe('parseSimpleEnvMap', () => {
  it('skips blanks and comments; takes first = as delimiter', () => {
    const raw = `
# ignore
MISO_CLIENTID=a-dev-b

FOO=bar=baz
`;
    expect(parseSimpleEnvMap(raw)).toEqual({
      MISO_CLIENTID: 'a-dev-b',
      FOO: 'bar=baz'
    });
  });

  it('returns empty for non-string', () => {
    expect(parseSimpleEnvMap(null)).toEqual({});
  });
});

describe('expandDeclarativeUrlsInEnvContent', () => {
  let tmp;
  let fakeHome;
  let fakeProject;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'url-exp-'));
    fakeHome = path.join(tmp, 'home');
    fakeProject = path.join(tmp, 'proj');
    fs.mkdirSync(fakeHome, { recursive: true });
    pathsUtil.getAifabrixHome.mockReturnValue(fakeHome);
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

  function writeApp(appDirName, yamlText) {
    const dir = path.join(fakeProject, 'builder', appDirName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'application.yaml'), yamlText, 'utf8');
  }

  it('returns content unchanged when no url://', async() => {
    const out = await expandDeclarativeUrlsInEnvContent('A=1', {
      profile: 'local',
      currentAppKey: 'x',
      variablesPath: null,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 0
    });
    expect(out).toBe('A=1');
  });

  it('resolves url://public from current app application.yaml (local profile)', async() => {
    writeApp(
      'writer',
      `port: 4000
frontDoorRouting:
  pattern: /api/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'writer', 'application.yaml');
    const content = `MISO_CLIENTID=miso-controller-dev-x
API_URL=url://public
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'local',
      currentAppKey: 'writer',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 1
    });
    // localHostPort(4000, 1) = 4110; path /api
    expect(out).toContain('API_URL=http://localhost:4110/api');
  });

  it('resolves url://other-public from registry after refresh', async() => {
    writeApp('writer', 'port: 3000\n');
    writeApp(
      'other',
      `app:
  key: other
port: 5000
frontDoorRouting:
  pattern: /odata
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'writer', 'application.yaml');
    const content = `MISO_CLIENTID=x-dev-y
U=url://other-public
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'local',
      currentAppKey: 'writer',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 0
    });
    expect(out).toContain('U=http://localhost:5010/odata');
  });

  it('resolves url://internal for docker profile to service:port', async() => {
    writeApp('dp', 'port: 3001\n');
    const variablesPath = path.join(fakeProject, 'builder', 'dp', 'application.yaml');
    const content = `MISO_CLIENTID=z
X=url://internal
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'dp',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 2
    });
    expect(out).toContain('X=http://dp:3001');
  });

  it('resolves url://vdir-public from current app pattern', async() => {
    writeApp(
      'kc',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'kc', 'application.yaml');
    const content = `MISO_CLIENTID=z
VDIR=url://vdir-public
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'local',
      currentAppKey: 'kc',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 0
    });
    expect(out).toContain('VDIR=/auth');
  });

  it('resolves url://host-public to origin without path', async() => {
    writeApp(
      'kc',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'kc', 'application.yaml');
    const content = `MISO_CLIENTID=z
H=url://host-public
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'local',
      currentAppKey: 'kc',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 0
    });
    expect(out).toMatch(/^H=http:\/\/localhost:8092$/m);
  });

  it('resolves url://keycloak-internal for docker to service:listen port plus /auth', async() => {
    writeApp(
      'keycloak',
      `port: 8080
frontDoorRouting:
  pattern: /auth/*
`
    );
    writeApp('dp', 'port: 3001\n');
    const variablesPath = path.join(fakeProject, 'builder', 'dp', 'application.yaml');
    const content = `MISO_CLIENTID=z
K=url://keycloak-internal
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'dp',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 0
    });
    expect(out).toContain('K=http://keycloak:8080/auth');
  });

  it('leaves lines without url:// and comment lines untouched', async() => {
    writeApp('w', 'port: 3000\n');
    const variablesPath = path.join(fakeProject, 'builder', 'w', 'application.yaml');
    const content = `# nope
PLAIN=url://public
`;
    const out = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'local',
      currentAppKey: 'w',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: 0
    });
    expect(out.split('\n')[0]).toBe('# nope');
    expect(out).toMatch(/^PLAIN=http:\/\/localhost:3010\/?$/m);
  });
});
