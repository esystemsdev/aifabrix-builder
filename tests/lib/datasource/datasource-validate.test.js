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

const fsSync = require('fs');
const { loadExternalDataSourceSchema } = require('../../../lib/utils/schema-loader');
const { formatValidationErrors } = require('../../../lib/utils/error-formatter');

describe('Datasource Validation Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        expect(result.errors).toContain(
          'indexing.embedding[1]: field \'missingField\' does not exist in fieldMappings.attributes'
        );
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
        expect(result.errors).toContain(
          'indexing.uniqueKey: field \'unknownKey\' does not exist in fieldMappings.attributes'
        );
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
        expect(result.errors).toContain(
          'indexing.embedding[1]: field \'bad1\' does not exist in fieldMappings.attributes'
        );
        expect(result.errors).toContain(
          'indexing.uniqueKey: field \'badUnique\' does not exist in fieldMappings.attributes'
        );
        expect(result.errors).toContain(
          'quality.rejectIf[0].field: field \'badReject\' does not exist in fieldMappings.attributes'
        );
      });
    });
  });
});

