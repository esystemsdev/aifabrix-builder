/**
 * @fileoverview computePublicUrlBaseString — remote-server scheme vs infra TLS (plan 122)
 */

'use strict';

const {
  computePublicUrlBaseString,
  resolveHostPortForDeclarativePublic
} = require('../../../lib/utils/url-declarative-public-base');

describe('computePublicUrlBaseString (remote without Traefik)', () => {
  const base = {
    traefik: false,
    hostTemplate: null,
    tls: true,
    developerIdRaw: 0,
    profile: 'docker',
    listenPort: 8082,
    developerIdNum: 2,
    remoteServer: 'https://builder02.local'
  };

  it('uses http when infraTlsEnabled false even if remote-server is https:// (published port)', () => {
    expect(
      computePublicUrlBaseString({
        ...base,
        infraTlsEnabled: false
      })
    ).toBe('http://builder02.local:8282');
  });

  it('uses https when infraTlsEnabled true', () => {
    expect(
      computePublicUrlBaseString({
        ...base,
        infraTlsEnabled: true
      })
    ).toBe('https://builder02.local:8282');
  });

  it('rewrites explicit port in remote URL to http when no TLS infra', () => {
    expect(
      computePublicUrlBaseString({
        ...base,
        remoteServer: 'https://builder02.local:3000',
        infraTlsEnabled: false
      })
    ).toBe('http://builder02.local:3000');
  });

  it('keeps https explicit port when infra TLS on', () => {
    expect(
      computePublicUrlBaseString({
        ...base,
        remoteServer: 'https://builder02.local:3000',
        infraTlsEnabled: true
      })
    ).toBe('https://builder02.local:3000');
  });
});

describe('resolveHostPortForDeclarativePublic (local +10 on current app only)', () => {
  it('applies localHostPort math when target matches current app', () => {
    expect(
      resolveHostPortForDeclarativePublic({
        profile: 'local',
        listenPort: 3000,
        developerIdNum: 1,
        declarativeTargetAppKey: 'miso-controller',
        declarativeCurrentAppKey: 'miso-controller'
      })
    ).toBe(3110);
  });

  it('uses publishedHostPort math for cross-app targets', () => {
    expect(
      resolveHostPortForDeclarativePublic({
        profile: 'local',
        listenPort: 8082,
        developerIdNum: 1,
        declarativeTargetAppKey: 'keycloak',
        declarativeCurrentAppKey: 'miso-controller'
      })
    ).toBe(8182);
  });

  it('docker profile ignores declarative app keys', () => {
    expect(
      resolveHostPortForDeclarativePublic({
        profile: 'docker',
        listenPort: 8082,
        developerIdNum: 1,
        declarativeTargetAppKey: 'keycloak',
        declarativeCurrentAppKey: 'miso-controller'
      })
    ).toBe(8182);
  });
});
