/**
 * Plan 122 golden vectors: deriveEnvKey, path prefix, url builders, matrices A/B/C excerpts.
 */

'use strict';

const { deriveEnvKeyFromClientId } = require('../../../lib/utils/derive-env-key-from-client-id');
const { computePublicUrlPathPrefix } = require('../../../lib/utils/url-public-path-prefix');
const {
  buildPublicUrlString,
  buildInternalUrlString,
  applyTstRemoteDeveloperHost,
  parseUrlToken
} = require('../../../lib/utils/url-declarative-resolve');

describe('deriveEnvKeyFromClientId', () => {
  it('scans hyphen segments end-first for dev|tst|pro|miso', () => {
    expect(deriveEnvKeyFromClientId('miso-controller-dev-dataplane', null)).toBe('dev');
    expect(deriveEnvKeyFromClientId('app-tst-foo', null)).toBe('tst');
    expect(deriveEnvKeyFromClientId('svc-pro-app', null)).toBe('pro');
    expect(deriveEnvKeyFromClientId('miso-pipeline-x', null)).toBe('miso');
  });

  it('defaults to miso when no token matches', () => {
    expect(deriveEnvKeyFromClientId('other-client-id', null)).toBe('miso');
    expect(deriveEnvKeyFromClientId('', null)).toBe('miso');
  });

  it('honors MISO_PIPELINE_ENV_KEY override', () => {
    expect(deriveEnvKeyFromClientId('miso-controller-dev-dataplane', 'tst')).toBe('tst');
  });
});

describe('computePublicUrlPathPrefix (plan 117)', () => {
  it('matches truth table', () => {
    expect(computePublicUrlPathPrefix(false, true, 'dev')).toBe('');
    expect(computePublicUrlPathPrefix(true, false, 'dev')).toBe('');
    expect(computePublicUrlPathPrefix(true, true, 'dev')).toBe('/dev');
    expect(computePublicUrlPathPrefix(true, true, 'tst')).toBe('/tst');
    expect(computePublicUrlPathPrefix(true, true, 'pro')).toBe('');
    expect(computePublicUrlPathPrefix(true, true, 'miso')).toBe('');
  });
});

describe('url-declarative-resolve helpers (matrix fixtures)', () => {
  const remote = 'https://builder02.local';
  const listen = 3001;
  const devNum = 1;
  const patternPath = '/data';

  it('Matrix A/C public docker/local without remote', () => {
    expect(
      buildPublicUrlString({
        profile: 'docker',
        listenPort: listen,
        developerIdNum: devNum,
        remoteServer: null,
        pathPrefix: '/dev',
        patternPath
      })
    ).toBe('http://localhost:3101/dev/data');
    expect(
      buildPublicUrlString({
        profile: 'local',
        listenPort: listen,
        developerIdNum: devNum,
        remoteServer: null,
        pathPrefix: '/dev',
        patternPath
      })
    ).toBe('http://localhost:3111/dev/data');
  });

  it('Matrix A1 public remote docker — no devNN subdomain for dev', () => {
    const u = buildPublicUrlString({
      profile: 'docker',
      listenPort: listen,
      developerIdNum: devNum,
      remoteServer: remote,
      pathPrefix: '/dev',
      patternPath
    });
    expect(applyTstRemoteDeveloperHost(u, remote, devNum, 'dev')).toBe('https://builder02.local/dev/data');
  });

  it('Matrix B1 public remote docker — tst uses dev01 subdomain', () => {
    const u = buildPublicUrlString({
      profile: 'docker',
      listenPort: listen,
      developerIdNum: devNum,
      remoteServer: remote,
      pathPrefix: '/tst',
      patternPath
    });
    expect(applyTstRemoteDeveloperHost(u, remote, devNum, 'tst')).toBe('https://dev01.builder02.local/tst/data');
  });

  it('Matrix B1 bare host when developer id 0', () => {
    const u = buildPublicUrlString({
      profile: 'docker',
      listenPort: listen,
      developerIdNum: 0,
      remoteServer: remote,
      pathPrefix: '/tst',
      patternPath
    });
    expect(applyTstRemoteDeveloperHost(u, remote, 0, 'tst')).toBe('https://builder02.local/tst/data');
  });

  it('Matrix A1 internal docker', () => {
    expect(
      buildInternalUrlString({
        profile: 'docker',
        listenPort: listen,
        targetAppKey: 'dataplane',
        remoteServer: remote,
        pathPrefix: '/dev',
        patternPath,
        developerIdNum: devNum,
        derivedEnvKey: 'dev'
      })
    ).toBe('http://dataplane:3001');
  });

  it('Matrix A2 internal local mirrors public with remote', () => {
    const internal = buildInternalUrlString({
      profile: 'local',
      listenPort: listen,
      targetAppKey: 'dataplane',
      remoteServer: remote,
      pathPrefix: '/dev',
      patternPath,
      developerIdNum: devNum,
      derivedEnvKey: 'dev'
    });
    expect(internal).toBe('https://builder02.local/dev/data');
  });

  it('cross-app token parsing', () => {
    expect(parseUrlToken('miso-controller-internal')).toEqual({
      targetKey: 'miso-controller',
      kind: 'internal',
      surface: 'full'
    });
  });

  it('parseUrlToken treats unknown token as public (current app)', () => {
    expect(parseUrlToken('weird')).toEqual({
      targetKey: '',
      kind: 'public',
      surface: 'full'
    });
  });

  it('applyTstRemoteDeveloperHost does not rewrite when URL origin differs from remote base', () => {
    const u = 'https://other.host/tst/x';
    expect(applyTstRemoteDeveloperHost(u, 'https://builder02.local', 1, 'tst')).toBe(u);
  });
});
