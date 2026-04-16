/**
 * @fileoverview docker-manifest-public-port — manifest port ↔ *_HOST / *_PUBLIC_PORT pairing
 */

'use strict';

const envMap = require('../../../lib/utils/env-map');
const {
  publicPortKeyForAppKey,
  mergeDockerManifestPublishedPort,
  rewriteDockerManifestPublicPortEnvLine
} = require('../../../lib/utils/docker-manifest-public-port');

describe('docker-manifest-public-port', () => {
  const envVars = {
    KEYCLOAK_HOST: 'keycloak',
    KEYCLOAK_PORT: '8080',
    KEYCLOAK_PUBLIC_PORT: '8082'
  };

  it('publicPortKeyForAppKey pairs app.key with docker *_HOST value', () => {
    expect(publicPortKeyForAppKey(envVars, 'keycloak')).toBe('KEYCLOAK_PUBLIC_PORT');
    expect(publicPortKeyForAppKey(envVars, 'other')).toBe(null);
  });

  it('mergeDockerManifestPublishedPort sets matched *_PUBLIC_PORT from manifest port', async() => {
    const spy = jest.spyOn(envMap, 'getDeveloperIdNumber').mockResolvedValue(0);
    try {
      const vars = { ...envVars };
      await mergeDockerManifestPublishedPort(vars, {
        app: { key: 'keycloak' },
        port: 9150
      });
      expect(vars.KEYCLOAK_PUBLIC_PORT).toBe('9150');
    } finally {
      spy.mockRestore();
    }
  });

  it('rewriteDockerManifestPublicPortEnvLine fixes interpolated line', () => {
    const vars = { ...envVars, KEYCLOAK_PUBLIC_PORT: '9150' };
    const content = 'KEYCLOAK_PUBLIC_PORT=8182\nPORT=8080\n';
    const out = rewriteDockerManifestPublicPortEnvLine(content, vars, { app: { key: 'keycloak' } });
    expect(out).toMatch(/^KEYCLOAK_PUBLIC_PORT=9150$/m);
  });

  it('mergeDockerManifestPublishedPort adds dev×100 when developer id > 0', async() => {
    const spy = jest.spyOn(envMap, 'getDeveloperIdNumber').mockResolvedValue(1);
    try {
      const vars = { ...envVars };
      await mergeDockerManifestPublishedPort(vars, {
        app: { key: 'keycloak' },
        port: 9150
      });
      expect(vars.KEYCLOAK_PUBLIC_PORT).toBe('9250');
    } finally {
      spy.mockRestore();
    }
  });

  it('mergeDockerManifestPublishedPort is a no-op when no *_HOST matches app.key', async() => {
    const vars = { ...envVars };
    await mergeDockerManifestPublishedPort(vars, {
      app: { key: 'unknown-service' },
      port: 9999
    });
    expect(vars.KEYCLOAK_PUBLIC_PORT).toBe('8082');
  });

  it('mergeDockerManifestPublishedPort is a no-op when manifest port is not finite', async() => {
    const vars = { ...envVars };
    await mergeDockerManifestPublishedPort(vars, {
      app: { key: 'keycloak' },
      port: null
    });
    expect(vars.KEYCLOAK_PUBLIC_PORT).toBe('8082');
  });

  it('rewriteDockerManifestPublicPortEnvLine leaves content when *_PUBLIC_PORT missing in envVars', () => {
    const vars = { KEYCLOAK_HOST: 'keycloak' };
    const content = 'KEYCLOAK_PUBLIC_PORT=8182\n';
    const out = rewriteDockerManifestPublicPortEnvLine(content, vars, { app: { key: 'keycloak' } });
    expect(out).toBe(content);
  });

  it('pairs dataplane-style host when app.key matches docker service name', () => {
    const dp = {
      DATAPLANE_HOST: 'dataplane',
      DATAPLANE_PORT: '3001',
      DATAPLANE_PUBLIC_PORT: '3001'
    };
    expect(publicPortKeyForAppKey(dp, 'dataplane')).toBe('DATAPLANE_PUBLIC_PORT');
  });
});
