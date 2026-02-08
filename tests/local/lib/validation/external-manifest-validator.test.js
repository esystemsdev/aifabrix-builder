/**
 * Tests for External Manifest Validator Module
 *
 * @fileoverview Unit tests for external-manifest-validator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../../lib/utils/error-formatter', () => ({
  formatValidationErrors: jest.fn((errors) => errors.map(e => e.message || JSON.stringify(e)))
}));
jest.mock('../../../../lib/utils/schema-loader', () => ({
  loadExternalSystemSchema: jest.fn(),
  loadExternalDataSourceSchema: jest.fn()
}));

const { formatValidationErrors } = require('../../../../lib/utils/error-formatter');
const { loadExternalSystemSchema, loadExternalDataSourceSchema } = require('../../../../lib/utils/schema-loader');

describe('External Manifest Validator Module', () => {
  let mockSystemValidate;
  let mockDatasourceValidate;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock validators
    mockSystemValidate = jest.fn().mockReturnValue(true);
    mockDatasourceValidate = jest.fn().mockReturnValue(true);

    // Setup mock schemas
    const mockSystemSchema = {
      $id: 'https://raw.githubusercontent.com/esystemsdev/aifabrix-builder/refs/heads/main/lib/schema/external-system.schema.json',
      type: 'object',
      properties: {
        key: { type: 'string' },
        displayName: { type: 'string' }
      },
      required: ['key']
    };

    const mockDatasourceSchema = {
      $id: 'https://raw.githubusercontent.com/esystemsdev/aifabrix-builder/refs/heads/main/lib/schema/external-datasource.schema.json',
      type: 'object',
      properties: {
        key: { type: 'string' },
        systemKey: { type: 'string' }
      },
      required: ['key', 'systemKey']
    };

    loadExternalSystemSchema.mockResolvedValue(mockSystemSchema);
    loadExternalDataSourceSchema.mockResolvedValue(mockDatasourceSchema);
    formatValidationErrors.mockImplementation((errors) => errors.map(e => e.message || JSON.stringify(e)));
  });

  describe('validateControllerManifest', () => {
    it('should validate valid manifest successfully', async() => {
      const manifest = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test Description',
        type: 'external',
        deploymentKey: 'test-deployment-key-12345',
        system: {
          key: 'test-system',
          displayName: 'Test System',
          type: 'openapi',
          authentication: {
            type: 'apikey',
            apiKey: 'test-key'
          }
        },
        dataSources: [
          {
            key: 'test-datasource',
            systemKey: 'test-system',
            entityKey: 'entity1',
            displayName: 'Test Datasource'
          }
        ]
      };

      // Mock validators to return true
      const Ajv = require('ajv');
      const ajv = new Ajv({ allErrors: true, strict: false });
      const systemSchema = await loadExternalSystemSchema();
      const datasourceSchema = await loadExternalDataSourceSchema();
      ajv.addSchema(systemSchema, systemSchema.$id);
      ajv.addSchema(datasourceSchema, datasourceSchema.$id);

      // Mock formatValidationErrors to return empty for valid cases
      formatValidationErrors.mockReturnValue([]);

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return error if manifest is null', async() => {
      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Manifest is required and must be an object');
    });

    it('should return error if manifest is not an object', async() => {
      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest('not-an-object');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Manifest is required and must be an object');
    });

    it('should validate required fields', async() => {
      const manifest = {
        key: 'test-system',
        // Missing displayName, description, type
        system: { key: 'test-system' },
        dataSources: []
      };

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('displayName'))).toBe(true);
      expect(result.errors.some(e => e.includes('description'))).toBe(true);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('should validate system against external-system schema', async() => {
      const manifest = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test Description',
        type: 'external',
        deploymentKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        system: {
          // Missing required 'key', 'description', 'type', and 'authentication' fields
          displayName: 'Test System'
        },
        dataSources: []
      };

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      // Should have system validation errors
      expect(result.errors.some(e => e.includes('System validation'))).toBe(true);
    });

    it('should validate datasources against external-datasource schema', async() => {
      const manifest = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test Description',
        type: 'external',
        deploymentKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        system: {
          key: 'test-system',
          displayName: 'Test System',
          description: 'Test Description',
          type: 'openapi',
          authentication: {
            type: 'apikey',
            apiKey: 'test-key'
          }
        },
        dataSources: [
          {
            key: 'test-datasource',
            // Missing required 'systemKey', 'displayName', 'entityType', and 'resourceType' fields
            entityKey: 'entity1'
          }
        ]
      };

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      // Should have datasource validation errors
      expect(result.errors.some(e => e.includes('Datasource'))).toBe(true);
    });

    it('should validate multiple datasources', async() => {
      const manifest = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test Description',
        type: 'external',
        deploymentKey: 'test-deployment-key-12345',
        system: {
          key: 'test-system',
          displayName: 'Test System',
          type: 'openapi'
        },
        dataSources: [
          {
            key: 'datasource1',
            systemKey: 'test-system',
            entityKey: 'entity1',
            displayName: 'Datasource 1'
          },
          {
            key: 'datasource2',
            systemKey: 'test-system',
            entityKey: 'entity2',
            displayName: 'Datasource 2'
          }
        ]
      };

      formatValidationErrors.mockReturnValue([]);

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return error if system is missing for external type', async() => {
      const manifest = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test Description',
        type: 'external',
        deploymentKey: 'test-key',
        // Missing system
        dataSources: []
      };

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('System is required for external type'))).toBe(true);
    });

    it('should return warning if dataSources is empty for external type', async() => {
      const manifest = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test Description',
        type: 'external',
        deploymentKey: 'test-deployment-key-12345',
        system: {
          key: 'test-system',
          displayName: 'Test System',
          type: 'openapi'
        },
        dataSources: []
      };

      formatValidationErrors.mockReturnValue([]);

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('No dataSources specified'))).toBe(true);
    });

    it('should return error if dataSources is not an array', async() => {
      const manifest = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test Description',
        type: 'external',
        deploymentKey: 'test-key',
        system: {
          key: 'test-system'
        },
        dataSources: 'not-an-array'
      };

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('dataSources must be an array');
    });

    it('should validate manifest structure against application-schema.json', async() => {
      const manifest = {
        key: 'test-system',
        displayName: 'Test System',
        description: 'Test Description',
        type: 'external',
        deploymentKey: 'test-deployment-key-12345',
        system: {
          key: 'test-system',
          displayName: 'Test System',
          type: 'openapi'
        },
        dataSources: []
      };

      formatValidationErrors.mockReturnValue([]);

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      // Should validate against application schema
      expect(result.valid).toBe(true);
    });

    it('should aggregate errors from manifest, system, and datasource validation', async() => {
      const manifest = {
        key: 'test-system',
        // Missing required fields
        type: 'external',
        system: {
          // Invalid system
          displayName: 'Test'
        },
        dataSources: [
          {
            // Invalid datasource
            key: 'test-datasource'
          }
        ]
      };

      formatValidationErrors
        .mockReturnValueOnce(['Manifest error 1'])
        .mockReturnValueOnce(['System error 1'])
        .mockReturnValueOnce(['Datasource error 1']);

      const { validateControllerManifest } = require('../../../../lib/validation/external-manifest-validator');
      const result = await validateControllerManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
