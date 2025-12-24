/**
 * Tests for Deployments API
 *
 * @fileoverview Tests for lib/api/deployments.api.js module
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

const deploymentsApi = require('../../../lib/api/deployments.api');

describe('Deployments API', () => {
  const controllerUrl = 'https://api.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };
  const envKey = 'dev';

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: [] });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
  });

  describe('deployApplication', () => {
    it('should deploy application to environment', async() => {
      const deployData = {
        applicationKey: 'test-app',
        image: 'test-image:latest'
      };
      await deploymentsApi.deployApplication(controllerUrl, envKey, authConfig, deployData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications/deploy`,
        { body: deployData }
      );
    });

    it('should deploy application with configuration', async() => {
      const deployData = {
        applicationKey: 'test-app',
        image: 'test-image:latest',
        configuration: { port: 8080 },
        dryRun: true
      };
      await deploymentsApi.deployApplication(controllerUrl, envKey, authConfig, deployData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications/deploy`,
        { body: deployData }
      );
    });
  });

  describe('deployEnvironment', () => {
    it('should deploy environment infrastructure', async() => {
      const deployData = {
        environmentConfig: {
          key: 'dev',
          environment: 'dev',
          preset: 'm',
          serviceName: 'test-service',
          location: 'eastus'
        }
      };
      await deploymentsApi.deployEnvironment(controllerUrl, envKey, authConfig, deployData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/deploy`,
        { body: deployData }
      );
    });
  });

  describe('listDeployments', () => {
    it('should list deployments without options', async() => {
      await deploymentsApi.listDeployments(controllerUrl, envKey, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/deployments`,
        { params: {} }
      );
    });

    it('should list deployments with options', async() => {
      const options = { page: 1, pageSize: 10, status: 'completed' };
      await deploymentsApi.listDeployments(controllerUrl, envKey, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/deployments`,
        { params: options }
      );
    });
  });

  describe('getDeployment', () => {
    it('should get deployment with jobs and logs', async() => {
      const deploymentId = 'deployment-123';
      await deploymentsApi.getDeployment(controllerUrl, envKey, deploymentId, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/deployments/${deploymentId}`
      );
    });
  });

  describe('getDeploymentLogs', () => {
    it('should get deployment logs without options', async() => {
      const deploymentId = 'deployment-123';
      await deploymentsApi.getDeploymentLogs(controllerUrl, envKey, deploymentId, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/deployments/${deploymentId}/logs`,
        { params: {} }
      );
    });

    it('should get deployment logs with filters', async() => {
      const deploymentId = 'deployment-123';
      const options = { jobId: 'job-123', level: 'error', since: '2024-01-01T00:00:00Z' };
      await deploymentsApi.getDeploymentLogs(controllerUrl, envKey, deploymentId, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/deployments/${deploymentId}/logs`,
        { params: options }
      );
    });
  });
});

