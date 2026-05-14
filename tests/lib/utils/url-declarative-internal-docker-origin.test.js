/**
 * @fileoverview internalDockerUseOriginOnly: docker internal full URLs omit ingress pattern when set.
 */

'use strict';

const { parseUrlToken } = require('../../../lib/utils/url-declarative-token-parse');
const { expandResolvedUrlToken } = require('../../../lib/utils/url-declarative-resolve-build');

function baseR(overrides = {}) {
  return {
    profile: 'docker',
    listenPort: 3000,
    publicPortBasis: 3000,
    appKey: 'miso-controller',
    currentAppKey: 'miso-controller',
    patternPath: '/miso',
    pathPrefix: '',
    remoteServer: 'https://remote.example',
    devNum: 2,
    derivedEnvKey: 'dev',
    traefik: true,
    hostTemplate: 'ingress.test',
    tls: true,
    frontDoorIngressActive: true,
    developerIdRaw: 2,
    infraTlsEnabled: true,
    internalDockerUseOriginOnly: false,
    ...overrides
  };
}

describe('expandResolvedUrlToken internal full (docker) + internalDockerUseOriginOnly', () => {
  it('omits front-door pattern when internalDockerUseOriginOnly is true', () => {
    const out = expandResolvedUrlToken(parseUrlToken('internal'), baseR({ internalDockerUseOriginOnly: true }));
    expect(out).toBe('http://miso-controller:3000');
  });

  it('keeps front-door pattern when flag is false (Keycloak-style /auth)', () => {
    const out = expandResolvedUrlToken(
      parseUrlToken('internal'),
      baseR({
        internalDockerUseOriginOnly: false,
        patternPath: '/auth',
        appKey: 'keycloak',
        listenPort: 8080,
        publicPortBasis: 8082
      })
    );
    expect(out).toBe('http://keycloak:8080/auth');
  });
});
