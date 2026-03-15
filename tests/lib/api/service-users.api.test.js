/**
 * Tests for Service Users API
 *
 * @fileoverview Tests for lib/api/service-users.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => ({
  baseUrl,
  authConfig,
  get: mockClient.get,
  post: mockClient.post,
  put: mockClient.put,
  delete: mockClient.delete
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
    mockClient.get.mockResolvedValue({ success: true, data: { data: [] } });
    mockClient.put.mockResolvedValue({ success: true, data: {} });
    mockClient.delete.mockResolvedValue({ success: true, data: null });
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

  describe('listServiceUsers', () => {
    it('should call GET /api/v1/service-users with params', async() => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: { data: [{ id: 'uuid-1', username: 'u1', email: 'e1@x.com', clientId: 'c1', active: true }], meta: {}, links: {} }
      });

      await serviceUsersApi.listServiceUsers(baseUrl, authConfig, {
        page: 1,
        pageSize: 20,
        search: 'foo',
        sort: 'username',
        filter: 'active:true'
      });

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/service-users', {
        params: { page: 1, pageSize: 20, search: 'foo', sort: 'username', filter: 'active:true' }
      });
    });

    it('should call GET without params when options empty', async() => {
      await serviceUsersApi.listServiceUsers(baseUrl, authConfig, {});

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/service-users', { params: {} });
    });

    it('should return response with data array', async() => {
      const listData = [{ id: 'a', username: 'u', email: 'e@x.com', clientId: 'c', active: true }];
      mockClient.get.mockResolvedValue({ success: true, data: { data: listData, meta: {}, links: {} } });

      const result = await serviceUsersApi.listServiceUsers(baseUrl, authConfig, {});

      expect(result.success).toBe(true);
      expect(result.data.data).toEqual(listData);
    });
  });

  describe('regenerateSecretServiceUser', () => {
    it('should call POST .../regenerate-secret with id and no body', async() => {
      mockClient.post.mockResolvedValue({ success: true, data: { data: { clientSecret: 'new-secret' } } });

      await serviceUsersApi.regenerateSecretServiceUser(baseUrl, authConfig, 'svc-uuid-123');

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/service-users/svc-uuid-123/regenerate-secret');
    });

    it('should return response with clientSecret', async() => {
      mockClient.post.mockResolvedValue({ success: true, data: { data: { clientSecret: 'rotated-secret' } } });

      const result = await serviceUsersApi.regenerateSecretServiceUser(baseUrl, authConfig, 'id-1');

      expect(result.success).toBe(true);
      expect(result.data.data.clientSecret).toBe('rotated-secret');
    });
  });

  describe('deleteServiceUser', () => {
    it('should call DELETE .../service-users/{id}', async() => {
      await serviceUsersApi.deleteServiceUser(baseUrl, authConfig, 'svc-uuid-456');

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/service-users/svc-uuid-456');
    });

    it('should return success response', async() => {
      const result = await serviceUsersApi.deleteServiceUser(baseUrl, authConfig, 'id-1');

      expect(result.success).toBe(true);
    });
  });

  describe('updateGroupsServiceUser', () => {
    it('should call PUT .../groups with groupNames body', async() => {
      await serviceUsersApi.updateGroupsServiceUser(baseUrl, authConfig, 'svc-uuid-789', {
        groupNames: ['Group1', 'Group2']
      });

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/service-users/svc-uuid-789/groups', {
        body: { groupNames: ['Group1', 'Group2'] }
      });
    });
  });

  describe('updateRedirectUrisServiceUser', () => {
    it('should call PUT .../redirect-uris with redirectUris body', async() => {
      await serviceUsersApi.updateRedirectUrisServiceUser(baseUrl, authConfig, 'svc-uuid-abc', {
        redirectUris: ['https://app.example.com/callback']
      });

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/service-users/svc-uuid-abc/redirect-uris', {
        body: { redirectUris: ['https://app.example.com/callback'] }
      });
    });
  });
});
