/**
 * Tests for Datasources Extended API
 *
 * @fileoverview Tests for lib/api/datasources-extended.api.js module
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

const datasourcesExtendedApi = require('../../../lib/api/datasources-extended.api');

describe('Datasources Extended API', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: [] });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
    mockClient.put.mockResolvedValue({ success: true, data: {} });
    mockClient.delete.mockResolvedValue({ success: true, data: null });
  });

  describe('Records', () => {
    describe('listRecords', () => {
      it('should list records without options', async() => {
        await datasourcesExtendedApi.listRecords(dataplaneUrl, 'test-source', authConfig);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/records', {
          params: {}
        });
      });

      it('should list records with options', async() => {
        const options = { page: 1, pageSize: 20 };
        await datasourcesExtendedApi.listRecords(dataplaneUrl, 'test-source', authConfig, options);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/records', {
          params: options
        });
      });
    });

    describe('createRecord', () => {
      it('should create record', async() => {
        const recordData = { key: 'record-1', data: {} };
        await datasourcesExtendedApi.createRecord(dataplaneUrl, 'test-source', authConfig, recordData);

        expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/records', {
          body: recordData
        });
      });
    });

    describe('getRecord', () => {
      it('should get record by ID or key', async() => {
        await datasourcesExtendedApi.getRecord(dataplaneUrl, 'test-source', 'record-1', authConfig);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/records/record-1');
      });
    });

    describe('updateRecord', () => {
      it('should update record', async() => {
        const updateData = { data: { updated: true } };
        await datasourcesExtendedApi.updateRecord(dataplaneUrl, 'test-source', 'record-1', authConfig, updateData);

        expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/test-source/records/record-1', {
          body: updateData
        });
      });
    });

    describe('deleteRecord', () => {
      it('should delete record', async() => {
        await datasourcesExtendedApi.deleteRecord(dataplaneUrl, 'test-source', 'record-1', authConfig);

        expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/test-source/records/record-1');
      });
    });
  });

  describe('Grants', () => {
    describe('listGrants', () => {
      it('should list grants without options', async() => {
        await datasourcesExtendedApi.listGrants(dataplaneUrl, 'test-source', authConfig);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/grants', {
          params: {}
        });
      });

      it('should list grants with options', async() => {
        const options = { status: 'active' };
        await datasourcesExtendedApi.listGrants(dataplaneUrl, 'test-source', authConfig, options);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/grants', {
          params: options
        });
      });
    });

    describe('createGrant', () => {
      it('should create grant', async() => {
        const grantData = { userId: 'user-1', permissions: ['read'] };
        await datasourcesExtendedApi.createGrant(dataplaneUrl, 'test-source', authConfig, grantData);

        expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/grants', {
          body: grantData
        });
      });
    });

    describe('getGrant', () => {
      it('should get grant by ID or key', async() => {
        await datasourcesExtendedApi.getGrant(dataplaneUrl, 'test-source', 'grant-1', authConfig);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/grants/grant-1');
      });
    });

    describe('updateGrant', () => {
      it('should update grant', async() => {
        const updateData = { permissions: ['read', 'write'] };
        await datasourcesExtendedApi.updateGrant(dataplaneUrl, 'test-source', 'grant-1', authConfig, updateData);

        expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/test-source/grants/grant-1', {
          body: updateData
        });
      });
    });

    describe('deleteGrant', () => {
      it('should delete grant', async() => {
        await datasourcesExtendedApi.deleteGrant(dataplaneUrl, 'test-source', 'grant-1', authConfig);

        expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/test-source/grants/grant-1');
      });
    });
  });

  describe('Policies', () => {
    describe('listPolicies', () => {
      it('should list policies without options', async() => {
        await datasourcesExtendedApi.listPolicies(dataplaneUrl, 'test-source', authConfig);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/policies', {
          params: {}
        });
      });

      it('should list policies with options', async() => {
        const options = { type: 'security' };
        await datasourcesExtendedApi.listPolicies(dataplaneUrl, 'test-source', authConfig, options);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/policies', {
          params: options
        });
      });
    });

    describe('attachPolicy', () => {
      it('should attach policy', async() => {
        const policyData = { policyId: 'policy-1' };
        await datasourcesExtendedApi.attachPolicy(dataplaneUrl, 'test-source', authConfig, policyData);

        expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/policies', {
          body: policyData
        });
      });
    });

    describe('detachPolicy', () => {
      it('should detach policy', async() => {
        await datasourcesExtendedApi.detachPolicy(dataplaneUrl, 'test-source', 'policy-1', authConfig);

        expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/external/test-source/policies/policy-1');
      });
    });
  });

  describe('Sync Jobs', () => {
    describe('listSyncJobs', () => {
      it('should list sync jobs without options', async() => {
        await datasourcesExtendedApi.listSyncJobs(dataplaneUrl, 'test-source', authConfig);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/sync', {
          params: {}
        });
      });

      it('should list sync jobs with options', async() => {
        const options = { status: 'running' };
        await datasourcesExtendedApi.listSyncJobs(dataplaneUrl, 'test-source', authConfig, options);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/sync', {
          params: options
        });
      });
    });

    describe('createSyncJob', () => {
      it('should create sync job', async() => {
        const syncData = { schedule: 'daily', config: {} };
        await datasourcesExtendedApi.createSyncJob(dataplaneUrl, 'test-source', authConfig, syncData);

        expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/sync', {
          body: syncData
        });
      });
    });

    describe('getSyncJob', () => {
      it('should get sync job by ID', async() => {
        await datasourcesExtendedApi.getSyncJob(dataplaneUrl, 'test-source', 'sync-1', authConfig);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/test-source/sync/sync-1');
      });
    });

    describe('updateSyncJob', () => {
      it('should update sync job', async() => {
        const updateData = { schedule: 'hourly' };
        await datasourcesExtendedApi.updateSyncJob(dataplaneUrl, 'test-source', 'sync-1', authConfig, updateData);

        expect(mockClient.put).toHaveBeenCalledWith('/api/v1/external/test-source/sync/sync-1', {
          body: updateData
        });
      });
    });

    describe('executeSyncJob', () => {
      it('should execute sync job', async() => {
        await datasourcesExtendedApi.executeSyncJob(dataplaneUrl, 'test-source', 'sync-1', authConfig);

        expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/test-source/sync/sync-1/execute');
      });
    });
  });

  describe('Documents', () => {
    describe('validateDocuments', () => {
      it('should validate documents', async() => {
        const validateData = { documents: [] };
        await datasourcesExtendedApi.validateDocuments(dataplaneUrl, 'test-source', authConfig, validateData);

        expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/data-sources/test-source/documents/validate', {
          body: validateData
        });
      });
    });

    describe('bulkDocuments', () => {
      it('should perform bulk document operation', async() => {
        const bulkData = { operation: 'import', documents: [] };
        await datasourcesExtendedApi.bulkDocuments(dataplaneUrl, 'test-source', authConfig, bulkData);

        expect(mockClient.post).toHaveBeenCalledWith('/api/v1/external/data-sources/test-source/documents/bulk', {
          body: bulkData
        });
      });
    });

    describe('listDocuments', () => {
      it('should list documents without options', async() => {
        await datasourcesExtendedApi.listDocuments(dataplaneUrl, 'test-source', authConfig);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/data-sources/test-source/documents', {
          params: {}
        });
      });

      it('should list documents with options', async() => {
        const options = { page: 1, pageSize: 50 };
        await datasourcesExtendedApi.listDocuments(dataplaneUrl, 'test-source', authConfig, options);

        expect(mockClient.get).toHaveBeenCalledWith('/api/v1/external/data-sources/test-source/documents', {
          params: options
        });
      });
    });
  });

  describe('error handling', () => {
    it('should handle errors from listRecords', async() => {
      const error = new Error('Network error');
      mockClient.get.mockRejectedValue(error);

      await expect(datasourcesExtendedApi.listRecords(dataplaneUrl, 'test-source', authConfig)).rejects.toThrow('Network error');
    });

    it('should handle errors from createRecord', async() => {
      const error = new Error('Validation error');
      mockClient.post.mockRejectedValue(error);

      await expect(datasourcesExtendedApi.createRecord(dataplaneUrl, 'test-source', authConfig, {})).rejects.toThrow('Validation error');
    });

    it('should handle errors from updateGrant', async() => {
      const error = new Error('Not found');
      mockClient.put.mockRejectedValue(error);

      await expect(datasourcesExtendedApi.updateGrant(dataplaneUrl, 'test-source', 'grant-1', authConfig, {})).rejects.toThrow('Not found');
    });

    it('should handle errors from deleteRecord', async() => {
      const error = new Error('Delete failed');
      mockClient.delete.mockRejectedValue(error);

      await expect(datasourcesExtendedApi.deleteRecord(dataplaneUrl, 'test-source', 'record-1', authConfig)).rejects.toThrow('Delete failed');
    });
  });
});

