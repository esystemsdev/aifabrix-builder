/**
 * Tests for Builder Server (dev) API
 *
 * @fileoverview Tests for lib/api/dev.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockMakeApiCall = jest.fn();

jest.mock('../../../lib/utils/api', () => ({
  makeApiCall: mockMakeApiCall
}));

const devApi = require('../../../lib/api/dev.api');

describe('Dev API', () => {
  const serverUrl = 'https://builder-server.example.com';
  const clientCertPem = '-----BEGIN CERTIFICATE-----\nMIIBkTCB\n-----END CERTIFICATE-----';

  beforeEach(() => {
    jest.clearAllMocks();
    mockMakeApiCall.mockResolvedValue({ success: true, data: {} });
  });

  describe('encodeCertForHeader', () => {
    it('should base64-encode PEM string', () => {
      const pem = '-----BEGIN CERTIFICATE-----\nline1\n-----END CERTIFICATE-----';
      expect(devApi.encodeCertForHeader(pem)).toBe(Buffer.from(pem, 'utf8').toString('base64'));
    });

    it('should return empty string for empty or non-string', () => {
      expect(devApi.encodeCertForHeader('')).toBe('');
      expect(devApi.encodeCertForHeader(null)).toBe('');
      expect(devApi.encodeCertForHeader(undefined)).toBe('');
    });
  });

  describe('normalizeBaseUrl', () => {
    it('should remove trailing slashes', () => {
      expect(devApi.normalizeBaseUrl('https://host/')).toBe('https://host');
      expect(devApi.normalizeBaseUrl('https://host///')).toBe('https://host');
    });

    it('should trim whitespace', () => {
      expect(devApi.normalizeBaseUrl('  https://host  ')).toBe('https://host');
    });

    it('should throw when serverUrl is missing or not a string', () => {
      expect(() => devApi.normalizeBaseUrl('')).toThrow('remote-server URL is required');
      expect(() => devApi.normalizeBaseUrl(null)).toThrow('remote-server URL is required');
      expect(() => devApi.normalizeBaseUrl(123)).toThrow('remote-server URL is required');
    });
  });

  describe('buildUrl', () => {
    it('should join base URL and path', () => {
      expect(devApi.buildUrl('https://host', '/api/dev/issue-cert')).toBe('https://host/api/dev/issue-cert');
    });

    it('should add leading slash to path if missing', () => {
      expect(devApi.buildUrl('https://host', 'api/dev/issue-cert')).toBe('https://host/api/dev/issue-cert');
    });
  });

  describe('issueCert', () => {
    it('should POST to /api/dev/issue-cert with body', async() => {
      const body = { developerId: 'dev1', pin: '1234', csr: '-----BEGIN CERTIFICATE REQUEST-----' };
      mockMakeApiCall.mockResolvedValue({ success: true, data: { certificate: 'pem', validDays: 365 } });

      const result = await devApi.issueCert(serverUrl, body);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/issue-cert',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body)
        })
      );
      expect(result).toEqual({ certificate: 'pem', validDays: 365 });
    });

    it('should throw when request fails', async() => {
      mockMakeApiCall.mockResolvedValue({ success: false, formattedError: 'Invalid PIN' });

      await expect(devApi.issueCert(serverUrl, {})).rejects.toThrow('Invalid PIN');
    });
  });

  describe('getHealth', () => {
    it('should GET /health and return data', async() => {
      const healthData = { status: 'ok', checks: { dataDir: 'ok', encryptionKey: 'ok', ca: 'ok', users: 'ok', tokens: 'ok' } };
      mockMakeApiCall.mockResolvedValue({ success: true, data: healthData });

      const result = await devApi.getHealth(serverUrl);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/health',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(healthData);
    });

    it('should throw when request fails', async() => {
      mockMakeApiCall.mockResolvedValue({ success: false, error: 'Unavailable' });

      await expect(devApi.getHealth(serverUrl)).rejects.toThrow();
    });
  });

  describe('getSettings', () => {
    it('should GET /api/dev/settings with X-Client-Cert header', async() => {
      const settings = { dataDir: '/data', someKey: 'value' };
      mockMakeApiCall.mockResolvedValue({ success: true, data: settings });

      const result = await devApi.getSettings(serverUrl, clientCertPem);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/settings',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-Client-Cert': expect.any(String) })
        })
      );
      expect(result).toEqual(settings);
    });

    it('should throw when clientCertPem is missing', async() => {
      await expect(devApi.getSettings(serverUrl, '')).rejects.toThrow('Client certificate PEM is required');
      await expect(devApi.getSettings(serverUrl, null)).rejects.toThrow('Client certificate PEM is required');
    });
  });

  describe('listUsers', () => {
    it('should GET /api/dev/users and return array', async() => {
      const users = [{ id: 'u1', developerId: 'dev1' }];
      mockMakeApiCall.mockResolvedValue({ success: true, data: users });

      const result = await devApi.listUsers(serverUrl, clientCertPem);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(users);
    });

    it('should return empty array when data is not array', async() => {
      mockMakeApiCall.mockResolvedValue({ success: true, data: null });

      const result = await devApi.listUsers(serverUrl, clientCertPem);

      expect(result).toEqual([]);
    });
  });

  describe('createUser', () => {
    it('should POST /api/dev/users with body', async() => {
      const body = { developerId: 'dev1', name: 'Dev One', email: 'dev@example.com' };
      mockMakeApiCall.mockResolvedValue({ success: true, data: { id: 'u1', ...body } });

      const result = await devApi.createUser(serverUrl, clientCertPem, body);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body)
        })
      );
      expect(result).toEqual({ id: 'u1', ...body });
    });
  });

  describe('updateUser', () => {
    it('should PATCH /api/dev/users/:id with body', async() => {
      const id = 'user-123';
      const body = { name: 'Updated Name' };
      mockMakeApiCall.mockResolvedValue({ success: true, data: { id, name: 'Updated Name' } });

      const result = await devApi.updateUser(serverUrl, clientCertPem, id, body);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users/user-123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(body)
        })
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should encode user id in URL', async() => {
      await devApi.updateUser(serverUrl, clientCertPem, 'u/id', { name: 'x' });

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users/u%2Fid',
        expect.any(Object)
      );
    });
  });

  describe('deleteUser', () => {
    it('should DELETE /api/dev/users/:id', async() => {
      mockMakeApiCall.mockResolvedValue({ success: true, data: { deleted: 'user-1' } });

      await devApi.deleteUser(serverUrl, clientCertPem, 'user-1');

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users/user-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('createPin', () => {
    it('should POST /api/dev/users/:id/pin', async() => {
      mockMakeApiCall.mockResolvedValue({ success: true, data: { pin: '5678', expiresAt: '2025-01-01T00:00:00Z' } });

      const result = await devApi.createPin(serverUrl, clientCertPem, 'user-1');

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users/user-1/pin',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.pin).toBe('5678');
    });
  });

  describe('listSshKeys', () => {
    it('should GET /api/dev/users/:id/ssh-keys and return array', async() => {
      const keys = [{ fingerprint: 'fp1', label: 'laptop' }];
      mockMakeApiCall.mockResolvedValue({ success: true, data: keys });

      const result = await devApi.listSshKeys(serverUrl, clientCertPem, 'user-1');

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users/user-1/ssh-keys',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(keys);
    });

    it('should return empty array when data is not array', async() => {
      mockMakeApiCall.mockResolvedValue({ success: true, data: {} });

      expect(await devApi.listSshKeys(serverUrl, clientCertPem, 'user-1')).toEqual([]);
    });
  });

  describe('addSshKey', () => {
    it('should POST /api/dev/users/:id/ssh-keys with body', async() => {
      const body = { publicKey: 'ssh-rsa AAAA...', label: 'laptop' };
      mockMakeApiCall.mockResolvedValue({ success: true, data: { fingerprint: 'fp1', ...body } });

      const result = await devApi.addSshKey(serverUrl, clientCertPem, 'user-1', body);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users/user-1/ssh-keys',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body)
        })
      );
      expect(result.fingerprint).toBe('fp1');
    });
  });

  describe('removeSshKey', () => {
    it('should DELETE /api/dev/users/:id/ssh-keys/:fingerprint', async() => {
      mockMakeApiCall.mockResolvedValue({ success: true, data: { deleted: 'fp1' } });

      await devApi.removeSshKey(serverUrl, clientCertPem, 'user-1', 'aa:bb:cc');

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/users/user-1/ssh-keys/aa%3Abb%3Acc',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('listSecrets', () => {
    it('should GET /api/dev/secrets and return array', async() => {
      const secrets = [{ name: 'KEY1', value: '***' }];
      mockMakeApiCall.mockResolvedValue({ success: true, data: secrets });

      const result = await devApi.listSecrets(serverUrl, clientCertPem);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/secrets',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(secrets);
    });

    it('should return empty array when data is not array', async() => {
      mockMakeApiCall.mockResolvedValue({ success: true, data: null });

      expect(await devApi.listSecrets(serverUrl, clientCertPem)).toEqual([]);
    });
  });

  describe('addSecret', () => {
    it('should POST /api/dev/secrets with key and value', async() => {
      const body = { key: 'MY_SECRET', value: 'secret-value' };
      mockMakeApiCall.mockResolvedValue({ success: true, data: { key: 'MY_SECRET' } });

      const result = await devApi.addSecret(serverUrl, clientCertPem, body);

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/secrets',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body)
        })
      );
      expect(result.key).toBe('MY_SECRET');
    });
  });

  describe('deleteSecret', () => {
    it('should DELETE /api/dev/secrets/:key', async() => {
      mockMakeApiCall.mockResolvedValue({ success: true, data: { deleted: 'MY_KEY' } });

      await devApi.deleteSecret(serverUrl, clientCertPem, 'MY_KEY');

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/secrets/MY_KEY',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should encode secret key in URL', async() => {
      await devApi.deleteSecret(serverUrl, clientCertPem, 'key/with/slash');

      expect(mockMakeApiCall).toHaveBeenCalledWith(
        'https://builder-server.example.com/api/dev/secrets/key%2Fwith%2Fslash',
        expect.any(Object)
      );
    });
  });

  describe('request error handling', () => {
    it('should use formattedError when present', async() => {
      mockMakeApiCall.mockResolvedValue({ success: false, formattedError: 'Custom message', error: 'err' });

      await expect(devApi.getHealth(serverUrl)).rejects.toThrow('Custom message');
    });

    it('should use error when formattedError missing', async() => {
      mockMakeApiCall.mockResolvedValue({ success: false, error: 'Server error' });

      await expect(devApi.getHealth(serverUrl)).rejects.toThrow('Server error');
    });

    it('should attach status and errorData to thrown error', async() => {
      mockMakeApiCall.mockResolvedValue({
        success: false,
        status: 403,
        errorData: { code: 'FORBIDDEN' },
        formattedError: 'Forbidden'
      });

      try {
        await devApi.getHealth(serverUrl);
      } catch (err) {
        expect(err.status).toBe(403);
        expect(err.errorData).toEqual({ code: 'FORBIDDEN' });
      }
    });
  });
});
