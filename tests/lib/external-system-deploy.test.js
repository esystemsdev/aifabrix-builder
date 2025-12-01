/**
 * Tests for AI Fabrix Builder External System Deploy Module
 *
 * @fileoverview Unit tests for external-system-deploy.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

// Mock dependencies
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn()
    }
  };
});
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
jest.mock('../../lib/utils/api', () => ({
  authenticatedApiCall: jest.fn()
}));
jest.mock('../../lib/config', () => ({
  getConfig: jest.fn()
}));
jest.mock('../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../lib/datasource-deploy', () => ({
  getDataplaneUrl: jest.fn()
}));

const { getDeploymentAuth } = require('../../lib/utils/token-manager');
const { authenticatedApiCall } = require('../../lib/utils/api');
const { getConfig } = require('../../lib/config');
const logger = require('../../lib/utils/logger');
const { getDataplaneUrl } = require('../../lib/datasource-deploy');

describe('External System Deploy Module', () => {
  const appName = 'test-external-app';
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const schemasPath = path.join(builderPath, 'schemas');
  const systemFile = path.join(schemasPath, 'test-system.json');
  const datasourceFile1 = path.join(schemasPath, 'test-system-entity1.json');
  const datasourceFile2 = path.join(schemasPath, 'test-system-entity2.json');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset getDataplaneUrl mock to default value
    getDataplaneUrl.mockResolvedValue('http://dataplane:8080');
  });

  describe('validateExternalSystemFiles', () => {
    it('should validate external system files successfully', async() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['test-system.json'],
          dataSources: ['test-system-entity1.json', 'test-system-entity2.json']
        }
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(yaml.dump(mockVariables));
      fsPromises.access = jest.fn().mockResolvedValue(undefined);

      const { validateExternalSystemFiles } = require('../../lib/external-system-deploy');
      const result = await validateExternalSystemFiles(appName);

      expect(result.systemFiles).toHaveLength(1);
      expect(result.systemFiles[0]).toBe(systemFile);
      expect(result.datasourceFiles).toHaveLength(2);
      expect(result.systemKey).toBe('test-system');
      expect(fsPromises.access).toHaveBeenCalledTimes(3);
    });

    it('should validate with custom schemaBasePath', async() => {
      const customSchemasPath = path.join(builderPath, 'custom-schemas');
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './custom-schemas',
          systems: ['test-system.json'],
          dataSources: []
        }
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(yaml.dump(mockVariables));
      fsPromises.access = jest.fn().mockResolvedValue(undefined);

      const { validateExternalSystemFiles } = require('../../lib/external-system-deploy');
      const result = await validateExternalSystemFiles(appName);

      expect(result.systemFiles[0]).toBe(path.join(customSchemasPath, 'test-system.json'));
    });

    it('should throw error if externalIntegration block is missing', async() => {
      const mockVariables = {
        app: { key: appName }
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(yaml.dump(mockVariables));

      const { validateExternalSystemFiles } = require('../../lib/external-system-deploy');
      await expect(validateExternalSystemFiles(appName))
        .rejects.toThrow('externalIntegration block not found in variables.yaml');
    });

    it('should throw error if systems array is missing', async() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas'
        }
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(yaml.dump(mockVariables));

      const { validateExternalSystemFiles } = require('../../lib/external-system-deploy');
      await expect(validateExternalSystemFiles(appName))
        .rejects.toThrow('No external system files specified in externalIntegration.systems');
    });

    it('should throw error if systems array is empty', async() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: []
        }
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(yaml.dump(mockVariables));

      const { validateExternalSystemFiles } = require('../../lib/external-system-deploy');
      await expect(validateExternalSystemFiles(appName))
        .rejects.toThrow('No external system files specified in externalIntegration.systems');
    });

    it('should throw error if system file does not exist', async() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['nonexistent.json']
        }
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(yaml.dump(mockVariables));
      fsPromises.access = jest.fn().mockRejectedValue(new Error('ENOENT'));

      const { validateExternalSystemFiles } = require('../../lib/external-system-deploy');
      await expect(validateExternalSystemFiles(appName))
        .rejects.toThrow('External system file not found');
    });

    it('should throw error if datasource file does not exist', async() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['test-system.json'],
          dataSources: ['nonexistent.json']
        }
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(yaml.dump(mockVariables));
      fsPromises.access = jest.fn()
        .mockResolvedValueOnce(undefined) // system file exists
        .mockRejectedValueOnce(new Error('ENOENT')); // datasource file missing

      const { validateExternalSystemFiles } = require('../../lib/external-system-deploy');
      await expect(validateExternalSystemFiles(appName))
        .rejects.toThrow('External datasource file not found');
    });

    it('should handle empty datasources array', async() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['test-system.json'],
          dataSources: []
        }
      };

      fsPromises.readFile = jest.fn().mockResolvedValue(yaml.dump(mockVariables));
      fsPromises.access = jest.fn().mockResolvedValue(undefined);

      const { validateExternalSystemFiles } = require('../../lib/external-system-deploy');
      const result = await validateExternalSystemFiles(appName);

      expect(result.datasourceFiles).toHaveLength(0);
    });
  });

  describe('buildExternalSystem', () => {
    const mockSystemJson = {
      key: 'test-system',
      displayName: 'Test System',
      type: 'openapi'
    };

    const mockDatasourceJson = {
      key: 'test-system-entity1',
      systemKey: 'test-system',
      entityKey: 'entity1'
    };

    beforeEach(() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['test-system.json'],
          dataSources: ['test-system-entity1.json']
        }
      };

      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        if (filePath === systemFile) {
          return Promise.resolve(JSON.stringify(mockSystemJson));
        }
        if (filePath === datasourceFile1) {
          return Promise.resolve(JSON.stringify(mockDatasourceJson));
        }
        return Promise.reject(new Error('File not found'));
      });

      fsPromises.access = jest.fn().mockResolvedValue(undefined);
      getConfig.mockResolvedValue({
        deployment: {
          controllerUrl: 'http://localhost:3000'
        }
      });
      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token'
      });
    });

    it('should build external system successfully', async() => {
      authenticatedApiCall
        .mockResolvedValueOnce({
          success: true,
          data: { key: 'test-system' }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { key: 'test-system-entity1' }
        });

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await buildExternalSystem(appName);

      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'http://localhost:3000',
        appName,
        'dev',
        { type: 'bearer', token: 'test-token' }
      );
      expect(authenticatedApiCall).toHaveBeenCalledTimes(2);
      expect(authenticatedApiCall).toHaveBeenNthCalledWith(
        1,
        'http://dataplane:8080/api/v1/pipeline/deploy',
        {
          method: 'POST',
          body: JSON.stringify(mockSystemJson)
        },
        'test-token'
      );
      expect(authenticatedApiCall).toHaveBeenNthCalledWith(
        2,
        'http://dataplane:8080/api/v1/pipeline/test-system/deploy',
        {
          method: 'POST',
          body: JSON.stringify(mockDatasourceJson)
        },
        'test-token'
      );
      expect(logger.log).toHaveBeenCalled();
    });

    it('should build external system with multiple datasources', async() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['test-system.json'],
          dataSources: ['test-system-entity1.json', 'test-system-entity2.json']
        }
      };

      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        if (filePath === systemFile) {
          return Promise.resolve(JSON.stringify(mockSystemJson));
        }
        if (filePath === datasourceFile1 || filePath === datasourceFile2) {
          return Promise.resolve(JSON.stringify(mockDatasourceJson));
        }
        return Promise.reject(new Error('File not found'));
      });

      authenticatedApiCall
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({ success: true, data: {} });

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await buildExternalSystem(appName);

      expect(authenticatedApiCall).toHaveBeenCalledTimes(3);
    });

    it('should use custom controller URL from options', async() => {
      authenticatedApiCall.mockResolvedValue({ success: true, data: {} });
      getDataplaneUrl.mockResolvedValue('http://custom-dataplane:8080');

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await buildExternalSystem(appName, { controller: 'http://custom-controller:3000' });

      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'http://custom-controller:3000',
        appName,
        'dev',
        expect.any(Object)
      );
      expect(authenticatedApiCall).toHaveBeenCalledWith(
        expect.stringContaining('http://custom-dataplane:8080'),
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should use custom environment from options', async() => {
      authenticatedApiCall.mockResolvedValue({ success: true, data: {} });

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await buildExternalSystem(appName, { environment: 'prod' });

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        expect.any(String),
        'prod',
        appName
      );
      expect(getDataplaneUrl).toHaveBeenCalledWith(
        expect.any(String),
        appName,
        'prod',
        expect.any(Object)
      );
    });

    it('should throw error if authentication is missing', async() => {
      getDeploymentAuth.mockResolvedValue({});

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await expect(buildExternalSystem(appName))
        .rejects.toThrow('Authentication required');
      expect(getDataplaneUrl).not.toHaveBeenCalled();
    });

    it('should throw error if system deployment fails', async() => {
      authenticatedApiCall.mockResolvedValueOnce({
        success: false,
        error: 'Deployment failed',
        formattedError: 'Formatted: Deployment failed'
      });

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await expect(buildExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system');
      expect(getDataplaneUrl).toHaveBeenCalled();
    });

    it('should throw error if datasource deployment fails', async() => {
      authenticatedApiCall
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({
          success: false,
          error: 'Datasource deployment failed'
        });

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await expect(buildExternalSystem(appName))
        .rejects.toThrow('Failed to deploy datasource');
      expect(getDataplaneUrl).toHaveBeenCalled();
    });

    it('should throw error if system file is invalid JSON', async() => {
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump({
            externalIntegration: {
              schemaBasePath: './schemas',
              systems: ['test-system.json'],
              dataSources: []
            }
          }));
        }
        if (filePath === systemFile) {
          return Promise.resolve('invalid json {');
        }
        return Promise.reject(new Error('File not found'));
      });

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await expect(buildExternalSystem(appName))
        .rejects.toThrow('Failed to build external system');
    });

    it('should use default controller URL from config', async() => {
      getConfig.mockResolvedValue({
        deployment: {
          controllerUrl: 'http://config-controller:3000'
        }
      });
      getDataplaneUrl.mockResolvedValue('http://config-dataplane:8080');
      authenticatedApiCall.mockResolvedValue({ success: true, data: {} });

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await buildExternalSystem(appName);

      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'http://config-controller:3000',
        appName,
        'dev',
        expect.any(Object)
      );
      expect(authenticatedApiCall).toHaveBeenCalledWith(
        expect.stringContaining('http://config-dataplane:8080'),
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should use default controller URL if config is missing', async() => {
      getConfig.mockResolvedValue({});
      getDataplaneUrl.mockResolvedValue('http://default-dataplane:8080');
      authenticatedApiCall.mockResolvedValue({ success: true, data: {} });

      const { buildExternalSystem } = require('../../lib/external-system-deploy');
      await buildExternalSystem(appName);

      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'http://localhost:3000',
        appName,
        'dev',
        expect.any(Object)
      );
      expect(authenticatedApiCall).toHaveBeenCalledWith(
        expect.stringContaining('http://default-dataplane:8080'),
        expect.any(Object),
        expect.any(String)
      );
    });
  });

  describe('deployExternalSystem', () => {
    const mockSystemJson = {
      key: 'test-system',
      displayName: 'Test System',
      type: 'openapi'
    };

    const mockDatasourceJson = {
      key: 'test-system-entity1',
      systemKey: 'test-system',
      entityKey: 'entity1'
    };

    beforeEach(() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['test-system.json'],
          dataSources: ['test-system-entity1.json']
        }
      };

      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        if (filePath === systemFile) {
          return Promise.resolve(JSON.stringify(mockSystemJson));
        }
        if (filePath === datasourceFile1) {
          return Promise.resolve(JSON.stringify(mockDatasourceJson));
        }
        return Promise.reject(new Error('File not found'));
      });

      fsPromises.access = jest.fn().mockResolvedValue(undefined);
      getConfig.mockResolvedValue({
        deployment: {
          controllerUrl: 'http://localhost:3000'
        }
      });
      getDeploymentAuth.mockResolvedValue({
        type: 'bearer',
        token: 'test-token'
      });
      getDataplaneUrl.mockResolvedValue('http://dataplane:8080');
    });

    it('should publish external system successfully', async() => {
      authenticatedApiCall
        .mockResolvedValueOnce({
          success: true,
          data: { key: 'test-system' }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { key: 'test-system-entity1' }
        });

      const { deployExternalSystem } = require('../../lib/external-system-deploy');
      await deployExternalSystem(appName);

      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'http://localhost:3000',
        appName,
        'dev',
        { type: 'bearer', token: 'test-token' }
      );
      expect(authenticatedApiCall).toHaveBeenCalledTimes(2);
      expect(authenticatedApiCall).toHaveBeenNthCalledWith(
        1,
        'http://dataplane:8080/api/v1/pipeline/publish',
        {
          method: 'POST',
          body: JSON.stringify(mockSystemJson)
        },
        'test-token'
      );
      expect(authenticatedApiCall).toHaveBeenNthCalledWith(
        2,
        'http://dataplane:8080/api/v1/pipeline/test-system/publish',
        {
          method: 'POST',
          body: JSON.stringify(mockDatasourceJson)
        },
        'test-token'
      );
      expect(logger.log).toHaveBeenCalled();
    });

    it('should publish external system with multiple datasources', async() => {
      const mockVariables = {
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['test-system.json'],
          dataSources: ['test-system-entity1.json', 'test-system-entity2.json']
        }
      };

      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump(mockVariables));
        }
        if (filePath === systemFile) {
          return Promise.resolve(JSON.stringify(mockSystemJson));
        }
        if (filePath === datasourceFile1 || filePath === datasourceFile2) {
          return Promise.resolve(JSON.stringify(mockDatasourceJson));
        }
        return Promise.reject(new Error('File not found'));
      });

      authenticatedApiCall
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({ success: true, data: {} });

      const { deployExternalSystem } = require('../../lib/external-system-deploy');
      await deployExternalSystem(appName);

      expect(authenticatedApiCall).toHaveBeenCalledTimes(3);
    });

    it('should use custom controller URL from options', async() => {
      authenticatedApiCall.mockResolvedValue({ success: true, data: {} });
      getDataplaneUrl.mockResolvedValue('http://custom-dataplane:8080');

      const { deployExternalSystem } = require('../../lib/external-system-deploy');
      await deployExternalSystem(appName, { controller: 'http://custom-controller:3000' });

      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'http://custom-controller:3000',
        appName,
        'dev',
        expect.any(Object)
      );
      expect(authenticatedApiCall).toHaveBeenCalledWith(
        expect.stringContaining('http://custom-dataplane:8080'),
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should use custom environment from options', async() => {
      authenticatedApiCall.mockResolvedValue({ success: true, data: {} });

      const { deployExternalSystem } = require('../../lib/external-system-deploy');
      await deployExternalSystem(appName, { environment: 'prod' });

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        expect.any(String),
        'prod',
        appName
      );
      expect(getDataplaneUrl).toHaveBeenCalledWith(
        expect.any(String),
        appName,
        'prod',
        expect.any(Object)
      );
    });

    it('should throw error if authentication is missing', async() => {
      getDeploymentAuth.mockResolvedValue({});

      const { deployExternalSystem } = require('../../lib/external-system-deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Authentication required');
      expect(getDataplaneUrl).not.toHaveBeenCalled();
    });

    it('should throw error if system publish fails', async() => {
      authenticatedApiCall.mockResolvedValueOnce({
        success: false,
        error: 'Publish failed',
        formattedError: 'Formatted: Publish failed'
      });

      const { deployExternalSystem } = require('../../lib/external-system-deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to publish external system');
      expect(getDataplaneUrl).toHaveBeenCalled();
    });

    it('should throw error if datasource publish fails', async() => {
      authenticatedApiCall
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({
          success: false,
          error: 'Datasource publish failed'
        });

      const { deployExternalSystem } = require('../../lib/external-system-deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to publish datasource');
      expect(getDataplaneUrl).toHaveBeenCalled();
    });

    it('should throw error if system file is invalid JSON', async() => {
      fsPromises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return Promise.resolve(yaml.dump({
            externalIntegration: {
              schemaBasePath: './schemas',
              systems: ['test-system.json'],
              dataSources: []
            }
          }));
        }
        if (filePath === systemFile) {
          return Promise.resolve('invalid json {');
        }
        return Promise.reject(new Error('File not found'));
      });

      const { deployExternalSystem } = require('../../lib/external-system-deploy');
      await expect(deployExternalSystem(appName))
        .rejects.toThrow('Failed to deploy external system');
    });
  });
});

