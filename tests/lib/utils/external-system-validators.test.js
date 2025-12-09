/**
 * Tests for External System Validators
 *
 * @fileoverview Unit tests for external-system-validators.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  validateFieldMappingExpression,
  validateFieldMappings,
  validateMetadataSchema,
  validateAgainstSchema
} = require('../../../lib/utils/external-system-validators');

describe('External System Validators', () => {
  describe('validateFieldMappingExpression', () => {
    it('should validate correct field mapping expression', () => {
      const result = validateFieldMappingExpression('{{properties.country.value}} | toUpper | trim');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject expression without path', () => {
      const result = validateFieldMappingExpression('toUpper | trim');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid expression format');
    });

    it('should reject invalid transformation', () => {
      const result = validateFieldMappingExpression('{{path}} | invalidTransformation');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown transformation');
    });

    it('should reject empty expression', () => {
      const result = validateFieldMappingExpression('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });
  });

  describe('validateFieldMappings', () => {
    const mockDatasource = {
      fieldMappings: {
        accessFields: ['country'],
        fields: {
          country: {
            expression: '{{properties.country.value}} | toUpper | trim',
            type: 'string'
          },
          name: {
            expression: '{{properties.name.value}} | trim',
            type: 'string'
          }
        }
      }
    };

    const mockTestPayload = {
      payloadTemplate: {
        properties: {
          country: {
            value: 'United States'
          },
          name: {
            value: 'Test Company'
          }
        }
      }
    };

    it('should validate field mappings successfully', () => {
      const result = validateFieldMappings(mockDatasource, mockTestPayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(Object.keys(result.mappedFields)).toHaveLength(2);
    });

    it('should detect missing expression', () => {
      const invalidDatasource = {
        ...mockDatasource,
        fieldMappings: {
          fields: {
            country: {
              type: 'string'
              // Missing expression
            }
          }
        }
      };
      const result = validateFieldMappings(invalidDatasource, mockTestPayload);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about missing path in payload', () => {
      const datasourceWithMissingPath = {
        ...mockDatasource,
        fieldMappings: {
          fields: {
            missing: {
              expression: '{{properties.missing.field}} | trim',
              type: 'string'
            }
          }
        }
      };
      const result = validateFieldMappings(datasourceWithMissingPath, mockTestPayload);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateMetadataSchema', () => {
    const mockDatasource = {
      metadataSchema: {
        type: 'object',
        properties: {
          properties: {
            type: 'object',
            properties: {
              country: {
                type: 'object',
                properties: {
                  value: { type: 'string' }
                }
              }
            }
          }
        }
      }
    };

    const mockTestPayload = {
      payloadTemplate: {
        properties: {
          country: {
            value: 'United States'
          }
        }
      }
    };

    it('should validate metadata schema successfully', () => {
      const result = validateMetadataSchema(mockDatasource, mockTestPayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn when metadata schema is missing', () => {
      const datasourceWithoutSchema = {
        ...mockDatasource,
        metadataSchema: undefined
      };
      const result = validateMetadataSchema(datasourceWithoutSchema, mockTestPayload);
      expect(result.warnings).toContain('No metadata schema defined');
    });
  });

  describe('validateAgainstSchema', () => {
    const mockSchema = {
      type: 'object',
      properties: {
        key: { type: 'string' },
        displayName: { type: 'string' }
      },
      required: ['key', 'displayName']
    };

    it('should validate data against schema successfully', () => {
      const data = {
        key: 'test',
        displayName: 'Test'
      };
      const result = validateAgainstSchema(data, mockSchema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      const invalidData = {
        key: 'test'
        // Missing displayName
      };
      const result = validateAgainstSchema(invalidData, mockSchema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
