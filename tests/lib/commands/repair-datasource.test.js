/**
 * Tests for repair-datasource helpers
 *
 * @fileoverview Unit tests for lib/commands/repair-datasource.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  getAttributeKeys,
  parsePathsFromExpressions,
  repairDimensionsFromAttributes,
  repairMetadataSchemaFromAttributes,
  repairExposeFromAttributes,
  repairSyncSection,
  repairTestPayload,
  repairDatasourceFile,
  MINIMAL_METADATA_SCHEMA,
  DEFAULT_SYNC
} = require('../../../lib/commands/repair-datasource');

describe('repair-datasource', () => {
  describe('getAttributeKeys', () => {
    it('returns set of attribute keys from fieldMappings.attributes', () => {
      const parsed = {
        fieldMappings: {
          attributes: {
            email: { expression: '{{ metadata.email }}', type: 'string' },
            name: { expression: '{{ metadata.name }}', type: 'string' }
          }
        }
      };
      expect(getAttributeKeys(parsed)).toEqual(new Set(['email', 'name']));
    });
    it('returns empty set when attributes missing or empty', () => {
      expect(getAttributeKeys({})).toEqual(new Set());
      expect(getAttributeKeys({ fieldMappings: {} })).toEqual(new Set());
      expect(getAttributeKeys({ fieldMappings: { attributes: {} } })).toEqual(new Set());
    });
  });

  describe('parsePathsFromExpressions', () => {
    it('extracts paths from {{ path }} and top-level keys', () => {
      const attrs = {
        a: { expression: '{{ metadata.email }}', type: 'string' },
        b: { expression: '{{ properties.foo.value }}', type: 'string' }
      };
      const { paths, topLevelKeys } = parsePathsFromExpressions(attrs);
      expect(paths).toContain('metadata.email');
      expect(paths).toContain('properties.foo.value');
      expect(topLevelKeys).toEqual(new Set(['metadata', 'properties']));
    });
    it('skips record_ref expressions', () => {
      const attrs = {
        ref: { expression: 'record_ref:customer', type: 'string' }
      };
      const { paths, topLevelKeys } = parsePathsFromExpressions(attrs);
      expect(paths).toHaveLength(0);
      expect(topLevelKeys.size).toBe(0);
    });
  });

  describe('repairDimensionsFromAttributes', () => {
    it('removes dimension when metadata.attr not in attributes', () => {
      const changes = [];
      const parsed = {
        fieldMappings: {
          attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } },
          dimensions: {
            email: 'metadata.email',
            country: 'metadata.country'
          }
        }
      };
      const updated = repairDimensionsFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.fieldMappings.dimensions).toEqual({ email: 'metadata.email' });
      expect(changes.some(c => c.includes('country') && c.includes('not in'))).toBe(true);
    });
    it('leaves dimensions that reference existing attributes', () => {
      const changes = [];
      const parsed = {
        fieldMappings: {
          attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } },
          dimensions: { email: 'metadata.email' }
        }
      };
      const updated = repairDimensionsFromAttributes(parsed, changes);
      expect(updated).toBe(false);
      expect(parsed.fieldMappings.dimensions).toEqual({ email: 'metadata.email' });
    });
    it('ignores non-metadata dimension values', () => {
      const changes = [];
      const parsed = {
        fieldMappings: {
          attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } },
          dimensions: { other: 'other.path' }
        }
      };
      const updated = repairDimensionsFromAttributes(parsed, changes);
      expect(updated).toBe(false);
      expect(parsed.fieldMappings.dimensions.other).toBe('other.path');
    });
  });

  describe('repairMetadataSchemaFromAttributes', () => {
    it('adds minimal metadataSchema when missing', () => {
      const changes = [];
      const parsed = { fieldMappings: { attributes: {} } };
      const updated = repairMetadataSchemaFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.metadataSchema).toEqual(MINIMAL_METADATA_SCHEMA);
      expect(changes.some(c => c.includes('Added minimal metadataSchema'))).toBe(true);
    });
    it('prunes top-level properties not referenced by expressions', () => {
      const changes = [];
      const parsed = {
        fieldMappings: {
          attributes: {
            email: { expression: '{{ metadata.email }}', type: 'string' }
          }
        },
        metadataSchema: {
          type: 'object',
          properties: {
            metadata: { type: 'object' },
            unused: { type: 'string' }
          }
        }
      };
      const updated = repairMetadataSchemaFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.metadataSchema.properties).toHaveProperty('metadata');
      expect(parsed.metadataSchema.properties).not.toHaveProperty('unused');
    });
  });

  describe('repairExposeFromAttributes', () => {
    it('sets exposed.attributes to sorted attribute keys', () => {
      const changes = [];
      const parsed = {
        fieldMappings: {
          attributes: {
            z: { expression: '{{ x }}', type: 'string' },
            a: { expression: '{{ y }}', type: 'string' }
          }
        }
      };
      const updated = repairExposeFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.exposed.attributes).toEqual(['a', 'z']);
    });
    it('does not update when already same', () => {
      const changes = [];
      const parsed = {
        fieldMappings: { attributes: { a: {}, b: {} } },
        exposed: { attributes: ['a', 'b'] }
      };
      const updated = repairExposeFromAttributes(parsed, changes);
      expect(updated).toBe(false);
    });
  });

  describe('repairSyncSection', () => {
    it('adds default sync when missing', () => {
      const changes = [];
      const parsed = {};
      const updated = repairSyncSection(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.sync).toEqual(DEFAULT_SYNC);
    });
    it('does not overwrite existing sync', () => {
      const changes = [];
      const parsed = { sync: { mode: 'pull', batchSize: 100 } };
      const updated = repairSyncSection(parsed, changes);
      expect(updated).toBe(false);
      expect(parsed.sync.batchSize).toBe(100);
    });
  });

  describe('repairTestPayload', () => {
    it('generates payloadTemplate and expectedResult from attributes', () => {
      const changes = [];
      const parsed = {
        fieldMappings: {
          attributes: {
            email: { expression: '{{ metadata.email }}', type: 'string' },
            count: { expression: '{{ metadata.count }}', type: 'number' }
          }
        }
      };
      const updated = repairTestPayload(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.testPayload.payloadTemplate).toBeDefined();
      expect(parsed.testPayload.expectedResult).toEqual({ email: '', count: 0 });
      expect(changes.some(c => c.includes('testPayload'))).toBe(true);
    });
  });

  describe('repairDatasourceFile', () => {
    it('runs core repair (dimensions + metadataSchema) only when no flags', () => {
      const parsed = {
        fieldMappings: {
          attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } },
          dimensions: { country: 'metadata.country' }
        }
      };
      const { updated, changes } = repairDatasourceFile(parsed, {});
      expect(updated).toBe(true);
      expect(parsed.fieldMappings.dimensions).not.toHaveProperty('country');
      expect(parsed.metadataSchema).toBeDefined();
      expect(parsed.exposed).toBeUndefined();
      expect(parsed.sync).toBeUndefined();
      expect(parsed.testPayload).toBeUndefined();
    });
    it('applies --expose when options.expose is true', () => {
      const parsed = {
        fieldMappings: { attributes: { a: { expression: '{{ x }}', type: 'string' } } }
      };
      repairDatasourceFile(parsed, { expose: true });
      expect(parsed.exposed.attributes).toEqual(['a']);
    });
    it('applies --sync when options.sync is true', () => {
      const parsed = { fieldMappings: { attributes: { a: {} } } };
      repairDatasourceFile(parsed, { sync: true });
      expect(parsed.sync).toEqual(DEFAULT_SYNC);
    });
    it('applies --test when options.test is true', () => {
      const parsed = {
        fieldMappings: {
          attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } }
        }
      };
      repairDatasourceFile(parsed, { test: true });
      expect(parsed.testPayload.payloadTemplate).toBeDefined();
      expect(parsed.testPayload.expectedResult).toBeDefined();
    });
  });
});
