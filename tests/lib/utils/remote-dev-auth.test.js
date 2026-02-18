/**
 * Tests for remote-dev-auth (isRemoteSecretsUrl, getRemoteDevAuth).
 * @fileoverview Unit tests for lib/utils/remote-dev-auth.js
 */

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/dev-cert-helper');
jest.mock('../../../lib/utils/paths', () => ({ getConfigDirForPaths: jest.fn(() => '/config') }));

const config = require('../../../lib/core/config');
const { getCertDir, readClientCertPem } = require('../../../lib/utils/dev-cert-helper');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');

describe('remote-dev-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isRemoteSecretsUrl', () => {
    it('returns true for https URL', () => {
      expect(isRemoteSecretsUrl('https://dev.aifabrix.dev/secrets')).toBe(true);
    });

    it('returns true for http URL', () => {
      expect(isRemoteSecretsUrl('http://localhost/secrets')).toBe(true);
    });

    it('returns false for file path', () => {
      expect(isRemoteSecretsUrl('/path/to/secrets.yaml')).toBe(false);
      expect(isRemoteSecretsUrl('secrets.yaml')).toBe(false);
    });

    it('returns false for non-string', () => {
      expect(isRemoteSecretsUrl(null)).toBe(false);
      expect(isRemoteSecretsUrl(undefined)).toBe(false);
    });
  });

  describe('getRemoteDevAuth', () => {
    it('returns null when remote server not configured', async() => {
      config.getRemoteServer.mockResolvedValue(null);
      const result = await getRemoteDevAuth();
      expect(result).toBeNull();
    });

    it('returns null when cert not present', async() => {
      config.getRemoteServer.mockResolvedValue('https://dev.example.com');
      config.getDeveloperId.mockResolvedValue('01');
      getCertDir.mockReturnValue('/config/certs/01');
      readClientCertPem.mockReturnValue(null);
      const result = await getRemoteDevAuth();
      expect(result).toBeNull();
    });

    it('returns serverUrl and clientCertPem when configured', async() => {
      config.getRemoteServer.mockResolvedValue('https://dev.example.com');
      config.getDeveloperId.mockResolvedValue('01');
      getCertDir.mockReturnValue('/config/certs/01');
      readClientCertPem.mockReturnValue('-----BEGIN CERTIFICATE-----\npem\n-----END CERTIFICATE-----');
      const result = await getRemoteDevAuth();
      expect(result).toEqual({
        serverUrl: 'https://dev.example.com',
        clientCertPem: '-----BEGIN CERTIFICATE-----\npem\n-----END CERTIFICATE-----'
      });
    });
  });
});
