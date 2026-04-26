/**
 * Tests for AI Fabrix Builder Datasource Validation Module
 *
 * @fileoverview Unit tests for datasource-validate.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');

// Mock modules
jest.mock('fs');
jest.mock('../../../lib/utils/schema-loader', () => ({
  loadExternalDataSourceSchema: jest.fn()
}));
jest.mock('../../../lib/utils/error-formatter', () => ({
  formatValidationErrors: jest.fn((errors) => errors.map(e => e.message || JSON.stringify(e)))
}));
jest.mock('../../../lib/utils/paths', () => ({
  listIntegrationAppNames: jest.fn(() => []),
  getIntegrationPath: jest.fn((app) => `/mock/integration/${app}`)
}));

const fsSync = require('fs');
const paths = require('../../../lib/utils/paths');
const { loadExternalDataSourceSchema } = require('../../../lib/utils/schema-loader');
const { formatValidationErrors } = require('../../../lib/utils/error-formatter');

describe('Datasource Validation Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsSync.statSync.mockImplementation(() => ({
      isFile: () => true,
      isDirectory: () => false
    }));
  });

  describe('validateDatasourceFile', () => {
    it('should validate valid datasource file', async() => {
      const mockFilePath = '/path/to/datasource.json';
      const mockContent = JSON.stringify({
        key: 'test-datasource',
        displayName: 'Test Datasource',
        systemKey: 'hubspot',
        entityKey: 'deal',
        fieldMappings: {}
      });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalDataSourceSchema.mockReturnValue(mockValidate);

      const { validateDatasourceFile } = require('../../../lib/datasource/validate');
      const result = await validateDatasourceFile(mockFilePath);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.summary).toBeDefined();
      expect(result.summary.key).toBe('test-datasource');
      expect(mockValidate).toHaveBeenCalledWith(JSON.parse(mockContent));
    });

    it('should return errors for invalid datasource file', async() => {
      const mockFilePath = '/path/to/invalid.json';
      const mockContent = JSON.stringify({
        key: 'test'
        // Missing required fields
      });
      const mockValidate = jest.fn().mockReturnValue(false);
      const mockErrors = [{ message: 'Missing required field: systemKey' }];

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalDataSourceSchema.mockReturnValue(mockValidate);
      mockValidate.errors = mockErrors;
      formatValidationErrors.mockReturnValue(['Missing required field: systemKey']);

      const { validateDatasourceFile } = require('../../../lib/datasource/validate');
      const result = await validateDatasourceFile(mockFilePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('systemKey');
    });

    it('should throw error if file path is missing', async() => {
      const { validateDatasourceFile } = require('../../../lib/datasource/validate');
      await expect(validateDatasourceFile(null)).rejects.toThrow('File path is required');
      await expect(validateDatasourceFile('')).rejects.toThrow('File path is required');
      await expect(validateDatasourceFile(123)).rejects.toThrow('File path is required');
    });

    it('should throw error if file not found', async() => {
      fsSync.existsSync.mockReturnValue(false);

      const { validateDatasourceFile } = require('../../../lib/datasource/validate');
      await expect(validateDatasourceFile('/nonexistent.json')).rejects.toThrow('File not found');
    });

    it('should handle invalid JSON syntax', async() => {
      const mockFilePath = '/path/to/invalid.json';
      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue('invalid json {');

      const { validateDatasourceFile } = require('../../../lib/datasource/validate');
      const result = await validateDatasourceFile(mockFilePath);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid JSON syntax');
      expect(result.resolvedPath).toBe(mockFilePath);
    });

    it('should return empty warnings array', async() => {
      const mockFilePath = '/path/to/datasource.json';
      const mockContent = JSON.stringify({
        key: 'test',
        systemKey: 'hubspot',
        entityKey: 'deal',
        fieldMappings: {}
      });
      const mockValidate = jest.fn().mockReturnValue(true);

      fsSync.existsSync.mockImplementation((filePath) => filePath === mockFilePath);
      fsSync.readFileSync.mockReturnValue(mockContent);
      loadExternalDataSourceSchema.mockReturnValue(mockValidate);

      const { validateDatasourceFile } = require('../../../lib/datasource/validate');
      const result = await validateDatasourceFile(mockFilePath);

      expect(result.warnings).toEqual([]);
    });

    describe('field reference validation (after schema passes)', () => {
      it('should return valid: false when indexing.embedding references missing field', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          systemKey: 'hubspot',
          entityKey: 'deal',
          fieldMappings: { attributes: { id: {}, name: {} } },
          indexing: { embedding: ['id', 'missingField'], uniqueKey: 'id' }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('indexing.embedding[1]') && e.includes('missingField') && e.includes('fieldMappings.attributes'))).toBe(true);
      });

      it('should return valid: false when indexing.uniqueKey not in fieldMappings.attributes', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          fieldMappings: { attributes: { id: {} } },
          indexing: { uniqueKey: 'unknownKey' }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('indexing.uniqueKey') && e.includes('unknownKey') && e.includes('fieldMappings.attributes'))).toBe(true);
      });

      it('should return valid: false when validation.repeatingValues[].field not in attributes', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          fieldMappings: { attributes: { id: {} } },
          validation: {
            repeatingValues: [{ field: 'badField', scope: [], strategy: 'first' }]
          }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) =>
          e.includes('validation.repeatingValues') && e.includes('badField')
        )).toBe(true);
      });

      it('should return valid: false when quality.rejectIf[].field not in attributes', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          fieldMappings: { attributes: { id: {} } },
          quality: { rejectIf: [{ field: 'badField', operator: 'empty' }] }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) =>
          e.includes('quality.rejectIf') && e.includes('badField')
        )).toBe(true);
      });

      it('should return valid: true when all field references exist in fieldMappings.attributes', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          fieldMappings: {
            attributes: { id: {}, name: {}, body: {} }
          },
          indexing: { embedding: ['name', 'body'], uniqueKey: 'id' },
          validation: {
            repeatingValues: [{ field: 'name', scope: [], strategy: 'first' }]
          },
          quality: { rejectIf: [{ field: 'id', operator: 'empty' }] }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should not add field-reference errors when fieldMappings.attributes is empty', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          fieldMappings: { attributes: {} },
          indexing: { embedding: ['x'], uniqueKey: 'y' }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should return only schema errors when schema validation fails (no field-reference check)', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          fieldMappings: { attributes: { id: {} } },
          indexing: { embedding: ['missingField'], uniqueKey: 'id' }
        });
        const mockValidate = jest.fn().mockReturnValue(false);
        mockValidate.errors = [{ message: 'Schema error' }];
        formatValidationErrors.mockReturnValue(['Schema error']);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(['Schema error']);
        expect(result.errors.some((e) => e.includes('missingField'))).toBe(false);
      });

      it('should return all field-reference errors when multiple references are invalid', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          fieldMappings: { attributes: { id: {} } },
          indexing: { embedding: ['id', 'bad1'], uniqueKey: 'badUnique' },
          quality: { rejectIf: [{ field: 'badReject', operator: 'empty' }] }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(3);
        expect(result.errors.some(e => e.includes('indexing.embedding[1]') && e.includes('bad1'))).toBe(true);
        expect(result.errors.some(e => e.includes('indexing.uniqueKey') && e.includes('badUnique'))).toBe(true);
        expect(result.errors.some(e => e.includes('quality.rejectIf[0].field') && e.includes('badReject'))).toBe(true);
      });

      it('should return valid: false with ABAC error when config.abac.crossSystemJson has two operators per path', async() => {
        const mockFilePath = '/path/to/datasource.json';
        const mockContent = JSON.stringify({
          key: 'test',
          systemKey: 'hubspot',
          fieldMappings: { attributes: { id: {} }, dimensions: {} },
          primaryKey: ['id'],
          config: {
            abac: {
              crossSystemJson: {
                'ds.field': { eq: 'user.country', ne: 'other' }
              }
            }
          }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        fsSync.existsSync.mockImplementation((p) => p === mockFilePath);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile(mockFilePath);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('crossSystemJson') && e.includes('exactly one operator'))).toBe(true);
      });
    });

    describe('datasource key resolution under integration/<app>/', () => {
      it('should resolve key to file and validate', async() => {
        const intDir = '/mock/integration/acme';
        const jsonPath = `${intDir}/acme-datasource-users.json`;
        const mockContent = JSON.stringify({
          key: 'acme-users',
          systemKey: 'acme',
          fieldMappings: { attributes: { id: {} } }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        paths.listIntegrationAppNames.mockReturnValue(['acme']);
        paths.getIntegrationPath.mockImplementation((app) => `/mock/integration/${app}`);
        fsSync.existsSync.mockImplementation((p) => p === intDir);
        fsSync.statSync.mockImplementation((p) => {
          if (p === intDir) {
            return { isFile: () => false, isDirectory: () => true };
          }
          return { isFile: () => true, isDirectory: () => false };
        });
        fsSync.readdirSync.mockReturnValue(['acme-datasource-users.json']);
        fsSync.readFileSync.mockImplementation((p) => (p === jsonPath ? mockContent : ''));
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile('acme-users');

        expect(result.valid).toBe(true);
        expect(result.resolvedPath).toBe(jsonPath);
        expect(mockValidate).toHaveBeenCalled();
      });

      it('should prefer longest integration app prefix for key', async() => {
        const intDir = '/mock/integration/acme-long';
        const jsonPath = `${intDir}/f.json`;
        const mockContent = JSON.stringify({
          key: 'acme-long-users',
          systemKey: 'acme-long',
          fieldMappings: { attributes: { id: {} } }
        });
        const mockValidate = jest.fn().mockReturnValue(true);

        paths.listIntegrationAppNames.mockReturnValue(['acme', 'acme-long']);
        fsSync.existsSync.mockImplementation((p) => p === intDir);
        fsSync.statSync.mockImplementation((p) => {
          if (p === intDir) {
            return { isFile: () => false, isDirectory: () => true };
          }
          return { isFile: () => true, isDirectory: () => false };
        });
        fsSync.readdirSync.mockReturnValue(['f.json']);
        fsSync.readFileSync.mockReturnValue(mockContent);
        loadExternalDataSourceSchema.mockReturnValue(mockValidate);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        const result = await validateDatasourceFile('acme-long-users');

        expect(result.valid).toBe(true);
        expect(result.resolvedPath).toBe(jsonPath);
      });

      it('should throw when no integration app matches key', async() => {
        fsSync.existsSync.mockReturnValue(false);
        paths.listIntegrationAppNames.mockReturnValue(['other']);

        const { validateDatasourceFile } = require('../../../lib/datasource/validate');
        await expect(validateDatasourceFile('acme-users')).rejects.toThrow(/No integration/);
      });
    });
  });
});

