/**
 * @fileoverview Public URL base uses localhost when per-app proxy hint is off (--no-proxy), docker or local profile.
 */

'use strict';

const { computePublicUrlBaseString } = require('../../../lib/utils/url-declarative-public-base');

describe('computePublicUrlBaseString declarativePublicUrlsUseLocalhost', () => {
  it('uses localhost + published port (docker) when flag is true', () => {
    const base = computePublicUrlBaseString({
      traefik: false,
      pathActive: false,
      hostTemplate: null,
      tls: true,
      developerIdRaw: 2,
      remoteServer: 'https://builder02.local',
      profile: 'docker',
      listenPort: 8082,
      developerIdNum: 2,
      infraTlsEnabled: false,
      declarativeTargetAppKey: 'keycloak',
      declarativeCurrentAppKey: 'miso-controller',
      declarativePublicUrlsUseLocalhost: true
    });
    expect(base).toBe('https://localhost:8282');
  });

  it('uses localhost + local workstation port (local profile) when flag is true', () => {
    const base = computePublicUrlBaseString({
      traefik: false,
      pathActive: false,
      hostTemplate: null,
      tls: true,
      developerIdRaw: 2,
      remoteServer: 'https://builder02.local',
      profile: 'local',
      listenPort: 3000,
      developerIdNum: 2,
      infraTlsEnabled: false,
      declarativeTargetAppKey: 'miso-controller',
      declarativeCurrentAppKey: 'miso-controller',
      declarativePublicUrlsUseLocalhost: true
    });
    expect(base).toBe('https://localhost:3200');
  });

  it('keeps remote-server base when flag is false', () => {
    const base = computePublicUrlBaseString({
      traefik: false,
      pathActive: false,
      hostTemplate: null,
      tls: true,
      developerIdRaw: 2,
      remoteServer: 'https://builder02.local',
      profile: 'docker',
      listenPort: 8082,
      developerIdNum: 2,
      infraTlsEnabled: false,
      declarativeTargetAppKey: 'keycloak',
      declarativeCurrentAppKey: 'miso-controller',
      declarativePublicUrlsUseLocalhost: false
    });
    expect(base).toBe('http://builder02.local:8282');
  });
});
