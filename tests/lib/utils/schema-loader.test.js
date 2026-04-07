/**
 * Tests for AI Fabrix Builder Schema Loader Utilities
 *
 * @fileoverview Unit tests for schema-loader.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const nodeFsLib = require('../../../lib/internal/node-fs');

const SCHEMA_LOADER = '../../../lib/utils/schema-loader';

describe('Schema Loader Utilities', () => {
  const mockSystemSchemaPath = path.join(__dirname, '../../../lib/schema/external-system.schema.json');
  const mockDatasourceSchemaPath = path.join(__dirname, '../../../lib/schema/external-datasource.schema.json');

  function freshFsMock() {
    return {
      existsSync: jest.fn(),
      readFileSync: jest.fn()
    };
  }

  function resetLoaderModule() {
    delete require.cache[require.resolve(SCHEMA_LOADER)];
    try {
      const loader = require(SCHEMA_LOADER);
      if (loader.resetValidators) {
        loader.resetValidators();
      }
    } catch {
      // not loaded yet
    }
  }

  beforeEach(() => {
    resetLoaderModule();
  });

  describe('loadExternalSystemSchema', () => {
    it('should load and compile external system schema', () => {
      resetLoaderModule();
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const mockSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['key', 'displayName'],
        properties: {
          key: { type: 'string' },
          displayName: { type: 'string' }
        }
      };
      try {
        fsM.existsSync.mockImplementation((filePath) => filePath === mockSystemSchemaPath);
        fsM.readFileSync.mockReturnValue(JSON.stringify(mockSchema));
        const { loadExternalSystemSchema } = require(SCHEMA_LOADER);
        const validate = loadExternalSystemSchema();
        expect(validate).toBeInstanceOf(Function);
        expect(fsM.existsSync).toHaveBeenCalledWith(mockSystemSchemaPath);
        expect(fsM.readFileSync).toHaveBeenCalledWith(mockSystemSchemaPath, 'utf8');
      } finally {
        spy.mockRestore();
      }
    });

    it('should cache compiled validator', () => {
      resetLoaderModule();
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const mockSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {}
      };
      try {
        fsM.existsSync.mockImplementation((filePath) => filePath === mockSystemSchemaPath);
        fsM.readFileSync.mockReturnValue(JSON.stringify(mockSchema));
        const { loadExternalSystemSchema } = require(SCHEMA_LOADER);
        const validate1 = loadExternalSystemSchema();
        const validate2 = loadExternalSystemSchema();
        expect(validate1).toBe(validate2);
        expect(fsM.readFileSync).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });

    it('should throw error if schema file not found', () => {
      resetLoaderModule();
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      try {
        fsM.existsSync.mockImplementation(() => false);
        const { loadExternalSystemSchema } = require(SCHEMA_LOADER);
        expect(() => loadExternalSystemSchema()).toThrow('External system schema not found');
      } finally {
        spy.mockRestore();
      }
    });

    it('should throw error on invalid JSON', () => {
      resetLoaderModule();
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      try {
        fsM.existsSync.mockImplementation((filePath) => filePath === mockSystemSchemaPath);
        fsM.readFileSync.mockReturnValue('invalid json {');
        const { loadExternalSystemSchema } = require(SCHEMA_LOADER);
        expect(() => loadExternalSystemSchema()).toThrow('Invalid JSON in external-system.schema.json');
      } finally {
        spy.mockRestore();
      }
    });

    it('should validate data correctly', () => {
      resetLoaderModule();
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const mockSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      };
      try {
        fsM.existsSync.mockImplementation((filePath) => filePath === mockSystemSchemaPath);
        fsM.readFileSync.mockReturnValue(JSON.stringify(mockSchema));
        const { loadExternalSystemSchema } = require(SCHEMA_LOADER);
        const validate = loadExternalSystemSchema();
        expect(validate({ key: 'test' })).toBe(true);
        expect(validate({})).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('loadExternalDataSourceSchema', () => {
    it('should load and compile external datasource schema', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const mockSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        required: ['key', 'systemKey'],
        properties: {
          key: { type: 'string' },
          systemKey: { type: 'string' }
        }
      };
      try {
        fsM.existsSync.mockImplementation((filePath) => filePath === mockDatasourceSchemaPath);
        fsM.readFileSync.mockReturnValue(JSON.stringify(mockSchema));
        const { loadExternalDataSourceSchema } = require(SCHEMA_LOADER);
        const validate = loadExternalDataSourceSchema();
        expect(validate).toBeInstanceOf(Function);
        expect(fsM.existsSync).toHaveBeenCalledWith(mockDatasourceSchemaPath);
        expect(fsM.readFileSync).toHaveBeenCalledWith(mockDatasourceSchemaPath, 'utf8');
      } finally {
        spy.mockRestore();
      }
    });

    it('should cache compiled validator', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const mockSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {}
      };
      try {
        fsM.existsSync.mockImplementation((filePath) => filePath === mockDatasourceSchemaPath);
        fsM.readFileSync.mockReturnValue(JSON.stringify(mockSchema));
        const { loadExternalDataSourceSchema } = require(SCHEMA_LOADER);
        const validate1 = loadExternalDataSourceSchema();
        const validate2 = loadExternalDataSourceSchema();
        expect(validate1).toBe(validate2);
        expect(fsM.readFileSync).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });

    it('should throw error if schema file not found', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      try {
        fsM.existsSync.mockReturnValue(false);
        const { loadExternalDataSourceSchema } = require(SCHEMA_LOADER);
        expect(() => loadExternalDataSourceSchema()).toThrow('External datasource schema not found');
      } finally {
        spy.mockRestore();
      }
    });

    it('should throw error on invalid JSON', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      try {
        fsM.existsSync.mockImplementation((filePath) => filePath === mockDatasourceSchemaPath);
        fsM.readFileSync.mockReturnValue('invalid json {');
        const { loadExternalDataSourceSchema } = require(SCHEMA_LOADER);
        expect(() => loadExternalDataSourceSchema()).toThrow('Invalid JSON in external-datasource.schema.json');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('detectSchemaType', () => {
    it('should detect external-system from $id', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const content = JSON.stringify({
        $id: 'https://aifabrix.dev/schemas/external-system.schema.json'
      });
      const filePath = '/path/to/file.json';
      try {
        fsM.existsSync.mockImplementation((p) => p === filePath);
        fsM.readFileSync.mockReturnValue(content);
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(detectSchemaType(filePath)).toBe('external-system');
      } finally {
        spy.mockRestore();
      }
    });

    it('should detect external-datasource from $id', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const content = JSON.stringify({
        $id: 'https://aifabrix.dev/schemas/external-datasource.schema.json'
      });
      const filePath = '/path/to/file.json';
      try {
        fsM.existsSync.mockImplementation((p) => p === filePath);
        fsM.readFileSync.mockReturnValue(content);
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(detectSchemaType(filePath)).toBe('external-datasource');
      } finally {
        spy.mockRestore();
      }
    });

    it('should detect external-system from title', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const content = JSON.stringify({
        title: 'External System Configuration'
      });
      const filePath = '/path/to/file.json';
      try {
        fsM.existsSync.mockImplementation((p) => p === filePath);
        fsM.readFileSync.mockReturnValue(content);
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(detectSchemaType(filePath)).toBe('external-system');
      } finally {
        spy.mockRestore();
      }
    });

    it('should detect external-datasource from required fields', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const content = JSON.stringify({
        key: 'test',
        displayName: 'Test',
        systemKey: 'hubspot',
        entityKey: 'deal',
        fieldMappings: {}
      });
      const filePath = '/path/to/file.json';
      try {
        fsM.existsSync.mockImplementation((p) => p === filePath);
        fsM.readFileSync.mockReturnValue(content);
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(detectSchemaType(filePath)).toBe('external-datasource');
      } finally {
        spy.mockRestore();
      }
    });

    it('should detect external-system from type and authentication', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const content = JSON.stringify({
        key: 'test',
        displayName: 'Test',
        type: 'openapi',
        authentication: {}
      });
      const filePath = '/path/to/file.json';
      try {
        fsM.existsSync.mockImplementation((p) => p === filePath);
        fsM.readFileSync.mockReturnValue(content);
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(detectSchemaType(filePath)).toBe('external-system');
      } finally {
        spy.mockRestore();
      }
    });

    it('should detect from filename pattern', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const filePaths = [
        '/path/to/external-system.json',
        '/path/to/external_datasource.json',
        '/path/to/datasource.json',
        '/path/to/application.json'
      ];
      try {
        fsM.existsSync.mockImplementation((p) => filePaths.includes(p));
        fsM.readFileSync.mockReturnValue('{}');
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(detectSchemaType('/path/to/external-system.json')).toBe('external-system');
        expect(detectSchemaType('/path/to/external_datasource.json')).toBe('external-datasource');
        expect(detectSchemaType('/path/to/datasource.json')).toBe('external-datasource');
        expect(detectSchemaType('/path/to/application.json')).toBe('application');
      } finally {
        spy.mockRestore();
      }
    });

    it('should use provided content instead of reading file', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const content = JSON.stringify({
        $id: 'https://aifabrix.dev/schemas/external-system.schema.json'
      });
      try {
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(detectSchemaType('/path/to/file.json', content)).toBe('external-system');
        expect(fsM.readFileSync).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('should throw error if file not found and no content provided', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      try {
        fsM.existsSync.mockReturnValue(false);
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(() => detectSchemaType('/path/to/nonexistent.json')).toThrow('File not found');
      } finally {
        spy.mockRestore();
      }
    });

    it('should throw error on invalid JSON', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      try {
        fsM.existsSync.mockReturnValue(true);
        fsM.readFileSync.mockReturnValue('invalid json {');
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(() => detectSchemaType('/path/to/file.json')).toThrow('Invalid JSON in file');
      } finally {
        spy.mockRestore();
      }
    });

    it('should default to application if cannot determine', () => {
      const fsM = freshFsMock();
      const spy = jest.spyOn(nodeFsLib, 'nodeFs').mockReturnValue(fsM);
      const filePath = '/path/to/unknown.json';
      try {
        fsM.existsSync.mockImplementation((p) => p === filePath);
        fsM.readFileSync.mockReturnValue('{}');
        const { detectSchemaType } = require(SCHEMA_LOADER);
        expect(detectSchemaType(filePath)).toBe('application');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('detectSchemaTypeFromParsed', () => {
    it('should detect application from parsed object (application fields)', () => {
      const parsed = { image: 'img', registryMode: 'acr', port: 8080 };
      const { detectSchemaTypeFromParsed } = require(SCHEMA_LOADER);
      expect(detectSchemaTypeFromParsed(parsed, '/path/to/file.json')).toBe('application');
    });

    it('should detect external-system from parsed object ($id)', () => {
      const parsed = { $id: 'https://aifabrix.dev/schemas/external-system.schema.json' };
      const { detectSchemaTypeFromParsed } = require(SCHEMA_LOADER);
      expect(detectSchemaTypeFromParsed(parsed, '/path/to/file.json')).toBe('external-system');
    });

    it('should detect external-datasource from parsed object (datasource fields)', () => {
      const parsed = { systemKey: 's', entityType: 'Deal', fieldMappings: {} };
      const { detectSchemaTypeFromParsed } = require(SCHEMA_LOADER);
      expect(detectSchemaTypeFromParsed(parsed, '/path/to/file.json')).toBe('external-datasource');
    });

    it('should use filename when content does not determine type', () => {
      const parsed = { unknown: true };
      const { detectSchemaTypeFromParsed } = require(SCHEMA_LOADER);
      expect(detectSchemaTypeFromParsed(parsed, '/path/to/external-system.json')).toBe('external-system');
      expect(detectSchemaTypeFromParsed(parsed, '/path/to/application.yaml')).toBe('application');
    });

    it('should default to application when detection returns null', () => {
      const parsed = { foo: 'bar' };
      const { detectSchemaTypeFromParsed } = require(SCHEMA_LOADER);
      expect(detectSchemaTypeFromParsed(parsed, '/path/to/other.txt')).toBe('application');
    });

    it('should handle non-object parsed (default to application)', () => {
      const { detectSchemaTypeFromParsed } = require(SCHEMA_LOADER);
      expect(detectSchemaTypeFromParsed(null, '/path/to/file.json')).toBe('application');
      expect(detectSchemaTypeFromParsed(undefined, '/path/to/file.json')).toBe('application');
    });
  });
});
