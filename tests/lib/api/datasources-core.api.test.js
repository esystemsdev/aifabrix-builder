/**
 * Tests for Datasources Core API
 *
 * @fileoverview Tests for lib/api/datasources-core.api.js module
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

const datasourcesCoreApi = require('../../../lib/api/datasources-core.api');

describe('Datasources Core API', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: [] });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
    mockClient.put.mockResolvedValue({ success: true, data: {} });
    mockClient.delete.mockResolvedValue({ success: true, data: null });
  });

  describe('listDatasources', () => {
    it('should list datasources without options', async() => {
      await datasourcesCoreApi.listDatasources(dataplaneUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/', {
        params: {}
      });
    });

    it('should list datasources with pagination options', async() => {
      const options = { page: 1, pageSize: 20, search: 'test' };
      await datasourcesCoreApi.listDatasources(dataplaneUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/', {
        params: options
      });
    });
  });

  describe('createDatasource', () => {
    it('should create datasource', async() => {
      const datasourceData = {
        key: 'test-source',
        displayName: 'Test Source',
        externalSystemId: 'sys-1'
      };
      await datasourcesCoreApi.createDatasource(dataplaneUrl, authConfig, datasourceData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/', {
        body: datasourceData
      });
    });
  });

  describe('getDatasource', () => {
    it('should get datasource by ID or key', async() => {
      await datasourcesCoreApi.getDatasource(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source');
    });
  });

  describe('updateDatasource', () => {
    it('should update datasource', async() => {
      const updateData = { displayName: 'Updated Name' };
      await datasourcesCoreApi.updateDatasource(dataplaneUrl, 'test-source', authConfig, updateData);

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/test-source', {
        body: updateData
      });
    });
  });

  describe('deleteDatasource', () => {
    it('should delete datasource', async() => {
      await datasourcesCoreApi.deleteDatasource(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/test-source');
    });
  });

  describe('getDatasourceConfig', () => {
    it('should get datasource configuration', async() => {
      await datasourcesCoreApi.getDatasourceConfig(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/config');
    });
  });

  describe('publishDatasource', () => {
    it('should publish datasource with default empty data', async() => {
      await datasourcesCoreApi.publishDatasource(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/publish', {
        body: {}
      });
    });

    it('should publish datasource with publish data', async() => {
      const publishData = { version: '1.0.0' };
      await datasourcesCoreApi.publishDatasource(dataplaneUrl, 'test-source', authConfig, publishData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/publish', {
        body: publishData
      });
    });
  });

  describe('rollbackDatasource', () => {
    it('should rollback datasource', async() => {
      const rollbackData = { version: '0.9.0' };
      await datasourcesCoreApi.rollbackDatasource(dataplaneUrl, 'test-source', authConfig, rollbackData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/rollback', {
        body: rollbackData
      });
    });
  });

  describe('testDatasource', () => {
    it('should test datasource with default empty data', async() => {
      await datasourcesCoreApi.testDatasource(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/test', {
        body: {}
      });
    });

    it('should test datasource with test data', async() => {
      const testData = { testConfig: 'value' };
      await datasourcesCoreApi.testDatasource(dataplaneUrl, 'test-source', authConfig, testData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/test', {
        body: testData
      });
    });
  });

  describe('listDatasourceOpenAPIEndpoints', () => {
    it('should list OpenAPI endpoints without options', async() => {
      await datasourcesCoreApi.listDatasourceOpenAPIEndpoints(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/openapi-endpoints', {
        params: {}
      });
    });

    it('should list OpenAPI endpoints with options', async() => {
      const options = { include: 'schemas' };
      await datasourcesCoreApi.listDatasourceOpenAPIEndpoints(dataplaneUrl, 'test-source', authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/openapi-endpoints', {
        params: options
      });
    });
  });

  describe('listExecutionLogs', () => {
    it('should list execution logs without options', async() => {
      await datasourcesCoreApi.listExecutionLogs(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/executions', {
        params: {}
      });
    });

    it('should list execution logs with options', async() => {
      const options = { limit: 10, offset: 0 };
      await datasourcesCoreApi.listExecutionLogs(dataplaneUrl, 'test-source', authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/executions', {
        params: options
      });
    });
  });

  describe('getExecutionLog', () => {
    it('should get execution log by ID', async() => {
      await datasourcesCoreApi.getExecutionLog(dataplaneUrl, 'test-source', 'exec-123', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/executions/exec-123');
    });
  });

  describe('listAllExecutionLogs', () => {
    it('should list all execution logs without options', async() => {
      await datasourcesCoreApi.listAllExecutionLogs(dataplaneUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/executions', {
        params: {}
      });
    });

    it('should list all execution logs with options', async() => {
      const options = { limit: 20 };
      await datasourcesCoreApi.listAllExecutionLogs(dataplaneUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/executions', {
        params: options
      });
    });
  });

  describe('bulkOperation', () => {
    it('should perform bulk operation', async() => {
      const bulkData = { operation: 'update', items: [] };
      await datasourcesCoreApi.bulkOperation(dataplaneUrl, 'test-source', authConfig, bulkData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/bulk', {
        body: bulkData
      });
    });
  });

  describe('getDatasourceStatus', () => {
    it('should get datasource status', async() => {
      await datasourcesCoreApi.getDatasourceStatus(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/status');
    });
  });

  describe('error handling', () => {
    it('should handle errors from listDatasources', async() => {
      const error = new Error('Network error');
      mockClient.get.mockRejectedValue(error);

      await expect(datasourcesCoreApi.listDatasources(dataplaneUrl, authConfig)).rejects.toThrow('Network error');
    });

    it('should handle errors from createDatasource', async() => {
      const error = new Error('Validation error');
      mockClient.post.mockRejectedValue(error);

      await expect(datasourcesCoreApi.createDatasource(dataplaneUrl, authConfig, {})).rejects.toThrow('Validation error');
    });

    it('should handle errors from updateDatasource', async() => {
      const error = new Error('Not found');
      mockClient.put.mockRejectedValue(error);

      await expect(datasourcesCoreApi.updateDatasource(dataplaneUrl, 'test-source', authConfig, {})).rejects.toThrow('Not found');
    });

    it('should handle errors from deleteDatasource', async() => {
      const error = new Error('Delete failed');
      mockClient.delete.mockRejectedValue(error);

      await expect(datasourcesCoreApi.deleteDatasource(dataplaneUrl, 'test-source', authConfig)).rejects.toThrow('Delete failed');
    });
  });
});

