/**
 * Tests for AI Fabrix Builder Schema Resolver Utilities
 *
 * @fileoverview Unit tests for schema-resolver.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Mock fs BEFORE requiring modules
jest.mock('fs');
const fsSync = require('fs');

describe('Schema Resolver Utilities', () => {
  const mockAppName = 'testapp';
  const mockVariablesPath = path.join(process.cwd(), 'builder', mockAppName, 'variables.yaml');
  const mockSchemaBasePath = path.join(process.cwd(), 'builder', mockAppName, 'schemas');
  const mockSystemFile = 'hubspot.json';
  const mockDatasourceFile = 'hubspot-deal.json';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveSchemaBasePath', () => {
    it('should resolve absolute path from variables.yaml', async() => {
      const absolutePath = '/absolute/path/to/schemas';
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: absolutePath
        }
      });

      // Use path.normalize to match what the actual code does
      const path = require('path');
      const normalizedPath = path.normalize(absolutePath);

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return true;
        // Handle both original and normalized paths (Windows vs Unix)
        if (filePath === absolutePath || filePath === normalizedPath) return true;
        return false;
      });
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return variablesContent;
        return '';
      });
      fsSync.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath === absolutePath || filePath === normalizedPath
      }));

      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      const result = await resolveSchemaBasePath(mockAppName);

      // Result should be normalized
      expect(result).toBe(normalizedPath);
      expect(fsSync.existsSync).toHaveBeenCalledWith(mockVariablesPath);
      // Check that existsSync was called with normalized path
      expect(fsSync.existsSync).toHaveBeenCalledWith(normalizedPath);
    });

    it('should resolve relative path from variables.yaml', async() => {
      const relativePath = './schemas';
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: relativePath
        }
      });
      const expectedResolvedPath = path.resolve(path.dirname(mockVariablesPath), relativePath);

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return true;
        if (filePath === expectedResolvedPath) return true;
        return false;
      });
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return variablesContent;
        return '';
      });
      fsSync.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath === expectedResolvedPath
      }));

      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      const result = await resolveSchemaBasePath(mockAppName);

      expect(result).toBe(expectedResolvedPath);
    });

    it('should throw error if app name is missing', async() => {
      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      await expect(resolveSchemaBasePath(null)).rejects.toThrow('App name is required');
      await expect(resolveSchemaBasePath('')).rejects.toThrow('App name is required');
    });

    it('should throw error if variables.yaml not found', async() => {
      fsSync.existsSync.mockReturnValue(false);

      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      await expect(resolveSchemaBasePath(mockAppName)).rejects.toThrow('variables.yaml not found');
    });

    it('should throw error if externalIntegration block missing', async() => {
      const variablesContent = yaml.dump({});

      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue(variablesContent);

      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      await expect(resolveSchemaBasePath(mockAppName)).rejects.toThrow('externalIntegration block not found');
    });

    it('should throw error if schemaBasePath missing', async() => {
      const variablesContent = yaml.dump({
        externalIntegration: {}
      });

      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue(variablesContent);

      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      await expect(resolveSchemaBasePath(mockAppName)).rejects.toThrow('schemaBasePath not found');
    });

    it('should throw error if path does not exist', async() => {
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: '/nonexistent/path'
        }
      });

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return true;
        return false;
      });
      fsSync.readFileSync.mockReturnValue(variablesContent);

      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      await expect(resolveSchemaBasePath(mockAppName)).rejects.toThrow('Schema base path does not exist');
    });

    it('should throw error if path is not a directory', async() => {
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: '/path/to/file'
        }
      });

      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue(variablesContent);
      fsSync.statSync.mockReturnValue({
        isDirectory: () => false
      });

      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      await expect(resolveSchemaBasePath(mockAppName)).rejects.toThrow('Schema base path is not a directory');
    });

    it('should throw error on invalid YAML', async() => {
      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

      const { resolveSchemaBasePath } = require('../../../lib/utils/schema-resolver');
      await expect(resolveSchemaBasePath(mockAppName)).rejects.toThrow('Invalid YAML syntax');
    });
  });

  describe('resolveExternalFiles', () => {
    it('should resolve system and datasource files', async() => {
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: [mockSystemFile],
          dataSources: [mockDatasourceFile]
        }
      });

      const schemaBasePath = path.resolve(path.dirname(mockVariablesPath), './schemas');
      const systemPath = path.join(schemaBasePath, mockSystemFile);
      const datasourcePath = path.join(schemaBasePath, mockDatasourceFile);

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return true;
        if (filePath === schemaBasePath) return true;
        if (filePath === systemPath) return true;
        if (filePath === datasourcePath) return true;
        return false;
      });
      fsSync.readFileSync.mockReturnValue(variablesContent);
      fsSync.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath === schemaBasePath
      }));

      const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
      const result = await resolveExternalFiles(mockAppName);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: path.normalize(systemPath),
        type: 'system',
        fileName: mockSystemFile
      });
      expect(result[1]).toEqual({
        path: path.normalize(datasourcePath),
        type: 'datasource',
        fileName: mockDatasourceFile
      });
    });

    it('should return empty array if no externalIntegration block', async() => {
      const variablesContent = yaml.dump({});

      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue(variablesContent);

      const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
      const result = await resolveExternalFiles(mockAppName);

      expect(result).toEqual([]);
    });

    it('should return empty array if no systems or datasources', async() => {
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: './schemas'
        }
      });

      const schemaBasePath = path.resolve(path.dirname(mockVariablesPath), './schemas');

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return true;
        if (filePath === schemaBasePath) return true;
        return false;
      });
      fsSync.readFileSync.mockReturnValue(variablesContent);
      fsSync.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath === schemaBasePath
      }));

      const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
      const result = await resolveExternalFiles(mockAppName);

      expect(result).toEqual([]);
    });

    it('should throw error if system file not found', async() => {
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: [mockSystemFile]
        }
      });

      const schemaBasePath = path.resolve(path.dirname(mockVariablesPath), './schemas');

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return true;
        if (filePath === schemaBasePath) return true;
        return false; // System file doesn't exist
      });
      fsSync.readFileSync.mockReturnValue(variablesContent);
      fsSync.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath === schemaBasePath
      }));

      const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
      await expect(resolveExternalFiles(mockAppName)).rejects.toThrow('External system file not found');
    });

    it('should throw error if datasource file not found', async() => {
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: './schemas',
          dataSources: [mockDatasourceFile]
        }
      });

      const schemaBasePath = path.resolve(path.dirname(mockVariablesPath), './schemas');

      fsSync.existsSync.mockImplementation((filePath) => {
        if (filePath === mockVariablesPath) return true;
        if (filePath === schemaBasePath) return true;
        return false; // Datasource file doesn't exist
      });
      fsSync.readFileSync.mockReturnValue(variablesContent);
      fsSync.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath === schemaBasePath
      }));

      const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
      await expect(resolveExternalFiles(mockAppName)).rejects.toThrow('External datasource file not found');
    });

    it('should handle multiple systems and datasources', async() => {
      const variablesContent = yaml.dump({
        externalIntegration: {
          schemaBasePath: './schemas',
          systems: ['system1.json', 'system2.json'],
          dataSources: ['datasource1.json', 'datasource2.json']
        }
      });

      const schemaBasePath = path.resolve(path.dirname(mockVariablesPath), './schemas');

      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue(variablesContent);
      fsSync.statSync.mockReturnValue({
        isDirectory: () => true
      });

      const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
      const result = await resolveExternalFiles(mockAppName);

      expect(result).toHaveLength(4);
      expect(result.filter(f => f.type === 'system')).toHaveLength(2);
      expect(result.filter(f => f.type === 'datasource')).toHaveLength(2);
    });

    it('should throw error if app name is missing', async() => {
      const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
      await expect(resolveExternalFiles(null)).rejects.toThrow('App name is required');
      await expect(resolveExternalFiles('')).rejects.toThrow('App name is required');
    });

    it('should throw error if variables.yaml not found', async() => {
      fsSync.existsSync.mockReturnValue(false);

      const { resolveExternalFiles } = require('../../../lib/utils/schema-resolver');
      await expect(resolveExternalFiles(mockAppName)).rejects.toThrow('variables.yaml not found');
    });
  });
});

