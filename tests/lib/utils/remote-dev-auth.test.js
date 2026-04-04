/**
 * Tests for remote-dev-auth (isRemoteSecretsUrl, getRemoteDevAuth).
 * @fileoverview Unit tests for lib/utils/remote-dev-auth.js
 */

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/dev-cert-helper', () => ({
  getCertDir: jest.fn(),
  readClientCertPem: jest.fn(),
  readServerCaPem: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => ({
  getConfigDirForPaths: jest.fn(() => '/config'),
  getAifabrixHome: jest.fn(() => '/home/user/.aifabrix'),
  getAifabrixWork: jest.fn(() => null)
}));

const path = require('path');
const paths = require('../../../lib/utils/paths');
const config = require('../../../lib/core/config');
const { getCertDir, readClientCertPem, readServerCaPem } = require('../../../lib/utils/dev-cert-helper');
const remoteDevAuthMod = require('../../../lib/utils/remote-dev-auth');
const { isRemoteSecretsUrl, getRemoteDevAuth } = remoteDevAuthMod;

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

  describe('getSharedSecretsRemoteHostname', () => {
    it('returns hostname from secrets API URL', () => {
      expect(remoteDevAuthMod.getSharedSecretsRemoteHostname('https://builder02.local/api/dev/secrets')).toBe('builder02.local');
    });

    it('returns null for invalid URL', () => {
      expect(remoteDevAuthMod.getSharedSecretsRemoteHostname('not-a-url')).toBeNull();
    });
  });

  describe('getSharedSecretsRemoteListLabels', () => {
    it('includes hostname in title and empty message when parsable', () => {
      const u = 'https://dev.example.com/api/dev/secrets';
      expect(remoteDevAuthMod.getSharedSecretsRemoteListLabels(u)).toEqual({
        title: 'Shared secrets (remote - dev.example.com)',
        emptyMessage: 'No shared secrets (remote - dev.example.com).'
      });
    });

    it('falls back when hostname cannot be resolved', () => {
      expect(remoteDevAuthMod.getSharedSecretsRemoteListLabels('not-a-url')).toEqual({
        title: 'Shared secrets (remote)',
        emptyMessage: 'No shared secrets (remote).'
      });
    });
  });

  describe('getRemoteDevAuth', () => {
    beforeEach(() => {
      readServerCaPem.mockReturnValue(null);
    });

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

    it('returns serverUrl, clientCertPem, and serverCaPem when configured', async() => {
      config.getRemoteServer.mockResolvedValue('https://dev.example.com');
      config.getDeveloperId.mockResolvedValue('01');
      getCertDir.mockReturnValue('/config/certs/01');
      readClientCertPem.mockReturnValue('-----BEGIN CERTIFICATE-----\npem\n-----END CERTIFICATE-----');
      readServerCaPem.mockReturnValue('-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----');
      const result = await getRemoteDevAuth();
      expect(result).toEqual({
        serverUrl: 'https://dev.example.com',
        clientCertPem: '-----BEGIN CERTIFICATE-----\npem\n-----END CERTIFICATE-----',
        serverCaPem: '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'
      });
      expect(readServerCaPem).toHaveBeenCalledWith('/config/certs/01');
    });
  });

  describe('resolveSharedSecretsEndpoint', () => {
    const remoteDevAuth = require('../../../lib/utils/remote-dev-auth');

    beforeEach(() => {
      paths.getAifabrixHome.mockReturnValue('/home/user/.aifabrix');
      paths.getAifabrixWork.mockReturnValue(null);
    });

    it('returns trimmed URL when already http(s)', async() => {
      await expect(remoteDevAuth.resolveSharedSecretsEndpoint('https://x.dev/api/dev/secrets/')).resolves.toBe(
        'https://x.dev/api/dev/secrets'
      );
    });

    it('returns configured path when remote auth is unavailable', async() => {
      jest.spyOn(remoteDevAuth, 'getRemoteDevAuth').mockResolvedValue(null);
      const p = '/aifabrix-miso/builder/secrets.local.yaml';
      await expect(remoteDevAuth.resolveSharedSecretsEndpoint(p)).resolves.toBe(p);
      remoteDevAuth.getRemoteDevAuth.mockRestore();
    });

    it('uses Builder API URL when path is not under home/work and auth is set', async() => {
      jest.spyOn(remoteDevAuth, 'getRemoteDevAuth').mockResolvedValue({
        serverUrl: 'http://builder:3000',
        clientCertPem: 'pem',
        serverCaPem: null
      });
      await expect(remoteDevAuth.resolveSharedSecretsEndpoint('/aifabrix-miso/builder/secrets.local.yaml')).resolves.toBe(
        'http://builder:3000/api/dev/secrets'
      );
      remoteDevAuth.getRemoteDevAuth.mockRestore();
    });

    it('keeps file path when under aifabrix-work', async() => {
      const work = '/home/user/workspace';
      const file = path.join(work, 'aifabrix-miso', 'builder', 'secrets.local.yaml');
      jest.spyOn(remoteDevAuth, 'getRemoteDevAuth').mockResolvedValue({
        serverUrl: 'http://builder:3000',
        clientCertPem: 'pem',
        serverCaPem: null
      });
      paths.getAifabrixWork.mockReturnValue(work);
      await expect(remoteDevAuth.resolveSharedSecretsEndpoint(file)).resolves.toBe(file);
      remoteDevAuth.getRemoteDevAuth.mockRestore();
    });
  });
});
