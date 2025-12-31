/**
 * Tests for AI Fabrix Builder Datasource Deploy Module
 *
 * @fileoverview Unit tests for datasource-deploy.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const chalk = require('chalk');

// Mock modules
jest.mock('fs');
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});
jest.mock('../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn()
}));
jest.mock('../../lib/api/environments.api', () => ({
  getEnvironmentApplication: jest.fn()
}));
jest.mock('../../lib/api/pipeline.api', () => ({
  publishDatasourceViaPipeline: jest.fn()
}));
jest.mock('../../lib/utils/api-error-handler', () => ({
  formatApiError: jest.fn()
}));
jest.mock('../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../lib/datasource-validate', () => ({
  validateDatasourceFile: jest.fn()
}));

const fsSync = require('fs');
const { getDeploymentAuth } = require('../../lib/utils/token-manager');
const { getEnvironmentApplication } = require('../../lib/api/environments.api');
const { publishDatasourceViaPipeline } = require('../../lib/api/pipeline.api');
const { formatApiError } = require('../../lib/utils/api-error-handler');
const logger = require('../../lib/utils/logger');
const { validateDatasourceFile } = require('../../lib/datasource-validate');

describe('Datasource Deploy Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDataplaneUrl', () => {
    it('should get dataplane URL from application response', async() => {
      const controllerUrl = 'http://localhost:3010';
      const appKey = 'myapp';
      const environment = 'dev';
      const authConfig = {
        type: 'bearer',
        token: 'test-token'
      };

      const mockResponse = {
        success: true,
        data: {
          data: {
            dataplaneUrl: 'http://dataplane:8080'
          }
        }
      };

      getEnvironmentApplication.mockResolvedValue(mockResponse);

      const { getDataplaneUrl } = require('../../lib/datasource-deploy');
      const result = await getDataplaneUrl(controllerUrl, appKey, environment, authConfig);

      expect(result).toBe('http://dataplane:8080');
      expect(getEnvironmentApplication).toHaveBeenCalledWith(
        controllerUrl,
        environment,
        appKey,
        authConfig
      );
    });

    it('should extract dataplane URL from nested response', async() => {
      const authConfig = {
        type: 'bearer',
        token: 'test-token'
      };

      const mockResponse = {
        success: true,
        data: {
          dataplane: {
            url: 'http://dataplane:8080'
          }
        }
      };

      getEnvironmentApplication.mockResolvedValue(mockResponse);

      const { getDataplaneUrl } = require('../../lib/datasource-deploy');
      const result = await getDataplaneUrl('http://localhost:3010', 'myapp', 'dev', authConfig);

      expect(result).toBe('http://dataplane:8080');
    });

    it('should extract dataplane URL from configuration', async() => {
      const authConfig = {
        type: 'bearer',
        token: 'test-token'
      };

      const mockResponse = {
        success: true,
        data: {
          configuration: {
            dataplaneUrl: 'http://dataplane:8080'
          }
        }
      };

      getEnvironmentApplication.mockResolvedValue(mockResponse);

      const { getDataplaneUrl } = require('../../lib/datasource-deploy');
      const result = await getDataplaneUrl('http://localhost:3010', 'myapp', 'dev', authConfig);

      expect(result).toBe('http://dataplane:8080');
    });

    it('should throw error if dataplane URL not found', async() => {
      const authConfig = {
        type: 'bearer',
        token: 'test-token'
      };

      const mockResponse = {
        success: true,
        data: {}
      };

      getEnvironmentApplication.mockResolvedValue(mockResponse);

      const { getDataplaneUrl } = require('../../lib/datasource-deploy');
      await expect(getDataplaneUrl('http://localhost:3010', 'myapp', 'dev', authConfig))
        .rejects.toThrow('Dataplane URL not found');
    });

    it('should throw error if API call fails', async() => {
      const authConfig = {
        type: 'bearer',
        token: 'test-token'
      };

      const mockResponse = {
        success: false,
        formattedError: 'API Error'
      };

      getEnvironmentApplication.mockResolvedValue(mockResponse);
      formatApiError.mockReturnValue('API Error');

      const { getDataplaneUrl } = require('../../lib/datasource-deploy');
      await expect(getDataplaneUrl('http://localhost:3010', 'myapp', 'dev', authConfig))
        .rejects.toThrow('Failed to get application from controller');
    });

    it('should throw error for non-bearer authentication', async() => {
      const authConfig = {
        type: 'client-credentials',
        username: 'user',
        password: 'pass'
      };

      getEnvironmentApplication.mockRejectedValue(new Error('Bearer token authentication required'));

      const { getDataplaneUrl } = require('../../lib/datasource-deploy');
      await expect(getDataplaneUrl('http://localhost:3010', 'myapp', 'dev', authConfig))
        .rejects.toThrow('Bearer token authentication required');
    });
  });

  describe('deployDatasource', () => {
    it('should deploy datasource successfully', async() => {
      const appKey = 'myapp';
      const filePath = '/path/to/datasource.json';
      const options = {
        controller: 'http://localhost:3010',
        environment: 'dev'
      };

      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot',
        displayName: 'Test Datasource'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token'
      });

      getEnvironmentApplication.mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            dataplaneUrl: 'http://dataplane:8080'
          }
        }
      });
      publishDatasourceViaPipeline.mockResolvedValueOnce({
        success: true,
        data: { success: true }
      });

      const { deployDatasource } = require('../../lib/datasource-deploy');
      const result = await deployDatasource(appKey, filePath, options);

      expect(result.success).toBe(true);
      expect(result.datasourceKey).toBe('test-datasource');
      expect(result.systemKey).toBe('hubspot');
      expect(result.environment).toBe('dev');
      expect(validateDatasourceFile).toHaveBeenCalledWith(filePath);
      expect(publishDatasourceViaPipeline).toHaveBeenCalledTimes(1);
    });

    it('should throw error if appKey is missing', async() => {
      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource(null, '/path/to/file.json', { controller: 'http://localhost:3010', environment: 'dev' }))
        .rejects.toThrow('Application key is required');
    });

    it('should throw error if filePath is missing', async() => {
      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource('myapp', null, { controller: 'http://localhost:3010', environment: 'dev' }))
        .rejects.toThrow('File path is required');
    });

    it('should throw error if controller is missing', async() => {
      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource('myapp', '/path/to/file.json', { environment: 'dev' }))
        .rejects.toThrow('Controller URL is required');
    });

    it('should throw error if environment is missing', async() => {
      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource('myapp', '/path/to/file.json', { controller: 'http://localhost:3010' }))
        .rejects.toThrow('Environment is required');
    });

    it('should throw error if validation fails', async() => {
      validateDatasourceFile.mockResolvedValue({
        valid: false,
        errors: ['Validation error'],
        warnings: []
      });

      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource('myapp', '/path/to/file.json', {
        controller: 'http://localhost:3010',
        environment: 'dev'
      })).rejects.toThrow('Datasource file validation failed');
    });

    it('should throw error if systemKey is missing', async() => {
      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify({
        key: 'test-datasource'
        // Missing systemKey
      }));

      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource('myapp', '/path/to/file.json', {
        controller: 'http://localhost:3010',
        environment: 'dev'
      })).rejects.toThrow('systemKey is required');
    });

    it('should throw error if datasource file is invalid JSON', async() => {
      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      fsSync.readFileSync.mockReturnValue('invalid json {');

      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource('myapp', '/path/to/file.json', {
        controller: 'http://localhost:3010',
        environment: 'dev'
      })).rejects.toThrow('Failed to parse datasource file');
    });

    it('should throw error if dataplane deployment fails', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token'
      });

      getEnvironmentApplication.mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            dataplaneUrl: 'http://dataplane:8080'
          }
        }
      });
      publishDatasourceViaPipeline.mockResolvedValueOnce({
        success: false,
        formattedError: 'Deployment failed'
      });

      formatApiError.mockReturnValue('Deployment failed');

      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource('myapp', '/path/to/file.json', {
        controller: 'http://localhost:3010',
        environment: 'dev'
      })).rejects.toThrow('Dataplane publish failed');
    });

    it('should throw error for non-bearer authentication in deployment', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'client-credentials',
        username: 'user',
        password: 'pass'
      });

      getEnvironmentApplication.mockRejectedValue(new Error('Bearer token authentication required'));

      const { deployDatasource } = require('../../lib/datasource-deploy');
      await expect(deployDatasource('myapp', '/path/to/file.json', {
        controller: 'http://localhost:3010',
        environment: 'dev'
      })).rejects.toThrow('Bearer token authentication required');
    });
  });
});

