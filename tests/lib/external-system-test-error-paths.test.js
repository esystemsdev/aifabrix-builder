/**
 * Tests for External System Test Error Paths
 *
 * @fileoverview Unit tests for external-system-test.js error handling paths
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    promises: {
      readFile: jest.fn()
    }
  };
});
jest.mock('../../lib/utils/logger');
jest.mock('../../lib/utils/external-system-validators');
jest.mock('../../lib/utils/paths');
jest.mock('../../lib/utils/token-manager');
jest.mock('../../lib/datasource-deploy');
jest.mock('../../lib/config');
jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow', 'gray'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

const fs = require('fs');
const fsp = require('fs').promises;
const externalSystemTest = require('../../lib/external-system-test');
const paths = require('../../lib/utils/paths');
const validators = require('../../lib/utils/external-system-validators');
const tokenManager = require('../../lib/utils/token-manager');
const datasourceDeploy = require('../../lib/datasource-deploy');
const config = require('../../lib/config');
const yaml = require('js-yaml');

describe('External System Test Error Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paths.detectAppType.mockResolvedValue({
      isExternal: true,
      appPath: 'builder/testapp',
      appType: 'external',
      baseDir: 'builder'
    });
    config.getConfig.mockResolvedValue({
      deployment: { controllerUrl: 'https://controller.example.com' }
    });
    tokenManager.getDeploymentAuth.mockResolvedValue({
      token: 'test-token',
      clientId: 'test-client-id'
    });
    datasourceDeploy.getDataplaneUrl.mockResolvedValue('https://dataplane.example.com');
  });

  describe('testExternalSystem - file loading errors', () => {
    it('should throw error when variables.yaml not found', async() => {
      const appName = 'testapp';
      fs.existsSync.mockReturnValue(false);

      await expect(
        externalSystemTest.testExternalSystem(appName)
      ).rejects.toThrow('variables.yaml not found');
    });

    it('should throw error when variables.yaml has invalid YAML', async() => {
      const appName = 'testapp';
      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockResolvedValue('invalid: yaml: [');

      await expect(
        externalSystemTest.testExternalSystem(appName)
      ).rejects.toThrow('Invalid YAML syntax');
    });

    it('should throw error when externalIntegration block is missing', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({ name: 'test' });
      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockResolvedValue(variablesContent);

      await expect(
        externalSystemTest.testExternalSystem(appName)
      ).rejects.toThrow('externalIntegration block not found');
    });

    it('should throw error when system file not found', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          schemaBasePath: './'
        }
      });
      fs.existsSync.mockImplementation((path) => {
        return path.includes('variables.yaml');
      });
      fsp.readFile.mockResolvedValue(variablesContent);

      await expect(
        externalSystemTest.testExternalSystem(appName)
      ).rejects.toThrow('System file not found');
    });

    it('should throw error when system file contains invalid JSON', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          schemaBasePath: './'
        }
      });
      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockImplementation((path) => {
        if (path.includes('variables.yaml')) {
          return Promise.resolve(variablesContent);
        }
        return Promise.resolve('invalid json');
      });

      await expect(
        externalSystemTest.testExternalSystem(appName)
      ).rejects.toThrow('Invalid JSON syntax');
    });

    it('should throw error when datasource file contains invalid JSON', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          dataSources: ['datasource.json'],
          schemaBasePath: './'
        }
      });
      const systemJson = { key: 'test-system' };
      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockImplementation((path) => {
        if (path.includes('variables.yaml')) {
          return Promise.resolve(variablesContent);
        }
        if (path.includes('system.json')) {
          return Promise.resolve(JSON.stringify(systemJson));
        }
        return Promise.resolve('invalid json');
      });

      await expect(
        externalSystemTest.testExternalSystem(appName)
      ).rejects.toThrow('Invalid JSON syntax');
    });
  });

  describe('testExternalSystem - validation errors', () => {
    it('should handle system validation failures', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          dataSources: ['datasource.json'],
          schemaBasePath: './'
        }
      });
      const systemJson = { key: 'test-system' };
      const datasourceJson = { key: 'test-datasource', systemKey: 'test-system' };

      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockImplementation((path) => {
        if (path.includes('variables.yaml')) {
          return Promise.resolve(variablesContent);
        }
        if (path.includes('datasource.json')) {
          return Promise.resolve(JSON.stringify(datasourceJson));
        }
        return Promise.resolve(JSON.stringify(systemJson));
      });

      validators.validateAgainstSchema.mockReturnValue({
        valid: false,
        errors: ['Validation error']
      });

      const result = await externalSystemTest.testExternalSystem(appName);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle datasource validation failures', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          dataSources: ['datasource.json'],
          schemaBasePath: './'
        }
      });
      const systemJson = { key: 'test-system' };
      const datasourceJson = {
        key: 'test-datasource',
        systemKey: 'test-system'
      };

      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockImplementation((path) => {
        if (path.includes('variables.yaml')) {
          return Promise.resolve(variablesContent);
        }
        if (path.includes('system.json')) {
          return Promise.resolve(JSON.stringify(systemJson));
        }
        return Promise.resolve(JSON.stringify(datasourceJson));
      });

      validators.validateAgainstSchema.mockReturnValueOnce({
        valid: true,
        errors: []
      }).mockReturnValueOnce({
        valid: false,
        errors: ['Datasource validation error']
      });

      const result = await externalSystemTest.testExternalSystem(appName);

      expect(result.valid).toBe(false);
      expect(result.datasourceResults[0].valid).toBe(false);
    });
  });

  describe('testExternalSystemIntegration - file loading errors', () => {
    it('should throw error when variables.yaml not found', async() => {
      const appName = 'testapp';
      fs.existsSync.mockReturnValue(false);

      await expect(
        externalSystemTest.testExternalSystemIntegration(appName)
      ).rejects.toThrow('variables.yaml not found');
    });

    it('should throw error when no system files found', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: [],
          schemaBasePath: './'
        }
      });
      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockResolvedValue(variablesContent);

      await expect(
        externalSystemTest.testExternalSystemIntegration(appName)
      ).rejects.toThrow('No system files found');
    });

    it('should throw error when no datasources found', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          dataSources: [],
          schemaBasePath: './'
        }
      });
      const systemJson = { key: 'test-system' };
      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockImplementation((path) => {
        if (path.includes('variables.yaml')) {
          return Promise.resolve(variablesContent);
        }
        return Promise.resolve(JSON.stringify(systemJson));
      });

      await expect(
        externalSystemTest.testExternalSystemIntegration(appName)
      ).rejects.toThrow('No datasources found to test');
    });
  });

  describe('testExternalSystemIntegration - authentication errors', () => {
    it('should throw error when authentication is missing', async() => {
      const appName = 'testapp';
      const variablesContent = yaml.dump({
        externalIntegration: {
          systems: ['system.json'],
          dataSources: ['datasource.json'],
          schemaBasePath: './'
        }
      });
      const systemJson = { key: 'test-system' };
      const datasourceJson = {
        key: 'test-datasource',
        systemKey: 'test-system'
      };

      fs.existsSync.mockReturnValue(true);
      fsp.readFile.mockImplementation((path) => {
        if (path.includes('variables.yaml')) {
          return Promise.resolve(variablesContent);
        }
        if (path.includes('system.json')) {
          return Promise.resolve(JSON.stringify(systemJson));
        }
        return Promise.resolve(JSON.stringify(datasourceJson));
      });

      tokenManager.getDeploymentAuth.mockResolvedValue({});

      await expect(
        externalSystemTest.testExternalSystemIntegration(appName)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('retryApiCall', () => {
    it('should retry on failure and eventually throw', async() => {
      const failingFn = jest.fn().mockRejectedValue(new Error('API error'));
      const retryFn = externalSystemTest.retryApiCall;

      await expect(
        retryFn(failingFn, 2, 10)
      ).rejects.toThrow('API error');

      expect(failingFn).toHaveBeenCalledTimes(3);
    });

    it('should succeed on retry', async() => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ success: true });
      const retryFn = externalSystemTest.retryApiCall;

      const result = await retryFn(fn, 2, 10);

      expect(result).toEqual({ success: true });
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

