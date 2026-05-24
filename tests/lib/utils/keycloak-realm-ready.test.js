/**
 * @fileoverview Tests for keycloak-realm-ready
 */

'use strict';

jest.mock('../../../lib/utils/platform-controller-url');

const { computeAppBaseUrl } = require('../../../lib/utils/platform-controller-url');
const {
  buildRealmWellKnownUrl,
  waitForKeycloakRealmReady
} = require('../../../lib/utils/keycloak-realm-ready');

describe('lib/utils/keycloak-realm-ready', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('buildRealmWellKnownUrl appends realm OIDC path', () => {
    expect(buildRealmWellKnownUrl('http://localhost:8682/auth')).toBe(
      'http://localhost:8682/auth/realms/aifabrix/.well-known/openid-configuration'
    );
  });

  it('resolves when realm metadata returns ok', async() => {
    computeAppBaseUrl.mockResolvedValue('http://localhost:8682');
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    await waitForKeycloakRealmReady({ timeoutSeconds: 5, intervalMs: 10 });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8682/realms/aifabrix/.well-known/openid-configuration',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('throws after timeout when realm never becomes ready', async() => {
    computeAppBaseUrl.mockResolvedValue('http://localhost:8682');
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    await expect(
      waitForKeycloakRealmReady({ timeoutSeconds: 0.05, intervalMs: 20 })
    ).rejects.toThrow(/realm "aifabrix" was not ready/);
  });
});
