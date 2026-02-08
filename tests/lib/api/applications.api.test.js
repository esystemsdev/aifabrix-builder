/**
 * Tests for Applications API
 *
 * @fileoverview Tests for lib/api/applications.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => {
  return {
    baseUrl,
    authConfig,
    get: mockClient.get,
    post: mockClient.post,
    patch: mockClient.patch,
    delete: mockClient.delete
  };
});

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient
}));

const applicationsApi = require('../../../lib/api/applications.api');

describe('Applications API', () => {
  const controllerUrl = 'https://api.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: [] });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
    mockClient.patch.mockResolvedValue({ success: true, data: {} });
    mockClient.delete.mockResolvedValue({ success: true, data: null });
  });

  describe('listApplications', () => {
    it('should list applications without options', async() => {
      await applicationsApi.listApplications(controllerUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/applications', {
        params: {}
      });
    });

    it('should list applications with pagination options', async() => {
      const options = { page: 1, pageSize: 10, search: 'test' };
      await applicationsApi.listApplications(controllerUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/applications', {
        params: options
      });
    });

    it('should list applications with all options', async() => {
      const options = { page: 1, pageSize: 10, sort: 'name', filter: 'active', search: 'test' };
      await applicationsApi.listApplications(controllerUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/applications', {
        params: options
      });
    });

    it('should handle listApplications errors', async() => {
      const error = new Error('List applications failed');
      mockClient.get.mockRejectedValue(error);

      await expect(applicationsApi.listApplications(controllerUrl, authConfig)).rejects.toThrow('List applications failed');
    });
  });

  describe('createApplication', () => {
    it('should create application', async() => {
      const applicationData = {
        key: 'test-app',
        displayName: 'Test App',
        configuration: {}
      };
      await applicationsApi.createApplication(controllerUrl, authConfig, applicationData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/applications', {
        body: applicationData
      });
    });

    it('should create application with all fields', async() => {
      const applicationData = {
        key: 'test-app',
        displayName: 'Test App',
        description: 'Test description',
        url: 'https://example.com',
        configuration: { key: 'value' }
      };
      await applicationsApi.createApplication(controllerUrl, authConfig, applicationData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/applications', {
        body: applicationData
      });
    });

    it('should handle createApplication errors', async() => {
      const applicationData = {
        key: 'test-app',
        displayName: 'Test App',
        configuration: {}
      };
      const error = new Error('Create application failed');
      mockClient.post.mockRejectedValue(error);

      await expect(applicationsApi.createApplication(controllerUrl, authConfig, applicationData)).rejects.toThrow('Create application failed');
    });
  });

  describe('getApplication', () => {
    it('should get application by key', async() => {
      await applicationsApi.getApplication(controllerUrl, 'test-app', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/applications/test-app');
    });

    it('should handle getApplication errors', async() => {
      const error = new Error('Get application failed');
      mockClient.get.mockRejectedValue(error);

      await expect(applicationsApi.getApplication(controllerUrl, 'test-app', authConfig)).rejects.toThrow('Get application failed');
    });
  });

  describe('updateApplication', () => {
    it('should update application', async() => {
      const updateData = { displayName: 'Updated Name' };
      await applicationsApi.updateApplication(controllerUrl, 'test-app', authConfig, updateData);

      expect(mockClient.patch).toHaveBeenCalledWith('/api/v1/applications/test-app', {
        body: updateData
      });
    });

    it('should update application with all fields', async() => {
      const updateData = {
        displayName: 'Updated Name',
        description: 'Updated description',
        url: 'https://updated.com',
        configuration: { key: 'value' },
        status: 'active'
      };
      await applicationsApi.updateApplication(controllerUrl, 'test-app', authConfig, updateData);

      expect(mockClient.patch).toHaveBeenCalledWith('/api/v1/applications/test-app', {
        body: updateData
      });
    });

    it('should handle updateApplication errors', async() => {
      const updateData = { displayName: 'Updated Name' };
      const error = new Error('Update application failed');
      mockClient.patch.mockRejectedValue(error);

      await expect(applicationsApi.updateApplication(controllerUrl, 'test-app', authConfig, updateData)).rejects.toThrow('Update application failed');
    });
  });

  describe('deleteApplication', () => {
    it('should delete application', async() => {
      await applicationsApi.deleteApplication(controllerUrl, 'test-app', authConfig);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/applications/test-app');
    });

    it('should handle deleteApplication errors', async() => {
      const error = new Error('Delete application failed');
      mockClient.delete.mockRejectedValue(error);

      await expect(applicationsApi.deleteApplication(controllerUrl, 'test-app', authConfig)).rejects.toThrow('Delete application failed');
    });
  });

  describe('registerApplication', () => {
    it('should register application in environment', async() => {
      const envKey = 'dev';
      const registrationData = {
        key: 'test-app',
        displayName: 'Test App',
        type: 'container',
        configuration: {}
      };
      await applicationsApi.registerApplication(controllerUrl, envKey, authConfig, registrationData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications/register`,
        { body: registrationData }
      );
    });

    it('should register application with all fields', async() => {
      const envKey = 'dev';
      const registrationData = {
        key: 'test-app',
        displayName: 'Test App',
        type: 'container',
        description: 'Test description',
        registryMode: 'acr',
        port: 3000,
        image: 'test-image:latest',
        externalIntegration: { type: 'webhook' }
      };
      await applicationsApi.registerApplication(controllerUrl, envKey, authConfig, registrationData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications/register`,
        { body: registrationData }
      );
    });

    it('should handle registerApplication errors', async() => {
      const envKey = 'dev';
      const registrationData = {
        key: 'test-app',
        displayName: 'Test App',
        type: 'container'
      };
      const error = new Error('Register application failed');
      mockClient.post.mockRejectedValue(error);

      await expect(applicationsApi.registerApplication(controllerUrl, envKey, authConfig, registrationData)).rejects.toThrow('Register application failed');
    });
  });

  describe('rotateApplicationSecret', () => {
    it('should rotate application secret', async() => {
      const envKey = 'dev';
      const appKey = 'test-app';
      const response = { success: true, data: { clientId: 'new-id', clientSecret: 'new-secret' } };
      mockClient.post.mockResolvedValue(response);

      const result = await applicationsApi.rotateApplicationSecret(
        controllerUrl,
        envKey,
        appKey,
        authConfig
      );

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications/${appKey}/rotate-secret`
      );
      expect(result).toEqual(response);
    });

    it('should handle rotateApplicationSecret errors', async() => {
      const envKey = 'dev';
      const appKey = 'test-app';
      const error = new Error('Rotate secret failed');
      mockClient.post.mockRejectedValue(error);

      await expect(applicationsApi.rotateApplicationSecret(controllerUrl, envKey, appKey, authConfig)).rejects.toThrow('Rotate secret failed');
    });
  });

  describe('getApplicationStatus', () => {
    it('should get application status', async() => {
      const envKey = 'dev';
      const appKey = 'my-app';
      const response = { success: true, data: { key: appKey, status: 'running' } };
      mockClient.get.mockResolvedValue(response);

      const result = await applicationsApi.getApplicationStatus(
        controllerUrl,
        envKey,
        appKey,
        authConfig
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications/${appKey}/status`
      );
      expect(result).toEqual(response);
    });

    it('should handle getApplicationStatus errors', async() => {
      const envKey = 'dev';
      const appKey = 'my-app';
      const error = new Error('Get status failed');
      mockClient.get.mockRejectedValue(error);

      await expect(
        applicationsApi.getApplicationStatus(controllerUrl, envKey, appKey, authConfig)
      ).rejects.toThrow('Get status failed');
    });
  });
});

