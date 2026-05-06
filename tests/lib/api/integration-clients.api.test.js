/**
 * Tests for integration-clients API
 *
 * @fileoverview Tests for lib/api/integration-clients.api.js
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

const integrationClientsApi = require('../../../lib/api/integration-clients.api');

describe('Integration Clients API', () => {
  const baseUrl = 'https://controller.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockResolvedValue({
      success: true,
      data: { data: { integrationClient: { keycloakClientId: 'kc-1' }, clientSecret: 'one-time-secret' } }
    });
    mockClient.get.mockResolvedValue({ success: true, data: { data: [], meta: {}, links: {} } });
    mockClient.put.mockResolvedValue({ success: true, data: {} });
    mockClient.delete.mockResolvedValue({ success: true, data: null });
  });

  describe('createIntegrationClient', () => {
    it('should call POST /api/v1/integration-clients with key, displayName, redirectUris, groupNames', async() => {
      const body = {
        key: 'api-client-001',
        displayName: 'API client',
        redirectUris: ['https://app.example.com/callback'],
        groupNames: ['AI-Fabrix-Developers']
      };
      await integrationClientsApi.createIntegrationClient(baseUrl, authConfig, body);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/integration-clients', {
        body: {
          key: 'api-client-001',
          displayName: 'API client',
          redirectUris: ['https://app.example.com/callback'],
          groupNames: ['AI-Fabrix-Developers']
        }
      });
    });

    it('should include optional description and keycloakClientId when provided', async() => {
      const body = {
        key: 'ci-user',
        displayName: 'CI',
        redirectUris: ['https://app.example.com/cb'],
        groupNames: [],
        description: 'For CI',
        keycloakClientId: 'miso-ci'
      };
      await integrationClientsApi.createIntegrationClient(baseUrl, authConfig, body);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/integration-clients', {
        body: {
          key: 'ci-user',
          displayName: 'CI',
          redirectUris: ['https://app.example.com/cb'],
          groupNames: [],
          description: 'For CI',
          keycloakClientId: 'miso-ci'
        }
      });
    });

    it('should return response payload', async() => {
      const body = {
        key: 'test',
        displayName: 'Test',
        redirectUris: ['https://x.com/cb'],
        groupNames: ['my-group']
      };
      const result = await integrationClientsApi.createIntegrationClient(baseUrl, authConfig, body);

      expect(result.success).toBe(true);
      expect(result.data.data.clientSecret).toBe('one-time-secret');
    });

    it('should propagate error response on failure', async() => {
      mockClient.post.mockResolvedValue({
        success: false,
        status: 403,
        error: 'Forbidden',
        formattedError: 'Missing permission: integration-client:create'
      });

      const result = await integrationClientsApi.createIntegrationClient(baseUrl, authConfig, {
        key: 'test',
        displayName: 'Test',
        redirectUris: ['https://x.com/cb'],
        groupNames: ['my-group']
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });
  });

  describe('listIntegrationClients', () => {
    it('should call GET /api/v1/integration-clients with params', async() => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: { data: [{ id: 'uuid-1', key: 'k1', displayName: 'D1' }], meta: {}, links: {} }
      });

      await integrationClientsApi.listIntegrationClients(baseUrl, authConfig, {
        page: 1,
        pageSize: 20,
        search: 'foo',
        sort: 'displayName',
        filter: 'active:true'
      });

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/integration-clients', {
        params: { page: 1, pageSize: 20, search: 'foo', sort: 'displayName', filter: 'active:true' }
      });
    });

    it('should call GET without params when options empty', async() => {
      await integrationClientsApi.listIntegrationClients(baseUrl, authConfig, {});

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/integration-clients', { params: {} });
    });
  });

  describe('getIntegrationClient', () => {
    it('should call GET .../integration-clients/{id}', async() => {
      mockClient.get.mockResolvedValue({ success: true, data: { data: { id: 'x', key: 'k' } } });

      await integrationClientsApi.getIntegrationClient(baseUrl, authConfig, 'id-1');

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/integration-clients/id-1');
    });
  });

  describe('regenerateIntegrationClientSecret', () => {
    it('should call POST .../regenerate-secret with id', async() => {
      mockClient.post.mockResolvedValue({ success: true, data: { data: { clientSecret: 'new-secret' } } });

      await integrationClientsApi.regenerateIntegrationClientSecret(baseUrl, authConfig, 'svc-uuid-123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/integration-clients/svc-uuid-123/regenerate-secret'
      );
    });
  });

  describe('deleteIntegrationClient', () => {
    it('should call DELETE .../integration-clients/{id}', async() => {
      await integrationClientsApi.deleteIntegrationClient(baseUrl, authConfig, 'svc-uuid-456');

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/integration-clients/svc-uuid-456');
    });
  });

  describe('updateIntegrationClientGroups', () => {
    it('should call PUT .../groups with groupNames body', async() => {
      await integrationClientsApi.updateIntegrationClientGroups(baseUrl, authConfig, 'svc-uuid-789', {
        groupNames: ['Group1', 'Group2']
      });

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/integration-clients/svc-uuid-789/groups', {
        body: { groupNames: ['Group1', 'Group2'] }
      });
    });
  });

  describe('updateIntegrationClientRedirectUris', () => {
    it('should call PUT .../redirect-uris with redirectUris body', async() => {
      await integrationClientsApi.updateIntegrationClientRedirectUris(baseUrl, authConfig, 'svc-uuid-abc', {
        redirectUris: ['https://app.example.com/callback']
      });

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/integration-clients/svc-uuid-abc/redirect-uris', {
        body: { redirectUris: ['https://app.example.com/callback'] }
      });
    });
  });
});
