/**
 * @fileoverview computePublicUrlBaseString — remote-server scheme vs infra TLS (plan 122)
 */

'use strict';

const { computePublicUrlBaseString } = require('../../../lib/utils/url-declarative-public-base');

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
