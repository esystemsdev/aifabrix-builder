/**
 * Tests for Environments API
 *
 * @fileoverview Tests for lib/api/environments.api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => {
  return {
    baseUrl,
    authConfig,
    get: mockClient.get,
    post: mockClient.post,
    patch: mockClient.patch
  };
});

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient
}));

const environmentsApi = require('../../../lib/api/environments.api');

describe('Environments API', () => {
  const controllerUrl = 'https://api.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };
  const envKey = 'dev';

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.get.mockResolvedValue({ success: true, data: {} });
    mockClient.post.mockResolvedValue({ success: true, data: {} });
    mockClient.patch.mockResolvedValue({ success: true, data: {} });
  });

  describe('listEnvironments', () => {
    it('should list environments without options', async() => {
      await environmentsApi.listEnvironments(controllerUrl, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/environments', {
        params: {}
      });
    });

    it('should list environments with options', async() => {
      const options = { page: 1, pageSize: 10, search: 'dev' };
      await environmentsApi.listEnvironments(controllerUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/environments', {
        params: options
      });
    });

    it('should list environments with all options', async() => {
      const options = { page: 1, pageSize: 10, sort: 'key', filter: 'active', search: 'dev', environment: 'dev', status: 'active' };
      await environmentsApi.listEnvironments(controllerUrl, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/environments', {
        params: options
      });
    });

    it('should handle listEnvironments errors', async() => {
      const error = new Error('List environments failed');
      mockClient.get.mockRejectedValue(error);

      await expect(environmentsApi.listEnvironments(controllerUrl, authConfig)).rejects.toThrow('List environments failed');
    });
  });

  describe('createEnvironment', () => {
    it('should create environment', async() => {
      const environmentData = {
        key: 'dev',
        environment: 'dev',
        configuration: {}
      };
      await environmentsApi.createEnvironment(controllerUrl, authConfig, environmentData);

      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/environments', {
        body: environmentData
      });
    });

    it('should handle createEnvironment errors', async() => {
      const environmentData = {
        key: 'dev',
        environment: 'dev',
        configuration: {}
      };
      const error = new Error('Create environment failed');
      mockClient.post.mockRejectedValue(error);

      await expect(environmentsApi.createEnvironment(controllerUrl, authConfig, environmentData)).rejects.toThrow('Create environment failed');
    });
  });

  describe('getEnvironment', () => {
    it('should get environment by key', async() => {
      await environmentsApi.getEnvironment(controllerUrl, envKey, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(`/api/v1/environments/${envKey}`);
    });

    it('should handle getEnvironment errors', async() => {
      const error = new Error('Get environment failed');
      mockClient.get.mockRejectedValue(error);

      await expect(environmentsApi.getEnvironment(controllerUrl, envKey, authConfig)).rejects.toThrow('Get environment failed');
    });
  });

  describe('updateEnvironment', () => {
    it('should update environment', async() => {
      const updateData = { configuration: { preset: 'l' } };
      await environmentsApi.updateEnvironment(controllerUrl, envKey, authConfig, updateData);

      expect(mockClient.patch).toHaveBeenCalledWith(`/api/v1/environments/${envKey}`, {
        body: updateData
      });
    });

    it('should handle updateEnvironment errors', async() => {
      const updateData = { configuration: { preset: 'l' } };
      const error = new Error('Update environment failed');
      mockClient.patch.mockRejectedValue(error);

      await expect(environmentsApi.updateEnvironment(controllerUrl, envKey, authConfig, updateData)).rejects.toThrow('Update environment failed');
    });
  });

  describe('getEnvironmentStatus', () => {
    it('should get environment status', async() => {
      await environmentsApi.getEnvironmentStatus(controllerUrl, envKey, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(`/api/v1/environments/${envKey}/status`);
    });

    it('should handle getEnvironmentStatus errors', async() => {
      const error = new Error('Get environment status failed');
      mockClient.get.mockRejectedValue(error);

      await expect(environmentsApi.getEnvironmentStatus(controllerUrl, envKey, authConfig)).rejects.toThrow('Get environment status failed');
    });
  });

  describe('listEnvironmentDeployments', () => {
    it('should list environment deployments', async() => {
      await environmentsApi.listEnvironmentDeployments(controllerUrl, envKey, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/deployments`,
        { params: {} }
      );
    });

    it('should list environment deployments with options', async() => {
      const options = { page: 1, status: 'completed' };
      await environmentsApi.listEnvironmentDeployments(controllerUrl, envKey, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/deployments`,
        { params: options }
      );
    });

    it('should handle listEnvironmentDeployments errors', async() => {
      const error = new Error('List environment deployments failed');
      mockClient.get.mockRejectedValue(error);

      await expect(environmentsApi.listEnvironmentDeployments(controllerUrl, envKey, authConfig)).rejects.toThrow('List environment deployments failed');
    });
  });

  describe('listEnvironmentRoles', () => {
    it('should list environment roles', async() => {
      await environmentsApi.listEnvironmentRoles(controllerUrl, envKey, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(`/api/v1/environments/${envKey}/roles`);
    });

    it('should handle listEnvironmentRoles errors', async() => {
      const error = new Error('List environment roles failed');
      mockClient.get.mockRejectedValue(error);

      await expect(environmentsApi.listEnvironmentRoles(controllerUrl, envKey, authConfig)).rejects.toThrow('List environment roles failed');
    });
  });

  describe('updateRoleGroups', () => {
    it('should map role to groups', async() => {
      const groups = ['group1', 'group2'];
      await environmentsApi.updateRoleGroups(controllerUrl, envKey, 'role-value', authConfig, groups);

      expect(mockClient.patch).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/roles/role-value/groups`,
        { body: { groups } }
      );
    });

    it('should handle updateRoleGroups errors', async() => {
      const groups = ['group1', 'group2'];
      const error = new Error('Update role groups failed');
      mockClient.patch.mockRejectedValue(error);

      await expect(environmentsApi.updateRoleGroups(controllerUrl, envKey, 'role-value', authConfig, groups)).rejects.toThrow('Update role groups failed');
    });
  });

  describe('listEnvironmentApplications', () => {
    it('should list applications in environment without options', async() => {
      await environmentsApi.listEnvironmentApplications(controllerUrl, envKey, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications`,
        { params: {} }
      );
    });

    it('should list applications in environment with options', async() => {
      const options = { page: 1, pageSize: 10, status: 'active' };
      await environmentsApi.listEnvironmentApplications(controllerUrl, envKey, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications`,
        { params: options }
      );
    });

    it('should list applications with all options', async() => {
      const options = { page: 1, pageSize: 10, sort: 'key', filter: 'active', status: 'active' };
      await environmentsApi.listEnvironmentApplications(controllerUrl, envKey, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications`,
        { params: options }
      );
    });

    it('should handle listEnvironmentApplications errors', async() => {
      const error = new Error('List environment applications failed');
      mockClient.get.mockRejectedValue(error);

      await expect(environmentsApi.listEnvironmentApplications(controllerUrl, envKey, authConfig)).rejects.toThrow('List environment applications failed');
    });
  });

  describe('getEnvironmentApplication', () => {
    it('should get application details in an environment', async() => {
      const appKey = 'test-app';
      await environmentsApi.getEnvironmentApplication(controllerUrl, envKey, appKey, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/applications/${appKey}`
      );
    });

    it('should use controller URL and auth config', async() => {
      const appKey = 'test-app';
      await environmentsApi.getEnvironmentApplication(controllerUrl, envKey, appKey, authConfig);

      expect(mockApiClient).toHaveBeenCalledWith(controllerUrl, authConfig);
    });

    it('should handle getEnvironmentApplication errors', async() => {
      const appKey = 'test-app';
      const error = new Error('Get environment application failed');
      mockClient.get.mockRejectedValue(error);

      await expect(environmentsApi.getEnvironmentApplication(controllerUrl, envKey, appKey, authConfig)).rejects.toThrow('Get environment application failed');
    });
  });

  describe('listEnvironmentDatasources', () => {
    it('should list datasources in environment without options', async() => {
      await environmentsApi.listEnvironmentDatasources(controllerUrl, envKey, authConfig);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/datasources`,
        { params: {} }
      );
    });

    it('should list datasources in environment with options', async() => {
      const options = { page: 1, pageSize: 20, sort: 'key' };
      await environmentsApi.listEnvironmentDatasources(controllerUrl, envKey, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/datasources`,
        { params: options }
      );
    });

    it('should use controller URL and auth config', async() => {
      await environmentsApi.listEnvironmentDatasources(controllerUrl, envKey, authConfig);

      expect(mockApiClient).toHaveBeenCalledWith(controllerUrl, authConfig);
    });

    it('should list datasources with all options', async() => {
      const options = { page: 1, pageSize: 20, sort: 'key', filter: 'active' };
      await environmentsApi.listEnvironmentDatasources(controllerUrl, envKey, authConfig, options);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/api/v1/environments/${envKey}/datasources`,
        { params: options }
      );
    });

    it('should handle listEnvironmentDatasources errors', async() => {
      const error = new Error('List environment datasources failed');
      mockClient.get.mockRejectedValue(error);

      await expect(environmentsApi.listEnvironmentDatasources(controllerUrl, envKey, authConfig)).rejects.toThrow('List environment datasources failed');
    });
  });
});

