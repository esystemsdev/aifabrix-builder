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

  it('uses http for remote-server hostname localhost even when infra TLS on', () => {
    expect(
      computePublicUrlBaseString({
        ...base,
        remoteServer: 'https://localhost',
        infraTlsEnabled: true
      })
    ).toBe('http://localhost:8282');
  });
});

describe('computePublicUrlBaseString declarativePublicUrlsUseLocalhost (scheme)', () => {
  it('uses http for localhost when remote-server is not https', () => {
    expect(
      computePublicUrlBaseString({
        traefik: false,
        pathActive: false,
        hostTemplate: null,
        tls: true,
        developerIdRaw: 2,
        remoteServer: 'http://builder02.local',
        profile: 'local',
        listenPort: 3000,
        developerIdNum: 2,
        infraTlsEnabled: false,
        declarativeTargetAppKey: 'miso-controller',
        declarativeCurrentAppKey: 'miso-controller',
        declarativePublicUrlsUseLocalhost: true
      })
    ).toBe('http://localhost:3210');
  });

  it('uses http for localhost when infraTlsEnabled true (loopback never https)', () => {
    expect(
      computePublicUrlBaseString({
        traefik: false,
        pathActive: false,
        hostTemplate: null,
        tls: true,
        developerIdRaw: 2,
        remoteServer: 'https://builder02.local',
        profile: 'local',
        listenPort: 3000,
        developerIdNum: 2,
        infraTlsEnabled: true,
        declarativeTargetAppKey: 'miso-controller',
        declarativeCurrentAppKey: 'miso-controller',
        declarativePublicUrlsUseLocalhost: true
      })
    ).toBe('http://localhost:3210');
  });
});

describe('computePublicUrlBaseString (localhost without remote)', () => {
  it('uses http when infraTlsEnabled true (no TLS to loopback)', () => {
    expect(
      computePublicUrlBaseString({
        traefik: false,
        pathActive: false,
        hostTemplate: null,
        tls: true,
        developerIdRaw: 2,
        remoteServer: null,
        profile: 'docker',
        listenPort: 3000,
        developerIdNum: 2,
        infraTlsEnabled: true,
        declarativeTargetAppKey: 'app',
        declarativeCurrentAppKey: 'app',
        declarativePublicUrlsUseLocalhost: false
      })
    ).toBe('http://localhost:3200');
  });
});

describe('computePublicUrlBaseString (Traefik front-door host authority)', () => {
  it('uses http when tlsEnabled (infra) is false regardless of frontDoor tls hint', () => {
    expect(
      computePublicUrlBaseString({
        traefik: true,
        pathActive: true,
        hostTemplate: 'dev06.builder02.local',
        tls: true,
        developerIdRaw: '06',
        remoteServer: 'https://builder02.local',
        profile: 'docker',
        listenPort: 3000,
        developerIdNum: 6,
        infraTlsEnabled: false,
        declarativeTargetAppKey: 'miso-controller',
        declarativeCurrentAppKey: 'miso-controller'
      })
    ).toBe('http://dev06.builder02.local');
  });

  it('uses https when tlsEnabled (infra) is true even if frontDoorRouting.tls is false', () => {
    expect(
      computePublicUrlBaseString({
        traefik: true,
        pathActive: true,
        hostTemplate: 'dev06.builder02.local',
        tls: false,
        developerIdRaw: '06',
        remoteServer: 'https://builder02.local',
        profile: 'docker',
        listenPort: 3000,
        developerIdNum: 6,
        infraTlsEnabled: true,
        declarativeTargetAppKey: 'miso-controller',
        declarativeCurrentAppKey: 'miso-controller'
      })
    ).toBe('https://dev06.builder02.local');
  });

  it('skips Traefik host when host uses ${REMOTE_HOST} but remote-server is unset (localhost + docker port)', () => {
    expect(
      computePublicUrlBaseString({
        traefik: true,
        pathActive: true,
        hostTemplate: '${DEV_USERNAME}.${REMOTE_HOST}',
        tls: true,
        developerIdRaw: '06',
        remoteServer: null,
        profile: 'docker',
        listenPort: 3000,
        developerIdNum: 6,
        infraTlsEnabled: true,
        declarativeTargetAppKey: 'miso-controller',
        declarativeCurrentAppKey: 'miso-controller',
        declarativePublicUrlsUseLocalhost: false
      })
    ).toBe('http://localhost:3600');
  });

  it('skips Traefik host when host uses ${REMOTE_HOST} but remote-server is unset (localhost + local port)', () => {
    expect(
      computePublicUrlBaseString({
        traefik: true,
        pathActive: true,
        hostTemplate: '${DEV_USERNAME}.${REMOTE_HOST}',
        tls: true,
        developerIdRaw: '06',
        remoteServer: '',
        profile: 'local',
        listenPort: 3000,
        developerIdNum: 6,
        infraTlsEnabled: true,
        declarativeTargetAppKey: 'miso-controller',
        declarativeCurrentAppKey: 'miso-controller',
        declarativePublicUrlsUseLocalhost: false
      })
    ).toBe('http://localhost:3610');
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
