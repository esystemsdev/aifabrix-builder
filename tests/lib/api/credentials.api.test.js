/**
 * Tests for Credentials API
 *
 * @fileoverview Tests for lib/api/credentials.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  get: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => ({
  baseUrl,
  authConfig,
  get: mockClient.get
}));

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient
}));

const credentialsApi = require('../../../lib/api/credentials.api');

describe('Credentials API', () => {
  const baseUrl = 'https://controller.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: { credentials: [] } });
  });

  describe('listCredentials', () => {
    it('should list credentials without options', async() => {
      await credentialsApi.listCredentials(baseUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/credential', { params: {} });
    });

    it('should list credentials with options', async() => {
      const options = { activeOnly: true, pageSize: 50 };
      await credentialsApi.listCredentials(baseUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/credential', { params: options });
    });

    it('should list credentials with page option', async() => {
      const options = { page: 2, pageSize: 20 };
      await credentialsApi.listCredentials(baseUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/credential', { params: options });
    });

    it('should handle listCredentials errors', async() => {
      const error = new Error('List credentials failed');
      mockClient.get.mockRejectedValue(error);

      await expect(credentialsApi.listCredentials(baseUrl, authConfig)).rejects.toThrow(
        'List credentials failed'
      );
    });
  });
});
