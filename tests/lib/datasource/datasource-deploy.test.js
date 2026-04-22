/**
 * Tests for AI Fabrix Builder Datasource Deploy Module
 *
 * @fileoverview Unit tests for datasource deploy module (used by aifabrix datasource upload command)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');

// Mock modules
jest.mock('fs');
jest.mock('chalk', () => {
  const id = (text) => text;
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn(id);
  mockChalk.red = jest.fn(id);
  mockChalk.blue = jest.fn(id);
  mockChalk.yellow = jest.fn(id);
  mockChalk.gray = jest.fn(id);
  mockChalk.cyan = jest.fn(id);
  mockChalk.white = Object.assign(jest.fn(id), { bold: jest.fn(id) });
  return mockChalk;
});
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn(),
  requireBearerForDataplanePipeline: jest.fn()
}));
jest.mock('../../../lib/api/environments.api', () => ({
  getEnvironmentApplication: jest.fn()
}));
jest.mock('../../../lib/api/pipeline.api', () => ({
  publishDatasourceViaPipeline: jest.fn()
}));
jest.mock('../../../lib/utils/api-error-handler', () => ({
  formatApiError: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../lib/datasource/validate', () => ({
  validateDatasourceFile: jest.fn()
}));
jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://localhost:3010')
}));
jest.mock('../../../lib/core/config', () => ({
  resolveEnvironment: jest.fn().mockResolvedValue('dev'),
  getDataplaneUrl: jest.fn().mockResolvedValue(null)
}));
jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn().mockResolvedValue('http://dataplane:8080')
}));
jest.mock('../../../lib/utils/command-header', () => ({
  displayCommandHeader: jest.fn()
}));
jest.mock('../../../lib/utils/dataplane-pipeline-warning', () => ({
  logDataplanePipelineWarning: jest.fn()
}));
jest.mock('../../../lib/utils/configuration-env-resolver', () => ({
  buildResolvedEnvMapForIntegration: jest.fn().mockResolvedValue({ envMap: {}, secrets: {} }),
  resolveConfigurationValues: jest.fn()
}));

const fsSync = require('fs');
const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { getEnvironmentApplication } = require('../../../lib/api/environments.api');
const { publishDatasourceViaPipeline } = require('../../../lib/api/pipeline.api');
const { formatApiError } = require('../../../lib/utils/api-error-handler');
const logger = require('../../../lib/utils/logger');
const { validateDatasourceFile } = require('../../../lib/datasource/validate');
const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
const { logDataplanePipelineWarning } = require('../../../lib/utils/dataplane-pipeline-warning');
const {
  buildResolvedEnvMapForIntegration,
  resolveConfigurationValues
} = require('../../../lib/utils/configuration-env-resolver');

describe('Datasource Deploy Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset resolveDataplaneUrl to default mock value
    resolveDataplaneUrl.mockResolvedValue('http://dataplane:8080');
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

      const { getDataplaneUrl } = require('../../../lib/datasource/deploy');
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

      const { getDataplaneUrl } = require('../../../lib/datasource/deploy');
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

      const { getDataplaneUrl } = require('../../../lib/datasource/deploy');
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

      const { getDataplaneUrl } = require('../../../lib/datasource/deploy');
      await expect(getDataplaneUrl('http://localhost:3010', 'myapp', 'dev', authConfig))
        .rejects.toThrow('Dataplane URL not found in application configuration');
    });

    it('should throw clear error when dataplane URL not found for external systems', async() => {
      const authConfig = {
        type: 'bearer',
        token: 'test-token'
      };

      const mockResponse = {
        success: true,
        data: {
          configuration: {
            type: 'external'
          }
        }
      };

      getEnvironmentApplication.mockResolvedValue(mockResponse);

      const { getDataplaneUrl } = require('../../../lib/datasource/deploy');
      await expect(getDataplaneUrl('http://localhost:3010', 'myapp', 'dev', authConfig))
        .rejects.toThrow('Dataplane URL not found for external system');
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

      const { getDataplaneUrl } = require('../../../lib/datasource/deploy');
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

      const { getDataplaneUrl } = require('../../../lib/datasource/deploy');
      await expect(getDataplaneUrl('http://localhost:3010', 'myapp', 'dev', authConfig))
        .rejects.toThrow('Bearer token authentication required');
    });
  });

  describe('deployDatasource', () => {
    it('should deploy datasource successfully', async() => {
      const filePath = '/path/to/datasource.json';
      const options = {};

      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot',
        displayName: 'Test Datasource'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: filePath
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'http://localhost:3010'
      });

      resolveDataplaneUrl.mockResolvedValue('http://dataplane:8080');
      publishDatasourceViaPipeline.mockResolvedValueOnce({
        success: true,
        data: { success: true }
      });

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      const result = await deployDatasource(filePath, options);

      expect(result.success).toBe(true);
      expect(result.datasourceKey).toBe('test-datasource');
      expect(result.systemKey).toBe('hubspot');
      expect(result.environment).toBe('dev');
      expect(validateDatasourceFile).toHaveBeenCalledWith(filePath);
      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'http://localhost:3010',
        'dev',
        expect.objectContaining({
          type: 'bearer',
          token: 'test-token'
        })
      );
      expect(publishDatasourceViaPipeline).toHaveBeenCalledTimes(1);
      expect(logDataplanePipelineWarning).toHaveBeenCalledTimes(1);
    });

    it('should throw error if file or key is missing', async() => {
      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource(null, { controller: 'http://localhost:3010', environment: 'dev' }))
        .rejects.toThrow('File path or datasource key is required');
    });

    it('should throw error if file or key is blank', async() => {
      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('   ', { controller: 'http://localhost:3010', environment: 'dev' }))
        .rejects.toThrow('File path or datasource key is required');
    });

    it('should use controller and environment from config', async() => {
      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('http://localhost:3010');
      resolveEnvironment.mockResolvedValueOnce('dev');

      const filePath = '/path/to/datasource.json';
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot',
        displayName: 'Test Datasource'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: filePath
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'http://localhost:3010'
      });

      resolveDataplaneUrl.mockResolvedValue('http://dataplane:8080');
      publishDatasourceViaPipeline.mockResolvedValueOnce({
        success: true,
        data: { success: true }
      });

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      const result = await deployDatasource(filePath, {});

      expect(resolveControllerUrl).toHaveBeenCalledWith();
      expect(resolveEnvironment).toHaveBeenCalledWith();
      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'http://localhost:3010',
        'dev',
        expect.objectContaining({
          type: 'bearer',
          token: 'test-token'
        })
      );
      expect(result.success).toBe(true);
      expect(logDataplanePipelineWarning).toHaveBeenCalledTimes(1);
    });

    it('should throw error if validation fails', async() => {
      validateDatasourceFile.mockResolvedValue({
        valid: false,
        errors: ['Validation error'],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('Datasource file validation failed');
    });

    it('should throw error if systemKey is missing', async() => {
      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify({
        key: 'test-datasource'
        // Missing systemKey
      }));

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('systemKey is required');
    });

    it('should throw when configuration resolution fails (missing env var)', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot',
        configuration: [{ name: 'API_KEY', value: '{{API_KEY}}', location: 'variable' }]
      };
      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/datasource.json'
      });
      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));
      getDeploymentAuth.mockResolvedValue({ type: 'bearer', token: 'test-token' });
      resolveDataplaneUrl.mockResolvedValue('http://dataplane:8080');
      buildResolvedEnvMapForIntegration.mockResolvedValue({ envMap: {}, secrets: {} });
      resolveConfigurationValues.mockImplementation(() => {
        throw new Error('Missing configuration env var: API_KEY.');
      });

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/datasource.json', {})).rejects.toThrow('Missing configuration env var');
      expect(publishDatasourceViaPipeline).not.toHaveBeenCalled();
    });

    it('should throw when buildResolvedEnvMapForIntegration rejects for datasource with configuration', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot',
        configuration: [{ name: 'X', value: '{{X}}', location: 'variable' }]
      };
      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/datasource.json'
      });
      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));
      getDeploymentAuth.mockResolvedValue({ type: 'bearer', token: 'test-token' });
      buildResolvedEnvMapForIntegration.mockRejectedValue(new Error('Secrets file not found'));

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/datasource.json', {})).rejects.toThrow('Secrets file not found');
      expect(publishDatasourceViaPipeline).not.toHaveBeenCalled();
    });

    it('should throw error if datasource file is invalid JSON', async() => {
      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      fsSync.readFileSync.mockReturnValue('invalid json {');

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('Failed to parse datasource file');
    });

    it('should throw error if dataplane deployment fails', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'http://localhost:3010'
      });

      resolveDataplaneUrl.mockResolvedValue('http://dataplane:8080');
      publishDatasourceViaPipeline.mockResolvedValueOnce({
        success: false,
        formattedError: 'Deployment failed',
        errorData: {
          endpointUrl: 'http://dataplane:8080/api/v1/external/hubspot/datasources'
        }
      });

      formatApiError.mockReturnValue('Deployment failed');

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('Dataplane publish failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Endpoint URL:'));
    });

    it('should throw error for non-bearer authentication in deployment', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'client-credentials',
        username: 'user',
        password: 'pass',
        controller: 'http://localhost:3010'
      });

      resolveDataplaneUrl.mockRejectedValueOnce(new Error('Bearer token authentication required'));

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('Bearer token authentication required');
      // logger.error is called when dataplane URL resolution fails (single formatted line)
      expect(logger.error).toHaveBeenCalled();
    });

    it('should throw error if dataplane URL resolution fails', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'http://localhost:3010'
      });

      resolveDataplaneUrl.mockRejectedValueOnce(new Error('Dataplane URL not found'));

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('Dataplane URL not found');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should throw error if dataplane URL is empty', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'http://localhost:3010'
      });

      resolveDataplaneUrl.mockResolvedValue('');

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('Dataplane URL is empty');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Dataplane URL is empty'));
    });

    it('should display endpoint URL in error when publish fails', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'http://localhost:3010'
      });

      resolveDataplaneUrl.mockResolvedValue('http://dataplane:8080');
      publishDatasourceViaPipeline.mockResolvedValueOnce({
        success: false,
        formattedError: 'Network timeout',
        errorData: {
          endpointUrl: 'http://dataplane:8080/api/v1/external/hubspot/datasources'
        }
      });

      formatApiError.mockReturnValue('Network timeout');

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('Dataplane publish failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Endpoint URL:'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('http://dataplane:8080/api/v1/external/hubspot/datasources'));
    });

    it('should display dataplane URL and system key when endpoint URL not available', async() => {
      const datasourceConfig = {
        key: 'test-datasource',
        systemKey: 'hubspot'
      };

      validateDatasourceFile.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        resolvedPath: '/path/to/file.json'
      });

      fsSync.readFileSync.mockReturnValue(JSON.stringify(datasourceConfig));

      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token',
        controller: 'http://localhost:3010'
      });

      resolveDataplaneUrl.mockResolvedValue('http://dataplane:8080');
      publishDatasourceViaPipeline.mockResolvedValueOnce({
        success: false,
        formattedError: 'Network timeout',
        errorData: {}
      });

      formatApiError.mockReturnValue('Network timeout');

      const { deployDatasource } = require('../../../lib/datasource/deploy');
      await expect(deployDatasource('/path/to/file.json', {})).rejects.toThrow('Dataplane publish failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Dataplane URL:'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('System Key:'));
    });
  });
});

