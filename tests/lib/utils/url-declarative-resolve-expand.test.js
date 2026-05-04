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
  getProjectRoot: jest.fn(),
  // refreshUrlsLocalRegistryFromBuilder also scans getBuilderRoot(); internal paths use the real
  // getProjectRoot, so a mocked project root must align or the second merge overwrites the temp tree.
  getBuilderRoot: jest.fn()
}));

const pathsUtil = require('../../../lib/utils/paths');
const {
  expandDeclarativeUrlsInEnvContent,
  expandDeclarativeUrlListValue,
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
    expect(parseUrlToken('private')).toEqual({ targetKey: '', kind: 'internal', surface: 'full' });
    expect(parseUrlToken('host-private')).toEqual({ targetKey: '', kind: 'internal', surface: 'host' });
    expect(parseUrlToken('vdir-private')).toEqual({ targetKey: '', kind: 'internal', surface: 'vdir' });
    expect(parseUrlToken('dataplane-private')).toEqual({
      targetKey: 'dataplane',
      kind: 'internal',
      surface: 'full'
    });
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

describe('expandDeclarativeUrlListValue', () => {
  it('expands each comma-separated url:// token', () => {
    const out = expandDeclarativeUrlListValue('url://host-public,url://host-private', (t) => `X:${t}`);
    expect(out).toBe('X:host-public,X:host-private');
  });

  it('leaves non-url segments unchanged', () => {
    const out = expandDeclarativeUrlListValue('url://public,http://localhost:*', (t) => `R:${t}`);
    expect(out).toBe('R:public,http://localhost:*');
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
    // localHostPort(4000, 1) = 4110; no front-door pattern without traefik + enabled
    expect(out).toContain('API_URL=http://localhost:4110');
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
    // Cross-app (other ≠ writer): no workstation +10 → published port only for dev 0
    expect(out).toContain('U=http://localhost:5000');
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

  it('resolves url://vdir-public to empty when front door is passive (no traefik or enabled not true)', async() => {
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
    expect(out).toMatch(/^VDIR=$/m);
  });

  it('resolves url://vdir-public from pattern when traefik and frontDoorRouting.enabled are true', async() => {
    writeApp(
      'kc',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
  enabled: true
  host: kc.example.test
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
      developerIdRaw: 0,
      traefik: true
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

  it('resolves url://private and url://host-private for docker to service:containerPort (Keycloak env.template)', async() => {
    writeApp(
      'kcpriv',
      `port: 8082
build:
  containerPort: 8080
frontDoorRouting:
  pattern: /auth/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'kcpriv', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
PRIVATE=url://private
PH=url://host-private
`,
      {
        profile: 'docker',
        currentAppKey: 'kcpriv',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: 'https://builder02.local',
        developerIdRaw: '02',
        traefik: false,
        infraTlsEnabled: true
      }
    );
    expect(out).toMatch(/^PRIVATE=http:\/\/kcpriv:8080$/m);
    expect(out).toMatch(/^PH=http:\/\/kcpriv:8080$/m);
  });

  it('docker url://host-public without Traefik uses manifest port (not containerPort) for localhost', async() => {
    writeApp(
      'kcPub',
      `port: 8082
build:
  containerPort: 8080
frontDoorRouting:
  pattern: /auth/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'kcPub', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
H=url://host-public
`,
      {
        profile: 'docker',
        currentAppKey: 'kcPub',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: null,
        developerIdRaw: '1',
        traefik: false,
        infraTlsEnabled: false
      }
    );
    expect(out).toMatch(/^H=http:\/\/localhost:8182$/m);
  });

  it('resolves url://keycloak-internal for docker to service:listen port (no path)', async() => {
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
    expect(out).toContain('K=http://keycloak:8080');
  });

  it('local workstation: url://internal matches url://public (same app)', async() => {
    writeApp(
      'miso-controller',
      `port: 3000
frontDoorRouting:
  pattern: /miso/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
WEB=url://public
CTRL=url://internal
`,
      {
        profile: 'local',
        currentAppKey: 'miso-controller',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: null,
        developerIdRaw: 0,
        traefik: false
      }
    );
    const m = parseSimpleEnvMap(out);
    expect(m.WEB).toBe('http://localhost:3010');
    expect(m.CTRL).toBe(m.WEB);
  });

  it('local workstation: url://keycloak-internal matches url://keycloak-public (cross-app)', async() => {
    writeApp(
      'keycloak',
      `port: 8082
build:
  containerPort: 8080
frontDoorRouting:
  pattern: /auth/*
`
    );
    writeApp('miso-controller', 'port: 3000\n');
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
KPUB=url://keycloak-public
KINT=url://keycloak-internal
`,
      {
        profile: 'local',
        currentAppKey: 'miso-controller',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: null,
        developerIdRaw: 0,
        traefik: false
      }
    );
    const m = parseSimpleEnvMap(out);
    // Cross-app: no workstation +10; dev 0 → manifest published port only
    expect(m.KPUB).toBe('http://localhost:8082');
    expect(m.KINT).toBe(m.KPUB);
  });

  it('local cross-app uses dev*100 only (+10 on current app only)', async() => {
    writeApp(
      'keycloak',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
`
    );
    writeApp(
      'miso-controller',
      `port: 3000
frontDoorRouting:
  pattern: /miso/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
CUR=url://public
KC=url://keycloak-public
`,
      {
        profile: 'local',
        currentAppKey: 'miso-controller',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: null,
        developerIdRaw: 1,
        traefik: false
      }
    );
    const m = parseSimpleEnvMap(out);
    expect(m.CUR).toBe('http://localhost:3110');
    expect(m.KC).toBe('http://localhost:8182');
  });

  it('expands comma-separated url:// on one line (MISO_ALLOWED_ORIGINS / ALLOWED_ORIGINS)', async() => {
    writeApp(
      'miso-controller',
      `port: 3000
frontDoorRouting:
  pattern: /miso/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'miso-controller', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
MISO_ALLOWED_ORIGINS=url://host-public,url://host-private
ALLOWED_ORIGINS=url://host-public,http://localhost:5173
`,
      {
        profile: 'local',
        currentAppKey: 'miso-controller',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: null,
        developerIdRaw: 0,
        traefik: false
      }
    );
    const m = parseSimpleEnvMap(out);
    const origin = 'http://localhost:3010';
    expect(m.MISO_ALLOWED_ORIGINS).toBe(`${origin},${origin}`);
    expect(m.ALLOWED_ORIGINS).toBe(`${origin},http://localhost:5173`);
  });

  it('local workstation: url://host-internal matches url://host-public', async() => {
    writeApp(
      'keycloak',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'keycloak', 'application.yaml');
    const out = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
HP=url://host-public
HI=url://host-internal
`,
      {
        profile: 'local',
        currentAppKey: 'keycloak',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: null,
        developerIdRaw: 0,
        traefik: false
      }
    );
    const m = parseSimpleEnvMap(out);
    expect(m.HP).toBe('http://localhost:8092');
    expect(m.HI).toBe(m.HP);
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

  it('Traefik host + frontDoorRouting.tls false uses https when infraTlsEnabled (up-infra --tls)', async() => {
    writeApp(
      'kc',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
  enabled: true
  host: kc.frontdoor.test
  tls: false
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'kc', 'application.yaml');
    const content = `MISO_CLIENTID=z
KC=url://public
`;
    const withTls = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'kc',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: '02',
      traefik: true,
      infraTlsEnabled: true
    });
    expect(withTls).toContain('KC=https://kc.frontdoor.test/auth');

    const noTls = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'kc',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: null,
      developerIdRaw: '02',
      traefik: true,
      infraTlsEnabled: false
    });
    expect(noTls).toContain('KC=http://kc.frontdoor.test/auth');
  });

  it('Traefik expanded frontDoor host + Plan 117 keeps /dev and /tst path prefix', async() => {
    writeApp(
      'fdscoped',
      `app:
  key: fdscoped
port: 3001
environmentScopedResources: true
frontDoorRouting:
  pattern: /data/*
  enabled: true
  host: \${DEV_USERNAME}.\${REMOTE_HOST}
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'fdscoped', 'application.yaml');
    const baseCtx = {
      profile: 'docker',
      currentAppKey: 'fdscoped',
      variablesPath,
      useEnvironmentScopedResources: true,
      appEnvironmentScopedResources: true,
      remoteServer: 'https://builder02.local',
      developerIdRaw: '01',
      traefik: true,
      infraTlsEnabled: false
    };
    const devOut = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=miso-controller-dev-fdscoped
P=url://public
`,
      baseCtx
    );
    expect(devOut).toContain('P=https://dev01.builder02.local/dev/data');

    const tstOut = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=miso-controller-tst-fdscoped
P=url://public
`,
      baseCtx
    );
    expect(tstOut).toContain('P=https://dev01.builder02.local/tst/data');
  });

  it('without Traefik, url://public keeps explicit remote port; bare host gets published docker port', async() => {
    writeApp(
      'keycloak',
      `port: 8082
frontDoorRouting:
  pattern: /auth/*
  host: ignored.without.traefik.example
  tls: false
`
    );
    const variablesPath = path.join(fakeProject, 'builder', 'keycloak', 'application.yaml');
    const content = `MISO_CLIENTID=z
KC=url://public
`;
    const httpsOut = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'keycloak',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: 'https://builder02.local:3000',
      developerIdRaw: '02',
      traefik: false,
      infraTlsEnabled: true
    });
    expect(httpsOut).toContain('KC=https://builder02.local:3000');

    const httpOut = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'keycloak',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: 'http://builder02.local:3000',
      developerIdRaw: '02',
      traefik: false,
      infraTlsEnabled: false
    });
    expect(httpOut).toContain('KC=http://builder02.local:3000');

    const bareHttps = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'keycloak',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: 'https://builder02.local',
      developerIdRaw: '02',
      traefik: false,
      infraTlsEnabled: true
    });
    expect(bareHttps).toContain('KC=https://builder02.local:8282');

    const bareNoTls = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'keycloak',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: 'https://builder02.local',
      developerIdRaw: '02',
      traefik: false,
      infraTlsEnabled: false
    });
    expect(bareNoTls).toContain('KC=http://builder02.local:8282');

    const httpsExplicitNoTls = await expandDeclarativeUrlsInEnvContent(content, {
      profile: 'docker',
      currentAppKey: 'keycloak',
      variablesPath,
      useEnvironmentScopedResources: false,
      appEnvironmentScopedResources: false,
      remoteServer: 'https://builder02.local:3000',
      developerIdRaw: '02',
      traefik: false,
      infraTlsEnabled: false
    });
    expect(httpsExplicitNoTls).toContain('KC=http://builder02.local:3000');

    const hostOnly = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
KC=url://host-public
`,
      {
        profile: 'docker',
        currentAppKey: 'keycloak',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: 'https://builder02.local',
        developerIdRaw: '02',
        traefik: false,
        infraTlsEnabled: true
      }
    );
    expect(hostOnly).toContain('KC=https://builder02.local:8282');

    const hostNoTls = await expandDeclarativeUrlsInEnvContent(
      `MISO_CLIENTID=z
KC=url://host-public
`,
      {
        profile: 'docker',
        currentAppKey: 'keycloak',
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: 'https://builder02.local',
        developerIdRaw: '02',
        traefik: false,
        infraTlsEnabled: false
      }
    );
    expect(hostNoTls).toContain('KC=http://builder02.local:8282');
  });

  describe('front-door ingress matrix (traefik × frontDoorRouting.enabled)', () => {
    /**
     * @param {'omit'|'false'|'true'} enabledMode
     * @returns {string}
     */
    function ingressAppYaml(enabledMode) {
      const lines = [
        'port: 8082',
        'frontDoorRouting:',
        '  pattern: /api/*',
        '  host: ingress.test.local'
      ];
      if (enabledMode === 'false') {
        lines.push('  enabled: false');
      } else if (enabledMode === 'true') {
        lines.push('  enabled: true');
      }
      return lines.join('\n');
    }

    const remoteExplicit = 'https://remote.test:5555';

    /**
     * @param {string} appKey
     * @param {string} yamlText
     * @param {string} envBody
     * @param {Record<string, unknown>} ctxExtra
     * @returns {Promise<string>}
     */
    async function expandFor(appKey, yamlText, envBody, ctxExtra) {
      writeApp(appKey, yamlText);
      const variablesPath = path.join(fakeProject, 'builder', appKey, 'application.yaml');
      return expandDeclarativeUrlsInEnvContent(envBody, {
        profile: 'docker',
        currentAppKey: appKey,
        variablesPath,
        useEnvironmentScopedResources: false,
        appEnvironmentScopedResources: false,
        remoteServer: remoteExplicit,
        developerIdRaw: 0,
        ...ctxExtra
      });
    }

    describe('url://vdir-public and url://vdir-internal', () => {
      it.each([
        [false, 'omit', ''],
        [false, 'true', ''],
        [true, 'omit', ''],
        [true, 'false', ''],
        [true, 'true', '/api']
      ])(
        'vdir-public when traefik=%s and enabled=%s → %j',
        async(traefik, enabledMode, expected) => {
          const out = await expandFor(
            `vd-${traefik}-${String(enabledMode)}`,
            ingressAppYaml(enabledMode),
            `MISO_CLIENTID=z
VD=url://vdir-public
`,
            { traefik }
          );
          expect(parseSimpleEnvMap(out).VD).toBe(expected);
        }
      );

      it.each([
        [false, 'omit', ''],
        [false, 'true', ''],
        [true, 'omit', ''],
        [true, 'false', ''],
        // Plan 124: docker profile PRIVATEVDIR is always empty (even when PUBLICVDIR is /api)
        [true, 'true', '']
      ])(
        'vdir-internal docker: always empty (plan 124)',
        async(traefik, enabledMode, expected) => {
          const out = await expandFor(
            `vdint-${traefik}-${String(enabledMode)}`,
            ingressAppYaml(enabledMode),
            `MISO_CLIENTID=z
VI=url://vdir-internal
`,
            { traefik }
          );
          expect(parseSimpleEnvMap(out).VI).toBe(expected);
        }
      );
    });

    describe('url://public (full URL path segment)', () => {
      it.each([
        [false, 'omit', 'http://remote.test:5555'],
        [false, 'true', 'http://remote.test:5555'],
        // Plan 124: Traefik host only when pathActive (enabled === true); else direct remote base
        [true, 'omit', 'http://remote.test:5555'],
        [true, 'false', 'http://remote.test:5555'],
        [true, 'true', 'https://ingress.test.local/api']
      ])(
        'public when traefik=%s and enabled=%s → %s',
        async(traefik, enabledMode, expectedUrl) => {
          const out = await expandFor(
            `pub-${traefik}-${String(enabledMode)}`,
            ingressAppYaml(enabledMode),
            `MISO_CLIENTID=z
P=url://public
`,
            { traefik }
          );
          expect(parseSimpleEnvMap(out).P).toBe(expectedUrl);
        }
      );
    });

    describe('url://host-public (always origin only)', () => {
      it.each([
        [false, 'omit'],
        [false, 'true'],
        [true, 'omit'],
        [true, 'false'],
        [true, 'true']
      ])('host-public has no pattern path when traefik=%s enabled=%s', async(traefik, enabledMode) => {
        const out = await expandFor(
          `hp-${traefik}-${String(enabledMode)}`,
          ingressAppYaml(enabledMode),
          `MISO_CLIENTID=z
H=url://host-public
`,
          { traefik }
        );
        const val = parseSimpleEnvMap(out).H;
        expect(val).not.toContain('/api');
        if (traefik && enabledMode === 'true') {
          expect(val).toBe('https://ingress.test.local');
        } else {
          expect(val).toBe('http://remote.test:5555');
        }
      });
    });

    it('cross-app url://svc-vdir-public uses target application.yaml enabled + traefik', async() => {
      writeApp(
        'svc',
        `port: 9000
frontDoorRouting:
  pattern: /svc/*
  enabled: true
  host: svc.test.local
`
      );
      writeApp('client', 'port: 3000\n');
      const variablesPath = path.join(fakeProject, 'builder', 'client', 'application.yaml');
      const out = await expandDeclarativeUrlsInEnvContent(
        `MISO_CLIENTID=z
X=url://svc-vdir-public
`,
        {
          profile: 'docker',
          currentAppKey: 'client',
          variablesPath,
          useEnvironmentScopedResources: false,
          appEnvironmentScopedResources: false,
          remoteServer: remoteExplicit,
          developerIdRaw: 0,
          traefik: true
        }
      );
      expect(parseSimpleEnvMap(out).X).toBe('/svc');
    });

    it('cross-app url://svc-public includes target pattern only when traefik and target enabled', async() => {
      writeApp(
        'svcpub',
        `port: 9000
frontDoorRouting:
  pattern: /svc/*
  enabled: true
  host: svcpub.test.local
`
      );
      writeApp('clientpub', 'port: 3000\n');
      const variablesPath = path.join(fakeProject, 'builder', 'clientpub', 'application.yaml');
      const active = await expandDeclarativeUrlsInEnvContent(
        `MISO_CLIENTID=z
R=url://svcpub-public
`,
        {
          profile: 'docker',
          currentAppKey: 'clientpub',
          variablesPath,
          useEnvironmentScopedResources: false,
          appEnvironmentScopedResources: false,
          remoteServer: remoteExplicit,
          developerIdRaw: 0,
          traefik: true
        }
      );
      expect(parseSimpleEnvMap(active).R).toBe('https://svcpub.test.local/svc');

      const passive = await expandDeclarativeUrlsInEnvContent(
        `MISO_CLIENTID=z
R=url://svcpub-public
`,
        {
          profile: 'docker',
          currentAppKey: 'clientpub',
          variablesPath,
          useEnvironmentScopedResources: false,
          appEnvironmentScopedResources: false,
          remoteServer: remoteExplicit,
          developerIdRaw: 0,
          traefik: false
        }
      );
      expect(parseSimpleEnvMap(passive).R).toBe('http://remote.test:5555');
    });

    it('cross-app vdir empty when target has enabled true but traefik is off', async() => {
      writeApp(
        'svc2',
        `port: 9000
frontDoorRouting:
  pattern: /svc/*
  enabled: true
  host: svc2.test.local
`
      );
      writeApp('client2', 'port: 3000\n');
      const variablesPath = path.join(fakeProject, 'builder', 'client2', 'application.yaml');
      const out = await expandDeclarativeUrlsInEnvContent(
        `MISO_CLIENTID=z
X=url://svc2-vdir-public
`,
        {
          profile: 'docker',
          currentAppKey: 'client2',
          variablesPath,
          useEnvironmentScopedResources: false,
          appEnvironmentScopedResources: false,
          remoteServer: remoteExplicit,
          developerIdRaw: 0,
          traefik: false
        }
      );
      expect(parseSimpleEnvMap(out).X).toBe('');
    });

    it('Plan 117 /dev prefix without pattern when traefik on but frontDoorRouting.enabled false (direct base)', async() => {
      const yaml = `app:
  key: scopedx
port: 8082
environmentScopedResources: true
frontDoorRouting:
  pattern: /api/*
  enabled: false
  host: scopedx.test.local
`;
      const out = await expandFor(
        'scopedx',
        yaml,
        `MISO_CLIENTID=miso-controller-dev-scopedx
P=url://public
`,
        {
          traefik: true,
          useEnvironmentScopedResources: true,
          appEnvironmentScopedResources: true
        }
      );
      expect(parseSimpleEnvMap(out).P).toBe('http://remote.test:5555/dev');
    });

    it('url://internal local profile + remote mirrors public when ingress active', async() => {
      writeApp('locint', ingressAppYaml('true'));
      const variablesPath = path.join(fakeProject, 'builder', 'locint', 'application.yaml');
      const out = await expandDeclarativeUrlsInEnvContent(
        `MISO_CLIENTID=z
I=url://internal
`,
        {
          profile: 'local',
          currentAppKey: 'locint',
          variablesPath,
          useEnvironmentScopedResources: false,
          appEnvironmentScopedResources: false,
          remoteServer: remoteExplicit,
          developerIdRaw: 0,
          traefik: true
        }
      );
      expect(parseSimpleEnvMap(out).I).toBe('https://ingress.test.local/api');
    });

    it('url://internal local profile uses direct remote when ingress inactive (enabled omit)', async() => {
      writeApp('locint2', ingressAppYaml('omit'));
      const variablesPath = path.join(fakeProject, 'builder', 'locint2', 'application.yaml');
      const out = await expandDeclarativeUrlsInEnvContent(
        `MISO_CLIENTID=z
I=url://internal
`,
        {
          profile: 'local',
          currentAppKey: 'locint2',
          variablesPath,
          useEnvironmentScopedResources: false,
          appEnvironmentScopedResources: false,
          remoteServer: remoteExplicit,
          developerIdRaw: 0,
          traefik: true
        }
      );
      expect(parseSimpleEnvMap(out).I).toBe('http://remote.test:5555');
    });
  });
});
