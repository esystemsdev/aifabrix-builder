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

    it('should send controller-spec validate body (clientId, clientSecret, repositoryUrl, applicationConfig)', async() => {
      const validationData = {
        clientId: 'app-client-id',
        clientSecret: 'app-client-secret',
        repositoryUrl: 'https://github.com/org/repo',
        applicationConfig: {
          key: 'myapp',
          displayName: 'My App',
          type: 'webapp',
          image: 'myregistry.azurecr.io/myapp:v1',
          registryMode: 'acr',
          port: 3000
        }
      };
      mockClient.post.mockResolvedValue({
        success: true,
        data: {
          valid: true,
          deploymentType: 'azure',
          validateToken: 'hex-string-one-time-token',
          draftDeploymentId: 'cuid-of-draft-deployment',
          imageServer: 'myregistry.azurecr.io',
          imageUsername: 'optional',
          imagePassword: 'optional',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      });

      const result = await pipelineApi.validatePipeline(controllerUrl, envKey, authConfig, validationData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${envKey}/validate`,
        { body: validationData }
      );
      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
      expect(result.data.validateToken).toBe('hex-string-one-time-token');
      expect(result.data.draftDeploymentId).toBe('cuid-of-draft-deployment');
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

    it('should send controller-spec deploy body (validateToken, imageTag) and accept 202 response', async() => {
      const deployData = {
        validateToken: 'hex-string-from-validate-response',
        imageTag: 'v1.0.0'
      };
      mockClient.post.mockResolvedValue({
        success: true,
        data: { deploymentId: 'deploy-123', status: 'deploying' },
        status: 202
      });

      const result = await pipelineApi.deployPipeline(controllerUrl, envKey, authConfig, deployData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${envKey}/deploy`,
        { body: deployData }
      );
      expect(result.success).toBe(true);
      expect(result.data.deploymentId).toBe('deploy-123');
      expect(result.data.status).toBe('deploying');
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

    it('should return controller-spec status shape (id, status, progress, message, error, startedAt, completedAt, deploymentUrl, healthCheckUrl)', async() => {
      const deploymentId = 'deploy-123';
      mockClient.get.mockResolvedValue({
        success: true,
        data: {
          id: deploymentId,
          status: 'completed',
          progress: 100,
          message: 'Deployment completed',
          error: null,
          startedAt: '2024-01-01T12:00:00Z',
          completedAt: '2024-01-01T12:05:00Z',
          deploymentUrl: 'https://app.example.com/myapp',
          healthCheckUrl: 'https://app.example.com/myapp/health'
        }
      });

      const result = await pipelineApi.getPipelineDeployment(controllerUrl, envKey, deploymentId, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/pipeline/${envKey}/deployments/${deploymentId}`
      );
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(deploymentId);
      expect(result.data.status).toBe('completed');
      expect(result.data.progress).toBe(100);
      expect(result.data.deploymentUrl).toBeDefined();
      expect(result.data.healthCheckUrl).toBeDefined();
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

    it('should publish datasource via dataplane pipeline endpoint (POST .../upload)', async() => {
      await pipelineApi.publishDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/pipeline/${systemKey}/upload`,
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

  describe('testSystemViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const systemKey = 'test-system';
    const testData = { includeDebug: true };

    it('should test system via unified validation run endpoint', async() => {
      await pipelineApi.testSystemViaPipeline(dataplaneUrl, systemKey, authConfig, testData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/validation/run', {
        body: {
          validationScope: 'externalSystem',
          runType: 'test',
          systemIdOrKey: systemKey,
          includeDebug: true
        }
      });
    });

    it('should include payloadTemplate only when caller provides it', async() => {
      await pipelineApi.testSystemViaPipeline(dataplaneUrl, systemKey, authConfig, {
        payloadTemplate: { foo: 'bar' }
      });
      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/validation/run', {
        body: {
          validationScope: 'externalSystem',
          runType: 'test',
          systemIdOrKey: systemKey,
          payloadTemplate: { foo: 'bar' }
        }
      });
    });

    it('should pass timeout option when provided', async() => {
      const options = { timeout: 5000 };
      await pipelineApi.testSystemViaPipeline(dataplaneUrl, systemKey, authConfig, testData, options);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/validation/run', {
        body: {
          validationScope: 'externalSystem',
          runType: 'test',
          systemIdOrKey: systemKey,
          includeDebug: true
        },
        timeout: 5000
      });
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

    it('should test datasource via unified validation run endpoint', async() => {
      await pipelineApi.testDatasourceViaPipeline({ dataplaneUrl, systemKey, datasourceKey, authConfig, testData });

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/validation/run', {
        body: {
          validationScope: 'externalDataSource',
          runType: 'test',
          systemIdOrKey: systemKey,
          payloadTemplate: testData.payloadTemplate,
          datasourceKeys: [datasourceKey]
        }
      });
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.testDatasourceViaPipeline({ dataplaneUrl, systemKey, datasourceKey, authConfig, testData });

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });

    it('should pass timeout option when provided', async() => {
      const options = { timeout: 60000 };
      await pipelineApi.testDatasourceViaPipeline({ dataplaneUrl, systemKey, datasourceKey, authConfig, testData, options });

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/validation/run', {
        body: {
          validationScope: 'externalDataSource',
          runType: 'test',
          systemIdOrKey: systemKey,
          payloadTemplate: testData.payloadTemplate,
          datasourceKeys: [datasourceKey]
        },
        timeout: 60000
      });
    });

    it('should return success response', async() => {
      const response = await pipelineApi.testDatasourceViaPipeline({ dataplaneUrl, systemKey, datasourceKey, authConfig, testData });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should handle error response', async() => {
      mockClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Test failed',
        formattedError: 'Test failed: Invalid payload'
      });

      const response = await pipelineApi.testDatasourceViaPipeline({ dataplaneUrl, systemKey, datasourceKey, authConfig, testData });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Test failed');
    });
  });

  describe('uploadApplicationViaPipeline', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const payload = {
      version: '1.0.0',
      application: { key: 'test-app', displayName: 'Test App' },
      dataSources: []
    };

    it('should upload application via dataplane pipeline endpoint with status in body', async() => {
      await pipelineApi.uploadApplicationViaPipeline(dataplaneUrl, authConfig, payload);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/pipeline/upload',
        { body: { ...payload, status: 'draft' } }
      );
    });

    it('should include explicit status when provided', async() => {
      await pipelineApi.uploadApplicationViaPipeline(dataplaneUrl, authConfig, { ...payload, status: 'published' });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/pipeline/upload',
        { body: { ...payload, status: 'published' } }
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.uploadApplicationViaPipeline(dataplaneUrl, authConfig, payload);

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });
  });

  describe('validatePipelineConfig', () => {
    const dataplaneUrl = 'https://dataplane.example.com';
    const config = {
      version: '1.0.0',
      application: { key: 'sys1', displayName: 'System 1' },
      dataSources: []
    };

    it('should call POST /api/v1/pipeline/validate with config in body', async() => {
      await pipelineApi.validatePipelineConfig(dataplaneUrl, authConfig, { config });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/pipeline/validate',
        { body: { config } }
      );
    });

    it('should use dataplane URL as base URL', async() => {
      await pipelineApi.validatePipelineConfig(dataplaneUrl, authConfig, { config });

      expect(mockApiClient).toHaveBeenCalledWith(dataplaneUrl, authConfig);
    });

    it('should return validation result', async() => {
      mockClient.post.mockResolvedValue({
        success: true,
        data: { isValid: true, errors: [], warnings: [] }
      });

      const result = await pipelineApi.validatePipelineConfig(dataplaneUrl, authConfig, { config });

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(true);
    });

    it('should return invalid result when validation fails', async() => {
      mockClient.post.mockResolvedValue({
        success: true,
        data: { isValid: false, errors: ['Invalid application key'], warnings: [] }
      });

      const result = await pipelineApi.validatePipelineConfig(dataplaneUrl, authConfig, { config });

      expect(result.data.isValid).toBe(false);
      expect(result.data.errors).toEqual(['Invalid application key']);
    });
  });
});

