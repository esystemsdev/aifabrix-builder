/**
 * Tests for Datasources API
 *
 * @fileoverview Tests for lib/api/datasources.api.js module
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

const datasourcesApi = require('../../../lib/api/datasources.api');

describe('Datasources API', () => {
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
      await datasourcesApi.listDatasources(dataplaneUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/', {
        params: {}
      });
    });

    it('should list datasources with pagination options', async() => {
      const options = { page: 1, pageSize: 20, search: 'test' };
      await datasourcesApi.listDatasources(dataplaneUrl, authConfig, options);

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
      await datasourcesApi.createDatasource(dataplaneUrl, authConfig, datasourceData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/', {
        body: datasourceData
      });
    });
  });

  describe('getDatasource', () => {
    it('should get datasource by ID or key', async() => {
      await datasourcesApi.getDatasource(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source');
    });
  });

  describe('updateDatasource', () => {
    it('should update datasource', async() => {
      const updateData = { displayName: 'Updated Name' };
      await datasourcesApi.updateDatasource(dataplaneUrl, 'test-source', authConfig, updateData);

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/test-source', {
        body: updateData
      });
    });
  });

  describe('deleteDatasource', () => {
    it('should delete datasource', async() => {
      await datasourcesApi.deleteDatasource(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/test-source');
    });
  });

  describe('getDatasourceConfig', () => {
    it('should get datasource config', async() => {
      await datasourcesApi.getDatasourceConfig(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/config');
    });
  });

  describe('publishDatasource', () => {
    it('should publish datasource without options', async() => {
      await datasourcesApi.publishDatasource(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/publish', {
        body: {}
      });
    });

    it('should publish datasource with options', async() => {
      const publishData = { generateMcpContract: true };
      await datasourcesApi.publishDatasource(dataplaneUrl, 'test-source', authConfig, publishData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/publish', {
        body: publishData
      });
    });
  });

  describe('rollbackDatasource', () => {
    it('should rollback datasource', async() => {
      const rollbackData = { version: 2 };
      await datasourcesApi.rollbackDatasource(dataplaneUrl, 'test-source', authConfig, rollbackData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/rollback', {
        body: rollbackData
      });
    });
  });

  describe('testDatasource', () => {
    it('should test datasource without data', async() => {
      await datasourcesApi.testDatasource(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/test', {
        body: {}
      });
    });

    it('should test datasource with payload template', async() => {
      const testData = { payloadTemplate: { test: 'data' } };
      await datasourcesApi.testDatasource(dataplaneUrl, 'test-source', authConfig, testData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/test', {
        body: testData
      });
    });
  });

  describe('listDatasourceOpenAPIEndpoints', () => {
    it('should list OpenAPI endpoints', async() => {
      await datasourcesApi.listDatasourceOpenAPIEndpoints(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/openapi-endpoints', {
        params: {}
      });
    });
  });

  describe('listExecutionLogs', () => {
    it('should list execution logs', async() => {
      await datasourcesApi.listExecutionLogs(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/executions', {
        params: {}
      });
    });
  });

  describe('getExecutionLog', () => {
    it('should get execution log', async() => {
      await datasourcesApi.getExecutionLog(dataplaneUrl, 'test-source', 'exec-1', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/executions/exec-1');
    });
  });

  describe('listAllExecutionLogs', () => {
    it('should list all execution logs', async() => {
      await datasourcesApi.listAllExecutionLogs(dataplaneUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/executions', {
        params: {}
      });
    });
  });

  describe('bulkOperation', () => {
    it('should perform bulk operation', async() => {
      const bulkData = { operation: 'sync', records: [] };
      await datasourcesApi.bulkOperation(dataplaneUrl, 'test-source', authConfig, bulkData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/bulk', {
        body: bulkData
      });
    });
  });

  describe('getDatasourceStatus', () => {
    it('should get datasource status', async() => {
      await datasourcesApi.getDatasourceStatus(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/status');
    });
  });

  describe('listRecords', () => {
    it('should list records', async() => {
      await datasourcesApi.listRecords(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/records', {
        params: {}
      });
    });
  });

  describe('createRecord', () => {
    it('should create record', async() => {
      const recordData = { key: 'rec-1', data: {} };
      await datasourcesApi.createRecord(dataplaneUrl, 'test-source', authConfig, recordData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/records', {
        body: recordData
      });
    });
  });

  describe('getRecord', () => {
    it('should get record', async() => {
      await datasourcesApi.getRecord(dataplaneUrl, 'test-source', 'rec-1', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/records/rec-1');
    });
  });

  describe('updateRecord', () => {
    it('should update record', async() => {
      const updateData = { data: { updated: true } };
      await datasourcesApi.updateRecord(dataplaneUrl, 'test-source', 'rec-1', authConfig, updateData);

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/test-source/records/rec-1', {
        body: updateData
      });
    });
  });

  describe('deleteRecord', () => {
    it('should delete record', async() => {
      await datasourcesApi.deleteRecord(dataplaneUrl, 'test-source', 'rec-1', authConfig);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/test-source/records/rec-1');
    });
  });

  describe('listGrants', () => {
    it('should list grants', async() => {
      await datasourcesApi.listGrants(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/grants', {
        params: {}
      });
    });
  });

  describe('createGrant', () => {
    it('should create grant', async() => {
      const grantData = { key: 'grant-1', userId: 'user-1' };
      await datasourcesApi.createGrant(dataplaneUrl, 'test-source', authConfig, grantData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/grants', {
        body: grantData
      });
    });
  });

  describe('getGrant', () => {
    it('should get grant', async() => {
      await datasourcesApi.getGrant(dataplaneUrl, 'test-source', 'grant-1', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/grants/grant-1');
    });
  });

  describe('updateGrant', () => {
    it('should update grant', async() => {
      const updateData = { permissions: {} };
      await datasourcesApi.updateGrant(dataplaneUrl, 'test-source', 'grant-1', authConfig, updateData);

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/test-source/grants/grant-1', {
        body: updateData
      });
    });
  });

  describe('deleteGrant', () => {
    it('should delete grant', async() => {
      await datasourcesApi.deleteGrant(dataplaneUrl, 'test-source', 'grant-1', authConfig);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/test-source/grants/grant-1');
    });
  });

  describe('listPolicies', () => {
    it('should list policies', async() => {
      await datasourcesApi.listPolicies(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/policies', {
        params: {}
      });
    });
  });

  describe('attachPolicy', () => {
    it('should attach policy', async() => {
      const policyData = { policyIdOrKey: 'policy-1' };
      await datasourcesApi.attachPolicy(dataplaneUrl, 'test-source', authConfig, policyData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/policies', {
        body: policyData
      });
    });
  });

  describe('detachPolicy', () => {
    it('should detach policy', async() => {
      await datasourcesApi.detachPolicy(dataplaneUrl, 'test-source', 'policy-1', authConfig);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/test-source/policies/policy-1');
    });
  });

  describe('listSyncJobs', () => {
    it('should list sync jobs', async() => {
      await datasourcesApi.listSyncJobs(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/sync', {
        params: {}
      });
    });
  });

  describe('createSyncJob', () => {
    it('should create sync job', async() => {
      const syncData = { key: 'sync-1', configuration: {} };
      await datasourcesApi.createSyncJob(dataplaneUrl, 'test-source', authConfig, syncData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/sync', {
        body: syncData
      });
    });
  });

  describe('getSyncJob', () => {
    it('should get sync job', async() => {
      await datasourcesApi.getSyncJob(dataplaneUrl, 'test-source', 'sync-1', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/sync/sync-1');
    });
  });

  describe('updateSyncJob', () => {
    it('should update sync job', async() => {
      const updateData = { configuration: {} };
      await datasourcesApi.updateSyncJob(dataplaneUrl, 'test-source', 'sync-1', authConfig, updateData);

      expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/test-source/sync/sync-1', {
        body: updateData
      });
    });
  });

  describe('executeSyncJob', () => {
    it('should execute sync job', async() => {
      await datasourcesApi.executeSyncJob(dataplaneUrl, 'test-source', 'sync-1', authConfig);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/sync/sync-1/execute');
    });
  });

  describe('validateDocuments', () => {
    it('should validate documents', async() => {
      const validateData = { documents: [] };
      await datasourcesApi.validateDocuments(dataplaneUrl, 'test-source', authConfig, validateData);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/external/data-sources/test-source/documents/validate',
        { body: validateData }
      );
    });
  });

  describe('bulkDocuments', () => {
    it('should perform bulk document operations', async() => {
      const bulkData = { documents: [] };
      await datasourcesApi.bulkDocuments(dataplaneUrl, 'test-source', authConfig, bulkData);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/external/data-sources/test-source/documents/bulk',
        { body: bulkData }
      );
    });
  });

  describe('listDocuments', () => {
    it('should list documents', async() => {
      await datasourcesApi.listDocuments(dataplaneUrl, 'test-source', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/external/data-sources/test-source/documents',
        { params: {} }
      );
    });
  });
});

