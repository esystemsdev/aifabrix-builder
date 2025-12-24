/**
 * Tests for Pipeline API
 *
 * @fileoverview Tests for lib/api/pipeline.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => {
  return {
    baseUrl,
    authConfig,
    get: mockClient.get,
    post: mockClient.post
  };
});

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient
}));

const pipelineApi = require('../../../lib/api/pipeline.api');

describe('Pipeline API', () => {
  const controllerUrl = 'https://api.example.com';
  const authConfig = { type: 'client-credentials', clientId: 'client-id', clientSecret: 'secret' };
  const envKey = 'dev';

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: {} });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
  });

  describe('validatePipeline', () => {
    it('should validate deployment configuration', async() => {
      const validationData = {
        clientId: 'client-id',
        repositoryUrl: 'https://github.com/user/repo',
        applicationConfig: { key: 'test-app' }
      };
      await pipelineApi.validatePipeline(controllerUrl, envKey, authConfig, validationData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${envKey}/validate`,
        { body: validationData }
      );
    });
  });

  describe('deployPipeline', () => {
    it('should deploy application using validateToken', async() => {
      const deployData = {
        validateToken: 'validate-token-123',
        imageTag: 'latest'
      };
      await pipelineApi.deployPipeline(controllerUrl, envKey, authConfig, deployData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${envKey}/deploy`,
        { body: deployData }
      );
    });
  });

  describe('getPipelineDeployment', () => {
    it('should get deployment status for CI/CD', async() => {
      const deploymentId = 'deployment-123';
      await pipelineApi.getPipelineDeployment(controllerUrl, envKey, deploymentId, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/pipeline/${envKey}/deployments/${deploymentId}`
      );
    });
  });

  describe('getPipelineHealth', () => {
    it('should get pipeline health check', async() => {
      await pipelineApi.getPipelineHealth(controllerUrl, envKey);

      expect(mockClient.get).toHaveBeenCalledWith(`/api/v1/pipeline/${envKey}/health`);
    });

    it('should not require auth config for health check', async() => {
      await pipelineApi.getPipelineHealth(controllerUrl, envKey);

      expect(mockClient.get).toHaveBeenCalled();
    });
  });

  describe('publishDatasourceViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const systemKey = 'test-system';
    const datasourceConfig = {
      key: 'test-datasource',
      displayName: 'Test Datasource',
      systemKey: systemKey,
      entityKey: 'test-entity'
    };

    it('should publish datasource via dataplane pipeline endpoint', async() => {
      await pipelineApi.publishDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${systemKey}/publish`,
        { body: datasourceConfig }
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.publishDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });

    it('should return success response', async() => {
      const response = await pipelineApi.publishDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should handle error response', async() => {
      mockClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Publish failed',
        formattedError: 'Publish failed: Invalid configuration'
      });

      const response = await pipelineApi.publishDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Publish failed');
    });
  });

  describe('testDatasourceViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const systemKey = 'test-system';
    const datasourceKey = 'test-datasource';
    const testData = {
      payloadTemplate: {
        field1: 'value1',
        field2: 'value2'
      }
    };

    it('should test datasource via dataplane pipeline endpoint', async() => {
      await pipelineApi.testDatasourceViaPipeline(dataplaneUrl, systemKey, datasourceKey, authConfig, testData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${systemKey}/${datasourceKey}/test`,
        { body: testData }
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.testDatasourceViaPipeline(dataplaneUrl, systemKey, datasourceKey, authConfig, testData);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });

    it('should pass timeout option when provided', async() => {
      const options = { timeout: 60000 };
      await pipelineApi.testDatasourceViaPipeline(dataplaneUrl, systemKey, datasourceKey, authConfig, testData, options);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${systemKey}/${datasourceKey}/test`,
        { body: testData, timeout: 60000 }
      );
    });

    it('should return success response', async() => {
      const response = await pipelineApi.testDatasourceViaPipeline(dataplaneUrl, systemKey, datasourceKey, authConfig, testData);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should handle error response', async() => {
      mockClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Test failed',
        formattedError: 'Test failed: Invalid payload'
      });

      const response = await pipelineApi.testDatasourceViaPipeline(dataplaneUrl, systemKey, datasourceKey, authConfig, testData);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Test failed');
    });
  });

  describe('deployExternalSystemViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const systemConfig = {
      key: 'test-system',
      displayName: 'Test System',
      type: 'openapi'
    };

    it('should deploy external system via dataplane pipeline endpoint', async() => {
      await pipelineApi.deployExternalSystemViaPipeline(dataplaneUrl, authConfig, systemConfig);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/pipeline/deploy',
        { body: systemConfig }
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.deployExternalSystemViaPipeline(dataplaneUrl, authConfig, systemConfig);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });
  });

  describe('deployDatasourceViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const systemKey = 'test-system';
    const datasourceConfig = {
      key: 'test-datasource',
      systemKey: systemKey
    };

    it('should deploy datasource via dataplane pipeline endpoint', async() => {
      await pipelineApi.deployDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${systemKey}/deploy`,
        { body: datasourceConfig }
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.deployDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });
  });

  describe('uploadApplicationViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const applicationSchema = {
      key: 'test-app',
      displayName: 'Test App'
    };

    it('should upload application via dataplane pipeline endpoint', async() => {
      await pipelineApi.uploadApplicationViaPipeline(dataplaneUrl, authConfig, applicationSchema);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/pipeline/upload',
        { body: applicationSchema }
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.uploadApplicationViaPipeline(dataplaneUrl, authConfig, applicationSchema);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });
  });

  describe('validateUploadViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const uploadId = 'upload-123';

    it('should validate upload via dataplane pipeline endpoint', async() => {
      await pipelineApi.validateUploadViaPipeline(dataplaneUrl, uploadId, authConfig);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/upload/${uploadId}/validate`
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.validateUploadViaPipeline(dataplaneUrl, uploadId, authConfig);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });
  });

  describe('publishUploadViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const uploadId = 'upload-123';

    it('should publish upload via dataplane pipeline endpoint with default MCP contract', async() => {
      await pipelineApi.publishUploadViaPipeline(dataplaneUrl, uploadId, authConfig);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/upload/${uploadId}/publish?generateMcpContract=true`
      );
    });

    it('should publish upload with MCP contract disabled', async() => {
      await pipelineApi.publishUploadViaPipeline(dataplaneUrl, uploadId, authConfig, { generateMcpContract: false });

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/upload/${uploadId}/publish?generateMcpContract=false`
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.publishUploadViaPipeline(dataplaneUrl, uploadId, authConfig);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });
  });
});

