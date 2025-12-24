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
  });

  describe('getApplication', () => {
    it('should get application by key', async() => {
      await applicationsApi.getApplication(controllerUrl, 'test-app', authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/applications/test-app');
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
  });

  describe('deleteApplication', () => {
    it('should delete application', async() => {
      await applicationsApi.deleteApplication(controllerUrl, 'test-app', authConfig);

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/applications/test-app');
    });
  });

  describe('registerApplication', () => {
    it('should register application in environment', async() => {
      const envKey = 'dev';
      const registrationData = {
        appKey: 'test-app',
        configuration: {}
      };
      await applicationsApi.registerApplication(controllerUrl, envKey, authConfig, registrationData);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications/register`,
        { body: registrationData }
      );
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
  });
});

