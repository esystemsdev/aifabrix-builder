/**
 * Tests for App Register Config Module
 *
 * @fileoverview Unit tests for lib/utils/app-register-config.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock paths
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn()
}));

// Mock app module
jest.mock('../../../lib/app', () => ({
  createApp: jest.fn()
}));

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../../lib/utils/logger');
const { detectAppType } = require('../../../lib/utils/paths');
const { createApp } = require('../../../lib/app');
const {
  loadVariablesYaml,
  createMinimalAppIfNeeded,
  buildImageReference,
  extractAppConfiguration,
  extractExternalIntegrationUrl
} = require('../../../lib/utils/app-register-config');

describe('App Register Config Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadVariablesYaml', () => {
    it('should load variables.yaml successfully', async() => {
      const appKey = 'test-app';
      const appPath = '/builder/test-app';
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesContent = 'app:\n  key: test-app\n  displayName: Test App';
      const expectedVariables = yaml.load(variablesContent);

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockResolvedValue(variablesContent);

      const result = await loadVariablesYaml(appKey);

      expect(detectAppType).toHaveBeenCalledWith(appKey);
      expect(fs.readFile).toHaveBeenCalledWith(variablesPath, 'utf-8');
      expect(result).toEqual({ variables: expectedVariables, created: false });
    });

    it('should return created flag when variables.yaml not found', async() => {
      const appKey = 'test-app';
      const appPath = '/builder/test-app';
      const variablesPath = path.join(appPath, 'variables.yaml');
      const error = new Error('File not found');
      error.code = 'ENOENT';

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockRejectedValue(error);

      const result = await loadVariablesYaml(appKey);

      expect(result).toEqual({ variables: null, created: true });
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('variables.yaml not found'));
    });

    it('should throw error for other file read errors', async() => {
      const appKey = 'test-app';
      const appPath = '/builder/test-app';
      const variablesPath = path.join(appPath, 'variables.yaml');
      const error = new Error('Permission denied');
      error.code = 'EACCES';

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockRejectedValue(error);

      await expect(loadVariablesYaml(appKey)).rejects.toThrow('Failed to read variables.yaml: Permission denied');
    });
  });

  describe('createMinimalAppIfNeeded', () => {
    it('should create minimal app and return variables', async() => {
      const appKey = 'test-app';
      const options = { port: 3000 };
      const appPath = '/builder/test-app';
      const variablesPath = path.join(appPath, 'variables.yaml');
      const variablesContent = 'app:\n  key: test-app\nport: 3000';
      const expectedVariables = yaml.load(variablesContent);

      detectAppType.mockResolvedValue({ appPath });
      createApp.mockResolvedValue();
      fs.readFile = jest.fn().mockResolvedValue(variablesContent);

      const result = await createMinimalAppIfNeeded(appKey, options);

      expect(createApp).toHaveBeenCalledWith(appKey, {
        port: 3000,
        language: 'typescript',
        database: false,
        redis: false,
        storage: false,
        authentication: false
      });
      expect(result).toEqual(expectedVariables);
    });

    it('should throw error if createApp is not available', async() => {
      // Temporarily mock createApp as null
      jest.resetModules();
      const configModule = require('../../../lib/utils/app-register-config');
      // This test would require re-importing the module, which is complex
      // For now, we'll test the error path through the actual module
      const originalCreateApp = require('../../../lib/app').createApp;
      require('../../../lib/app').createApp = null;

      try {
        await expect(configModule.createMinimalAppIfNeeded('test-app', {}))
          .rejects.toThrow('Cannot auto-create application: createApp function not available');
      } finally {
        require('../../../lib/app').createApp = originalCreateApp;
      }
    });
  });

  describe('buildImageReference', () => {
    it('should build image reference with registry', () => {
      const variables = {
        image: {
          name: 'test-image',
          registry: 'myregistry.azurecr.io',
          tag: 'v1.0.0'
        }
      };
      const appKey = 'test-app';

      const result = buildImageReference(variables, appKey);

      expect(result).toBe('myregistry.azurecr.io/test-image:v1.0.0');
    });

    it('should build image reference without registry', () => {
      const variables = {
        image: {
          name: 'test-image',
          tag: 'latest'
        }
      };
      const appKey = 'test-app';

      const result = buildImageReference(variables, appKey);

      expect(result).toBe('test-image:latest');
    });

    it('should use default tag when not provided', () => {
      const variables = {
        image: {
          name: 'test-image'
        }
      };
      const appKey = 'test-app';

      const result = buildImageReference(variables, appKey);

      expect(result).toBe('test-image:latest');
    });

    it('should use app.key as image name fallback', () => {
      const variables = {
        app: {
          key: 'my-app'
        }
      };
      const appKey = 'test-app';

      const result = buildImageReference(variables, appKey);

      expect(result).toBe('my-app:latest');
    });

    it('should use appKey as final fallback', () => {
      const variables = {};
      const appKey = 'test-app';

      const result = buildImageReference(variables, appKey);

      expect(result).toBe('test-app:latest');
    });
  });

  describe('extractExternalIntegrationUrl', () => {
    it('should extract URL from external system file', async() => {
      const appKey = 'test-app';
      const appPath = '/builder/test-app';
      const externalIntegration = {
        schemaBasePath: './',
        systems: ['test-system-deploy.json']
      };
      const systemFilePath = path.join(appPath, './', 'test-system-deploy.json');
      const systemContent = JSON.stringify({
        environment: {
          baseUrl: 'https://api.example.com'
        }
      });

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockResolvedValue(systemContent);

      const result = await extractExternalIntegrationUrl(appKey, externalIntegration);

      expect(result).toEqual({ url: 'https://api.example.com', apiKey: undefined });
    });

    it('should extract URL and API key from external system file', async() => {
      const appKey = 'test-app';
      const appPath = '/builder/test-app';
      const externalIntegration = {
        schemaBasePath: './',
        systems: ['test-system-deploy.json']
      };
      const systemFilePath = path.join(appPath, './', 'test-system-deploy.json');
      const systemContent = JSON.stringify({
        environment: {
          baseUrl: 'https://api.example.com'
        },
        authentication: {
          apikey: {
            key: 'api-key-123'
          }
        }
      });

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockResolvedValue(systemContent);

      const result = await extractExternalIntegrationUrl(appKey, externalIntegration);

      expect(result).toEqual({ url: 'https://api.example.com', apiKey: 'api-key-123' });
    });

    it('should not extract API key if it is a kv:// reference', async() => {
      const appKey = 'test-app';
      const appPath = '/builder/test-app';
      const externalIntegration = {
        schemaBasePath: './',
        systems: ['test-system-deploy.json']
      };
      const systemContent = JSON.stringify({
        environment: {
          baseUrl: 'https://api.example.com'
        },
        authentication: {
          apikey: {
            key: 'kv://secrets/api-key'
          }
        }
      });

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockResolvedValue(systemContent);

      const result = await extractExternalIntegrationUrl(appKey, externalIntegration);

      expect(result).toEqual({ url: 'https://api.example.com', apiKey: undefined });
    });

    it('should throw error if externalIntegration.systems is missing', async() => {
      const appKey = 'test-app';
      const externalIntegration = {};

      await expect(extractExternalIntegrationUrl(appKey, externalIntegration))
        .rejects.toThrow('externalIntegration.systems is required');
    });

    it('should throw error if system file not found', async() => {
      const appKey = 'test-app';
      const appPath = '/builder/test-app';
      const externalIntegration = {
        schemaBasePath: './',
        systems: ['missing-file.json']
      };
      const error = new Error('File not found');
      error.code = 'ENOENT';

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockRejectedValue(error);

      await expect(extractExternalIntegrationUrl(appKey, externalIntegration))
        .rejects.toThrow('External system file not found:');
    });

    it('should throw error if baseUrl is missing', async() => {
      const appKey = 'test-app';
      const appPath = '/builder/test-app';
      const externalIntegration = {
        schemaBasePath: './',
        systems: ['test-system-deploy.json']
      };
      const systemContent = JSON.stringify({
        // Missing environment.baseUrl
        authentication: {}
      });

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockResolvedValue(systemContent);

      await expect(extractExternalIntegrationUrl(appKey, externalIntegration))
        .rejects.toThrow('Missing environment.baseUrl');
    });
  });

  describe('extractAppConfiguration', () => {
    it('should extract external app configuration', async() => {
      const variables = {
        app: {
          key: 'test-app',
          type: 'external',
          name: 'Test App',
          description: 'Test description'
        },
        externalIntegration: {
          schemaBasePath: './',
          systems: ['test-system-deploy.json']
        }
      };
      const appKey = 'test-app';
      const options = {};
      const appPath = '/builder/test-app';
      const systemContent = JSON.stringify({
        environment: {
          baseUrl: 'https://api.example.com'
        }
      });

      detectAppType.mockResolvedValue({ appPath });
      fs.readFile = jest.fn().mockResolvedValue(systemContent);

      const result = await extractAppConfiguration(variables, appKey, options);

      expect(result).toEqual({
        appKey: 'test-app',
        displayName: 'Test App',
        description: 'Test description',
        appType: 'external',
        externalIntegration: {
          url: 'https://api.example.com'
        },
        port: null,
        image: null,
        language: null
      });
    });

    it('should extract webapp configuration', async() => {
      const variables = {
        app: {
          key: 'test-app',
          name: 'Test App',
          description: 'Test description'
        },
        build: {
          language: 'typescript',
          port: 3000
        },
        image: {
          name: 'test-image',
          registryMode: 'external',
          tag: 'latest'
        }
      };
      const appKey = 'test-app';
      const options = {};

      const result = await extractAppConfiguration(variables, appKey, options);

      expect(result).toEqual({
        appKey: 'test-app',
        displayName: 'Test App',
        description: 'Test description',
        appType: 'webapp',
        registryMode: 'external',
        port: 3000,
        localPort: 3000,
        image: 'test-image:latest',
        language: 'typescript',
        url: null
      });
    });

    it('should extract service configuration for Python', async() => {
      const variables = {
        app: {
          key: 'test-app'
        },
        build: {
          language: 'python',
          port: 8000
        },
        image: {
          name: 'test-image'
        }
      };
      const appKey = 'test-app';
      const options = {};

      const result = await extractAppConfiguration(variables, appKey, options);

      expect(result.appType).toBe('service');
      expect(result.language).toBe('python');
    });

    it('should use options.name as displayName fallback', async() => {
      const variables = {
        app: {
          key: 'test-app'
        }
      };
      const appKey = 'test-app';
      const options = { name: 'Custom Name' };

      const result = await extractAppConfiguration(variables, appKey, options);

      expect(result.displayName).toBe('Custom Name');
    });

    it('should use appKey as displayName final fallback', async() => {
      const variables = {
        app: {
          key: 'test-app'
        }
      };
      const appKey = 'test-app';
      const options = {};

      const result = await extractAppConfiguration(variables, appKey, options);

      expect(result.displayName).toBe('test-app');
    });
  });
});

