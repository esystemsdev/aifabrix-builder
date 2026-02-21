/**
 * Tests for Credential API (Dataplane secret store)
 *
 * @fileoverview Tests for lib/api/credential.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  post: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => ({
  baseUrl,
  authConfig,
  post: mockClient.post
}));

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient
}));

const credentialApi = require('../../../lib/api/credential.api');

describe('Credential API', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockResolvedValue({ success: true, stored: 2 });
  });

  describe('storeCredentialSecrets', () => {
    it('should POST to /api/v1/credential/secret with items body', async() => {
      const items = [
        { key: 'kv://secrets/foo', value: 'plain1' },
        { key: 'kv://secrets/bar', value: 'plain2' }
      ];
      await credentialApi.storeCredentialSecrets(dataplaneUrl, authConfig, items);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/credential/secret', {
        body: items
      });
    });

    it('should use dataplane URL and auth config', async() => {
      const items = [{ key: 'kv://a/b', value: 'v' }];
      await credentialApi.storeCredentialSecrets(dataplaneUrl, authConfig, items);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/credential/secret',
        expect.objectContaining({ body: items })
      );
    });

    it('should return stored count from response', async() => {
      mockClient.post.mockResolvedValue({ success: true, stored: 3 });
      const items = [
        { key: 'kv://s/a', value: '1' },
        { key: 'kv://s/b', value: '2' },
        { key: 'kv://s/c', value: '3' }
      ];
      const result = await credentialApi.storeCredentialSecrets(dataplaneUrl, authConfig, items);
      expect(result.stored).toBe(3);
    });

    it('should return { stored: 0 } when items array is empty', async() => {
      const result = await credentialApi.storeCredentialSecrets(dataplaneUrl, authConfig, []);
      expect(result).toEqual({ stored: 0 });
      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it('should throw when dataplaneUrl is missing', async() => {
      await expect(
        credentialApi.storeCredentialSecrets('', authConfig, [{ key: 'kv://a', value: 'v' }])
      ).rejects.toThrow('dataplaneUrl');
      await expect(
        credentialApi.storeCredentialSecrets(null, authConfig, [{ key: 'kv://a', value: 'v' }])
      ).rejects.toThrow('dataplaneUrl');
    });
  });
});
