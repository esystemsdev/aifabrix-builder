/**
 * Tests for AI Fabrix Builder Schema Loader Utilities
 *
 * @fileoverview Unit tests for schema-loader.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');

// Mock fs BEFORE requiring modules
jest.mock('fs');
const fsSync = require('fs');

describe('Schema Loader Utilities', () => {
  const mockSystemSchemaPath = path.join(__dirname, '../../../lib/schema/external-system.schema.json');
  const mockDatasourceSchemaPath = path.join(__dirname, '../../../lib/schema/external-datasource.schema.json');

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear module cache to reset validators
    delete require.cache[require.resolve('../../../lib/utils/schema-loader')];
    // Also reset validators if module is already loaded
    try {
      const loader = require('../../../lib/utils/schema-loader');
      if (loader.resetValidators) {
        loader.resetValidators();
      }
    } catch (e) {
      // Module not loaded yet, that's fine
    }
  });

  describe('loadExternalSystemSchema', () => {
    it('should load and compile external system schema', () => {
      // Clear cache first
      delete require.cache[require.resolve('../../../lib/utils/schema-loader')];
      const mockSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['key', 'displayName'],
        properties: {
          key: { type: 'string' },
          displayName: { type: 'string' }
        }
      };

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockSystemSchemaPath);
      fsSync.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

      const { loadExternalSystemSchema } = require('../../../lib/utils/schema-loader');
      const validate = loadExternalSystemSchema();

      expect(validate).toBeInstanceOf(Function);
      expect(fsSync.existsSync).toHaveBeenCalledWith(mockSystemSchemaPath);
      expect(fsSync.readFileSync).toHaveBeenCalledWith(mockSystemSchemaPath, 'utf8');
    });

    it('should cache compiled validator', () => {
      // Clear cache first to start fresh
      delete require.cache[require.resolve('../../../lib/utils/schema-loader')];
      const mockSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {}
      };

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockSystemSchemaPath);
      fsSync.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

      const { loadExternalSystemSchema } = require('../../../lib/utils/schema-loader');
      // First call should read the file
      const validate1 = loadExternalSystemSchema();
      // Second call should use cache (not read file again)
      const validate2 = loadExternalSystemSchema();

      expect(validate1).toBe(validate2);
      // Should only read file once due to caching
      expect(fsSync.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should throw error if schema file not found', () => {
      // Clear cache first
      delete require.cache[require.resolve('../../../lib/utils/schema-loader')];
      fsSync.existsSync.mockImplementation(() => false);

      const { loadExternalSystemSchema } = require('../../../lib/utils/schema-loader');
      expect(() => loadExternalSystemSchema()).toThrow('External system schema not found');
    });

    it('should throw error on invalid JSON', () => {
      // Clear cache first
      delete require.cache[require.resolve('../../../lib/utils/schema-loader')];
      fsSync.existsSync.mockImplementation((filePath) => filePath === mockSystemSchemaPath);
      fsSync.readFileSync.mockReturnValue('invalid json {');

      const { loadExternalSystemSchema } = require('../../../lib/utils/schema-loader');
      expect(() => loadExternalSystemSchema()).toThrow('Invalid JSON in external-system.schema.json');
    });

    it('should validate data correctly', () => {
      // Clear cache first
      delete require.cache[require.resolve('../../../lib/utils/schema-loader')];
      const mockSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      };

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockSystemSchemaPath);
      fsSync.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

      const { loadExternalSystemSchema } = require('../../../lib/utils/schema-loader');
      const validate = loadExternalSystemSchema();

      expect(validate({ key: 'test' })).toBe(true);
      expect(validate({})).toBe(false);
    });
  });

  describe('loadExternalDataSourceSchema', () => {
    it('should load and compile external datasource schema', () => {
      const mockSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        required: ['key', 'systemKey'],
        properties: {
          key: { type: 'string' },
          systemKey: { type: 'string' }
        }
      };

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockDatasourceSchemaPath);
      fsSync.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

      const { loadExternalDataSourceSchema } = require('../../../lib/utils/schema-loader');
      const validate = loadExternalDataSourceSchema();

      expect(validate).toBeInstanceOf(Function);
      expect(fsSync.existsSync).toHaveBeenCalledWith(mockDatasourceSchemaPath);
      expect(fsSync.readFileSync).toHaveBeenCalledWith(mockDatasourceSchemaPath, 'utf8');
    });

    it('should cache compiled validator', () => {
      const mockSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {}
      };

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockDatasourceSchemaPath);
      fsSync.readFileSync.mockReturnValue(JSON.stringify(mockSchema));

      const { loadExternalDataSourceSchema } = require('../../../lib/utils/schema-loader');
      const validate1 = loadExternalDataSourceSchema();
      const validate2 = loadExternalDataSourceSchema();

      expect(validate1).toBe(validate2);
      expect(fsSync.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should throw error if schema file not found', () => {
      fsSync.existsSync.mockReturnValue(false);

      const { loadExternalDataSourceSchema } = require('../../../lib/utils/schema-loader');
      expect(() => loadExternalDataSourceSchema()).toThrow('External datasource schema not found');
    });

    it('should throw error on invalid JSON', () => {
      fsSync.existsSync.mockImplementation((filePath) => filePath === mockDatasourceSchemaPath);
      fsSync.readFileSync.mockReturnValue('invalid json {');

      const { loadExternalDataSourceSchema } = require('../../../lib/utils/schema-loader');
      expect(() => loadExternalDataSourceSchema()).toThrow('Invalid JSON in external-datasource.schema.json');
    });
  });

  describe('detectSchemaType', () => {
    it('should detect external-system from $id', () => {
      const content = JSON.stringify({
        $id: 'https://aifabrix.ai/schemas/external-system.schema.json'
      });
      const filePath = '/path/to/file.json';

      fsSync.existsSync.mockImplementation((path) => path === filePath);
      fsSync.readFileSync.mockReturnValue(content);

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      const result = detectSchemaType(filePath);

      expect(result).toBe('external-system');
    });

    it('should detect external-datasource from $id', () => {
      const content = JSON.stringify({
        $id: 'https://aifabrix.ai/schemas/external-datasource.schema.json'
      });
      const filePath = '/path/to/file.json';

      fsSync.existsSync.mockImplementation((path) => path === filePath);
      fsSync.readFileSync.mockReturnValue(content);

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      const result = detectSchemaType(filePath);

      expect(result).toBe('external-datasource');
    });

    it('should detect external-system from title', () => {
      const content = JSON.stringify({
        title: 'External System Configuration'
      });
      const filePath = '/path/to/file.json';

      fsSync.existsSync.mockImplementation((path) => path === filePath);
      fsSync.readFileSync.mockReturnValue(content);

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      const result = detectSchemaType(filePath);

      expect(result).toBe('external-system');
    });

    it('should detect external-datasource from required fields', () => {
      const content = JSON.stringify({
        key: 'test',
        displayName: 'Test',
        systemKey: 'hubspot',
        entityKey: 'deal',
        fieldMappings: {}
      });
      const filePath = '/path/to/file.json';

      fsSync.existsSync.mockImplementation((path) => path === filePath);
      fsSync.readFileSync.mockReturnValue(content);

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      const result = detectSchemaType(filePath);

      expect(result).toBe('external-datasource');
    });

    it('should detect external-system from type and authentication', () => {
      const content = JSON.stringify({
        key: 'test',
        displayName: 'Test',
        type: 'openapi',
        authentication: {}
      });
      const filePath = '/path/to/file.json';

      fsSync.existsSync.mockImplementation((path) => path === filePath);
      fsSync.readFileSync.mockReturnValue(content);

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      const result = detectSchemaType(filePath);

      expect(result).toBe('external-system');
    });

    it('should detect from filename pattern', () => {
      const filePaths = [
        '/path/to/external-system.json',
        '/path/to/external_datasource.json',
        '/path/to/datasource.json',
        '/path/to/application.json'
      ];

      fsSync.existsSync.mockImplementation((path) => filePaths.includes(path));
      fsSync.readFileSync.mockReturnValue('{}');

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');

      expect(detectSchemaType('/path/to/external-system.json')).toBe('external-system');
      expect(detectSchemaType('/path/to/external_datasource.json')).toBe('external-datasource');
      expect(detectSchemaType('/path/to/datasource.json')).toBe('external-datasource');
      expect(detectSchemaType('/path/to/application.json')).toBe('application');
    });

    it('should use provided content instead of reading file', () => {
      const content = JSON.stringify({
        $id: 'https://aifabrix.ai/schemas/external-system.schema.json'
      });

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      const result = detectSchemaType('/path/to/file.json', content);

      expect(result).toBe('external-system');
      expect(fsSync.readFileSync).not.toHaveBeenCalled();
    });

    it('should throw error if file not found and no content provided', () => {
      fsSync.existsSync.mockReturnValue(false);

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      expect(() => detectSchemaType('/path/to/nonexistent.json')).toThrow('File not found');
    });

    it('should throw error on invalid JSON', () => {
      fsSync.existsSync.mockReturnValue(true);
      fsSync.readFileSync.mockReturnValue('invalid json {');

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      expect(() => detectSchemaType('/path/to/file.json')).toThrow('Invalid JSON in file');
    });

    it('should default to application if cannot determine', () => {
      const filePath = '/path/to/unknown.json';
      fsSync.existsSync.mockImplementation((path) => path === filePath);
      fsSync.readFileSync.mockReturnValue('{}');

      const { detectSchemaType } = require('../../../lib/utils/schema-loader');
      const result = detectSchemaType(filePath);

      expect(result).toBe('application');
    });
  });
});

