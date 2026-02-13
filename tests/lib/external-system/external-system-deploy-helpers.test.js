/**
 * Tests for External System Deployment Helpers Module
 *
 * @fileoverview Unit tests for lib/external-system/deploy-helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Mock dependencies
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    promises: {
      readFile: jest.fn(),
      access: jest.fn()
    }
  };
});

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn(),
  getDeployJsonPath: jest.fn()
}));
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((appPath) => require('path').join(appPath, 'application.yaml'))
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn()
}));

const { detectAppType, getDeployJsonPath } = require('../../../lib/utils/paths');
const configFormat = require('../../../lib/utils/config-format');
const {
  loadVariablesYaml,
  validateSingleSystemFile,
  validateSystemFiles,
  validateSingleDatasourceFile,
  validateDatasourceFiles,
  extractSystemKey
} = require('../../../lib/external-system/deploy-helpers');

describe('External System Deployment Helpers Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadVariablesYaml', () => {
    beforeEach(() => {
      configFormat.loadConfigFile.mockReset();
    });

    it('should load and parse application config file', async() => {
      const appName = 'hubspot';
      const appPath = '/path/to/integration/hubspot';
      const mockVariables = {
        name: 'hubspot',
        externalIntegration: {
          schemaBasePath: './',
          systems: ['hubspot-deploy.json']
        }
      };

      detectAppType.mockResolvedValue({ appPath });
      configFormat.loadConfigFile.mockReturnValue(mockVariables);

      const result = await loadVariablesYaml(appName);

      expect(detectAppType).toHaveBeenCalledWith(appName);
      expect(configFormat.loadConfigFile).toHaveBeenCalledWith(path.join(appPath, 'application.yaml'));
      expect(result).toEqual(mockVariables);
    });

    it('should handle different app types', async() => {
      const appName = 'test-app';
      const appPath = '/path/to/builder/test-app';
      const mockVariables = { name: 'test-app' };

      detectAppType.mockResolvedValue({ appPath });
      configFormat.loadConfigFile.mockReturnValue(mockVariables);

      const result = await loadVariablesYaml(appName);

      expect(result).toEqual(mockVariables);
    });

    it('should throw error when file cannot be read', async() => {
      const appName = 'hubspot';
      const appPath = '/path/to/integration/hubspot';

      detectAppType.mockResolvedValue({ appPath });
      configFormat.loadConfigFile.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(loadVariablesYaml(appName)).rejects.toThrow('File not found');
    });

    it('should throw error when YAML is invalid', async() => {
      const appName = 'hubspot';
      const appPath = '/path/to/integration/hubspot';

      detectAppType.mockResolvedValue({ appPath });
      configFormat.loadConfigFile.mockImplementation(() => {
        throw new Error('Invalid YAML syntax');
      });

      await expect(loadVariablesYaml(appName)).rejects.toThrow();
    });
  });

  describe('validateSingleSystemFile', () => {
    it('should return new system path when it exists', async() => {
      const systemFile = 'hubspot-deploy.json';
      const appName = 'hubspot';
      const schemasPath = '/path/to/schemas';
      const newSystemPath = '/path/to/integration/hubspot/hubspot-deploy.json';

      getDeployJsonPath.mockReturnValue(newSystemPath);
      fsSync.existsSync.mockReturnValue(true);

      const result = await validateSingleSystemFile(systemFile, appName, schemasPath);

      expect(getDeployJsonPath).toHaveBeenCalledWith(appName, 'external', true);
      expect(fsSync.existsSync).toHaveBeenCalledWith(newSystemPath);
      expect(result).toBe(newSystemPath);
    });

    it('should fall back to specified path when new path does not exist', async() => {
      const systemFile = 'hubspot-deploy.json';
      const appName = 'hubspot';
      const schemasPath = '/path/to/schemas';
      const newSystemPath = '/path/to/integration/hubspot/hubspot-deploy.json';
      const fallbackPath = path.join(schemasPath, systemFile);

      getDeployJsonPath.mockReturnValue(newSystemPath);
      fsSync.existsSync.mockReturnValue(false);
      fs.access.mockResolvedValue(undefined);

      const result = await validateSingleSystemFile(systemFile, appName, schemasPath);

      expect(fsSync.existsSync).toHaveBeenCalledWith(newSystemPath);
      expect(fs.access).toHaveBeenCalledWith(fallbackPath);
      expect(result).toBe(fallbackPath);
    });

    it('should throw error when neither path exists', async() => {
      const systemFile = 'hubspot-deploy.json';
      const appName = 'hubspot';
      const schemasPath = '/path/to/schemas';
      const newSystemPath = '/path/to/integration/hubspot/hubspot-deploy.json';
      const fallbackPath = path.join(schemasPath, systemFile);

      getDeployJsonPath.mockReturnValue(newSystemPath);
      fsSync.existsSync.mockReturnValue(false);
      fs.access.mockRejectedValue(new Error('File not found'));

      await expect(
        validateSingleSystemFile(systemFile, appName, schemasPath)
      ).rejects.toThrow(`External system file not found: ${fallbackPath} (also checked: ${newSystemPath})`);
    });
  });

  describe('validateSystemFiles', () => {
    it('should validate multiple system files', async() => {
      const systemFiles = ['system1-deploy.json', 'system2-deploy.json'];
      const appName = 'test-app';
      const schemasPath = '/path/to/schemas';
      const newSystemPath = '/path/to/integration/test-app/test-app-deploy.json';

      getDeployJsonPath.mockReturnValue(newSystemPath);
      fsSync.existsSync.mockReturnValue(true);

      const result = await validateSystemFiles(systemFiles, appName, schemasPath);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(newSystemPath);
      expect(result[1]).toBe(newSystemPath);
    });

    it('should handle empty system files array', async() => {
      const systemFiles = [];
      const appName = 'test-app';
      const schemasPath = '/path/to/schemas';

      const result = await validateSystemFiles(systemFiles, appName, schemasPath);

      expect(result).toEqual([]);
    });

    it('should handle mixed validation results', async() => {
      const systemFiles = ['system1-deploy.json', 'system2-deploy.json'];
      const appName = 'test-app';
      const schemasPath = '/path/to/schemas';
      const newSystemPath = '/path/to/integration/test-app/test-app-deploy.json';
      const fallbackPath1 = path.join(schemasPath, 'system1-deploy.json');
      const fallbackPath2 = path.join(schemasPath, 'system2-deploy.json');

      getDeployJsonPath.mockReturnValue(newSystemPath);
      fsSync.existsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      fs.access
        .mockResolvedValueOnce(undefined);

      const result = await validateSystemFiles(systemFiles, appName, schemasPath);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(newSystemPath);
      expect(result[1]).toBe(fallbackPath2);
    });
  });

  describe('validateSingleDatasourceFile', () => {
    it('should return datasource path when file exists in app path', async() => {
      const datasourceFile = 'hubspot-deploy-contact.json';
      const appPath = '/path/to/integration/hubspot';
      const schemasPath = '/path/to/schemas';
      const datasourcePath = path.join(appPath, datasourceFile);

      fs.access.mockResolvedValue(undefined);

      const result = await validateSingleDatasourceFile(datasourceFile, appPath, schemasPath);

      expect(fs.access).toHaveBeenCalledWith(datasourcePath);
      expect(result).toBe(datasourcePath);
    });

    it('should fall back to schemas path when file not in app path', async() => {
      const datasourceFile = 'hubspot-deploy-contact.json';
      const appPath = '/path/to/integration/hubspot';
      const schemasPath = '/path/to/schemas';
      const datasourcePath = path.join(appPath, datasourceFile);
      const fallbackPath = path.join(schemasPath, datasourceFile);

      fs.access
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(undefined);

      const result = await validateSingleDatasourceFile(datasourceFile, appPath, schemasPath);

      expect(fs.access).toHaveBeenCalledWith(datasourcePath);
      expect(fs.access).toHaveBeenCalledWith(fallbackPath);
      expect(result).toBe(fallbackPath);
    });

    it('should throw error when neither path exists', async() => {
      const datasourceFile = 'hubspot-deploy-contact.json';
      const appPath = '/path/to/integration/hubspot';
      const schemasPath = '/path/to/schemas';
      const datasourcePath = path.join(appPath, datasourceFile);
      const fallbackPath = path.join(schemasPath, datasourceFile);

      fs.access
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('File not found'));

      await expect(
        validateSingleDatasourceFile(datasourceFile, appPath, schemasPath)
      ).rejects.toThrow(`External datasource file not found: ${datasourcePath} or ${fallbackPath}`);
    });
  });

  describe('validateDatasourceFiles', () => {
    it('should validate multiple datasource files', async() => {
      const datasourceFiles = ['datasource1.json', 'datasource2.json'];
      const appPath = '/path/to/integration/hubspot';
      const schemasPath = '/path/to/schemas';
      const datasourcePath1 = path.join(appPath, 'datasource1.json');
      const datasourcePath2 = path.join(appPath, 'datasource2.json');

      fs.access.mockResolvedValue(undefined);

      const result = await validateDatasourceFiles(datasourceFiles, appPath, schemasPath);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(datasourcePath1);
      expect(result[1]).toBe(datasourcePath2);
    });

    it('should handle empty datasource files array', async() => {
      const datasourceFiles = [];
      const appPath = '/path/to/integration/hubspot';
      const schemasPath = '/path/to/schemas';

      const result = await validateDatasourceFiles(datasourceFiles, appPath, schemasPath);

      expect(result).toEqual([]);
    });

    it('should handle mixed validation results', async() => {
      const datasourceFiles = ['datasource1.json', 'datasource2.json'];
      const appPath = '/path/to/integration/hubspot';
      const schemasPath = '/path/to/schemas';
      const datasourcePath1 = path.join(appPath, 'datasource1.json');
      const datasourcePath2 = path.join(appPath, 'datasource2.json');
      const fallbackPath2 = path.join(schemasPath, 'datasource2.json');

      fs.access
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(undefined);

      const result = await validateDatasourceFiles(datasourceFiles, appPath, schemasPath);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(datasourcePath1);
      expect(result[1]).toBe(fallbackPath2);
    });
  });

  describe('extractSystemKey', () => {
    it('should extract system key from system file path', () => {
      const systemFilePath = '/path/to/hubspot-deploy.json';
      const result = extractSystemKey(systemFilePath);
      expect(result).toBe('hubspot');
    });

    it('should handle system file path with different formats', () => {
      const systemFilePath = '/path/to/integration/test-system-deploy.json';
      const result = extractSystemKey(systemFilePath);
      expect(result).toBe('test-system');
    });

    it('should handle system file path without -deploy suffix', () => {
      const systemFilePath = '/path/to/hubspot.json';
      const result = extractSystemKey(systemFilePath);
      expect(result).toBe('hubspot');
    });

    it('should handle system file path with multiple hyphens', () => {
      const systemFilePath = '/path/to/my-test-system-deploy.json';
      const result = extractSystemKey(systemFilePath);
      expect(result).toBe('my-test-system');
    });

    it('should handle system file path with directory separators', () => {
      const systemFilePath = path.join('integration', 'hubspot', 'hubspot-deploy.json');
      const result = extractSystemKey(systemFilePath);
      expect(result).toBe('hubspot');
    });

    it('should handle system file path with Windows separators', () => {
      const systemFilePath = 'C:\\path\\to\\hubspot-deploy.json';
      const result = extractSystemKey(systemFilePath);
      expect(result).toBe('hubspot');
    });
  });
});

