/**
 * @fileoverview computeHealthCheckUrl localhost path vs Traefik (plan 124 pathActive)
 */

'use strict';

const healthCheckUrl = require('../../../lib/utils/health-check-url');
const { computeHealthCheckUrl } = require('../../../lib/utils/health-check');

describe('computeHealthCheckUrl', () => {
  const keycloakLike = {
    healthCheck: { path: '/health/ready' },
    frontDoorRouting: { enabled: true, pattern: '/auth/*' }
  };

  /** @type {jest.SpyInstance} */
  let traefikSpy;

  beforeEach(() => {
    // Assert the localhost URL shape; public Traefik URL depends on developer env/config.
    traefikSpy = jest.spyOn(healthCheckUrl, 'computeTraefikHealthCheckUrl').mockResolvedValue('');
  });

  afterEach(() => {
    traefikSpy.mockRestore();
  });

  it('uses bare health path on localhost when Traefik is off (matches KC_HTTP_RELATIVE_PATH=/)', async() => {
    await expect(
      computeHealthCheckUrl('keycloak', 8082, keycloakLike, { runOptions: {} })
    ).resolves.toBe('http://localhost:8082/health/ready');
  });

  it('prepends front-door pattern on localhost when Traefik is on and front door enabled', async() => {
    await expect(
      computeHealthCheckUrl('keycloak', 8082, keycloakLike, {
        runOptions: { traefikEnabled: true }
      })
    ).resolves.toBe('http://localhost:8082/auth/health/ready');
  });

  it('skipTraefikPublicUrl still applies front-door path when Traefik is on (localhost leg only)', async() => {
    await expect(
      computeHealthCheckUrl('keycloak', 8082, keycloakLike, {
        runOptions: { traefikEnabled: true },
        skipTraefikPublicUrl: true
      })
    ).resolves.toBe('http://localhost:8082/auth/health/ready');
  });
});
