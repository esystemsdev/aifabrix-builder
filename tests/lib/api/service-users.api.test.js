/**
 * Tests for Service Users API
 *
 * @fileoverview Tests for lib/api/service-users.api.js module
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

const serviceUsersApi = require('../../../lib/api/service-users.api');

describe('Service Users API', () => {
  const baseUrl = 'https://controller.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockResolvedValue({
      success: true,
      data: { clientId: 'svc-1', clientSecret: 'one-time-secret' }
    });
  });

  describe('createServiceUser', () => {
    it('should call POST /api/v1/service-users with username, email, redirectUris, groupNames', async() => {
      const body = {
        username: 'api-client-001',
        email: 'api@example.com',
        redirectUris: ['https://app.example.com/callback'],
        groupNames: ['AI-Fabrix-Developers']
      };
      await serviceUsersApi.createServiceUser(baseUrl, authConfig, body);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/service-users', {
        body: {
          username: 'api-client-001',
          email: 'api@example.com',
          redirectUris: ['https://app.example.com/callback'],
          groupNames: ['AI-Fabrix-Developers'],
          description: undefined
        }
      });
    });

    it('should include optional description when provided', async() => {
      const body = {
        username: 'ci-user',
        email: 'ci@example.com',
        redirectUris: ['https://app.example.com/cb'],
        groupNames: ['AI-Fabrix-Developers'],
        description: 'For CI'
      };
      await serviceUsersApi.createServiceUser(baseUrl, authConfig, body);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/service-users', {
        body: {
          username: 'ci-user',
          email: 'ci@example.com',
          redirectUris: ['https://app.example.com/cb'],
          groupNames: ['AI-Fabrix-Developers'],
          description: 'For CI'
        }
      });
    });

    it('should return response with clientId and clientSecret', async() => {
      const body = {
        username: 'test',
        email: 'test@example.com',
        redirectUris: ['https://x.com/cb'],
        groupNames: ['my-group']
      };
      const result = await serviceUsersApi.createServiceUser(baseUrl, authConfig, body);

      expect(result.success).toBe(true);
      expect(result.data.clientId).toBe('svc-1');
      expect(result.data.clientSecret).toBe('one-time-secret');
    });

    it('should propagate error response on failure', async() => {
      mockClient.post.mockResolvedValue({
        success: false,
        status: 403,
        error: 'Forbidden',
        formattedError: 'Missing permission: service-user:create'
      });

      const result = await serviceUsersApi.createServiceUser(baseUrl, authConfig, {
        username: 'test',
        email: 'test@example.com',
        redirectUris: ['https://x.com/cb'],
        groupNames: ['my-group']
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });
  });
});
