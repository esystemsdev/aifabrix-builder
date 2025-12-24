/**
 * Tests for External Systems API
 *
 * @fileoverview Tests for lib/api/external-systems.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => {
  return {
    baseUrl,
    authConfig,
    get: mockClient.get,
    post: mockClient.post,
    put: mockClient.put,
    delete: mockClient.delete
  };
});

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient
}));

const externalSystemsApi = require('../../../lib/api/external-systems.api');

describe('External Systems API', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: [] });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
    mockClient.put.mockResolvedValue({ success: true, data: {} });
    mockClient.delete.mockResolvedValue({ success: true, data: null });
  });

  describe('listExternalSystems', () => {
    it('should list external systems without options', async() => {
      await externalSystemsApi.listExternalSystems(dataplaneUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/systems', {
        params: {}
      });
    });

    it('should list external systems with pagination options', async() => {
      const options = { page: 1, pageSize: 20, search: 'test' };
      await externalSystemsApi.listExternalSystems(dataplaneUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/systems', {
        params: options
      });
    });
  });

  describe('createExternalSystem', () => {
    it('should create external system', async() => {
      const systemData = {
        key: 'test-system',
        displayName: 'Test System',
        type: 'openapi'
      };
      await externalSystemsApi.createExternalSystem(dataplaneUrl, authConfig, systemData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/systems', {
        body: systemData
      });
    });
  });

  describe('getExternalSystem', () => {
    it('should get external system by ID or key', async() => {
      await externalSystemsApi.getExternalSystem(dataplaneUrl, 'test-system', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/systems/test-system');
    });
  });

  describe('updateExternalSystem', () => {
    it('should update external system', async() => {
      const updateData = { displayName: 'Updated Name' };
      await externalSystemsApi.updateExternalSystem(dataplaneUrl, 'test-system', authConfig, updateData);

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/systems/test-system', {
        body: updateData
      });
    });
  });

  describe('deleteExternalSystem', () => {
    it('should delete external system', async() => {
      await externalSystemsApi.deleteExternalSystem(dataplaneUrl, 'test-system', authConfig);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/systems/test-system');
    });
  });

  describe('getExternalSystemConfig', () => {
    it('should get external system config', async() => {
      await externalSystemsApi.getExternalSystemConfig(dataplaneUrl, 'test-system', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/systems/test-system/config');
    });
  });

  describe('createFromTemplate', () => {
    it('should create external system from template', async() => {
      const templateData = {
        templateIdOrKey: 'template-1',
        key: 'test-system',
        displayName: 'Test System'
      };
      await externalSystemsApi.createFromTemplate(dataplaneUrl, authConfig, templateData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/systems/from-template', {
        body: templateData
      });
    });
  });

  describe('listOpenAPIFiles', () => {
    it('should list OpenAPI files', async() => {
      await externalSystemsApi.listOpenAPIFiles(dataplaneUrl, 'test-system', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/systems/test-system/openapi-files', {
        params: {}
      });
    });
  });

  describe('listOpenAPIEndpoints', () => {
    it('should list OpenAPI endpoints', async() => {
      await externalSystemsApi.listOpenAPIEndpoints(dataplaneUrl, 'test-system', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/systems/test-system/openapi-endpoints', {
        params: {}
      });
    });
  });

  describe('publishExternalSystem', () => {
    it('should publish external system without options', async() => {
      await externalSystemsApi.publishExternalSystem(dataplaneUrl, 'test-system', authConfig);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/systems/test-system/publish', {
        body: {}
      });
    });

    it('should publish external system with options', async() => {
      const publishData = { generateMcpContract: true };
      await externalSystemsApi.publishExternalSystem(dataplaneUrl, 'test-system', authConfig, publishData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/systems/test-system/publish', {
        body: publishData
      });
    });
  });

  describe('rollbackExternalSystem', () => {
    it('should rollback external system', async() => {
      const rollbackData = { version: 2 };
      await externalSystemsApi.rollbackExternalSystem(dataplaneUrl, 'test-system', authConfig, rollbackData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/systems/test-system/rollback', {
        body: rollbackData
      });
    });
  });

  describe('saveAsTemplate', () => {
    it('should save external system as template', async() => {
      const templateData = {
        templateKey: 'template-key',
        templateName: 'Template Name'
      };
      await externalSystemsApi.saveAsTemplate(dataplaneUrl, 'test-system', authConfig, templateData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/systems/test-system/save-template', {
        body: templateData
      });
    });
  });
});

