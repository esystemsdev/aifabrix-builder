/**
 * Tests for repair-datasource helpers
 *
 * @fileoverview Unit tests for lib/commands/repair-datasource.js
 * @author AI Fabrix Team
 * @version 2.2.0
 */

const {
  getAttributeKeys,
  parsePathsFromExpressions,
  repairDimensionBindingShape,
  repairRootDimensionsFromAttributes,
  repairMetadataSchemaFromAttributes,
  repairExposeFromAttributes,
  repairSyncSection,
  repairTestPayload,
  sanitizeTestPayloadTopLevel,
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
    it('extracts paths from {{ path }}, top-level keys, and referenced schema property names under metadata', () => {
      const attrs = {
        a: { expression: '{{ metadata.email }}', type: 'string' },
        b: { expression: '{{ properties.foo.value }}', type: 'string' }
      };
      const { paths, topLevelKeys, referencedSchemaPropertyNames } = parsePathsFromExpressions(attrs);
      expect(paths).toContain('metadata.email');
      expect(paths).toContain('properties.foo.value');
      expect(topLevelKeys).toEqual(new Set(['metadata', 'properties']));
      expect(referencedSchemaPropertyNames).toEqual(new Set(['email']));
    });
    it('strips raw. prefix for path analysis', () => {
      const attrs = {
        id: { expression: '{{ raw.properties.id }}', type: 'string' }
      };
      const { paths, topLevelKeys } = parsePathsFromExpressions(attrs);
      expect(paths).toContain('properties.id');
      expect(topLevelKeys).toEqual(new Set(['properties']));
    });
    it('skips record_ref expressions', () => {
      const attrs = {
        ref: { expression: 'record_ref:customer', type: 'string' }
      };
      const { paths, topLevelKeys, referencedSchemaPropertyNames } = parsePathsFromExpressions(attrs);
      expect(paths).toHaveLength(0);
      expect(topLevelKeys.size).toBe(0);
      expect(referencedSchemaPropertyNames.size).toBe(0);
    });
  });

  describe('repairDimensionBindingShape', () => {
    it('removes field from FK binding and operator without actor', () => {
      const changes = [];
      const parsed = {
        dimensions: {
          d1: { type: 'fk', field: 'x', via: [{ fk: 'c', dimension: 'country' }], operator: 'eq' }
        }
      };
      expect(repairDimensionBindingShape(parsed, changes)).toBe(true);
      expect(parsed.dimensions.d1.field).toBeUndefined();
      expect(parsed.dimensions.d1.operator).toBeUndefined();
      expect(parsed.dimensions.d1.via).toBeDefined();
    });
    it('removes via from local binding', () => {
      const changes = [];
      const parsed = {
        dimensions: {
          d1: { type: 'local', field: 'country', via: [] }
        }
      };
      expect(repairDimensionBindingShape(parsed, changes)).toBe(true);
      expect(parsed.dimensions.d1.via).toBeUndefined();
    });
  });

  describe('repairRootDimensionsFromAttributes', () => {
    it('removes local bindings whose field is not in attributes; keeps FK bindings', () => {
      const changes = [];
      const parsed = {
        fieldMappings: {
          attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } }
        },
        dimensions: {
          email: { type: 'local', field: 'email' },
          country: { type: 'local', field: 'country' },
          viaDim: { type: 'fk', via: [{ fk: 'company', dimension: 'country' }] }
        }
      };
      const updated = repairRootDimensionsFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.dimensions.email).toBeDefined();
      expect(parsed.dimensions.country).toBeUndefined();
      expect(parsed.dimensions.viaDim).toBeDefined();
    });
  });

  describe('repairMetadataSchemaFromAttributes', () => {
    it('does not add metadataSchema when entityType is none', () => {
      const changes = [];
      const parsed = { entityType: 'none', fieldMappings: { attributes: {} } };
      expect(repairMetadataSchemaFromAttributes(parsed, changes)).toBe(false);
      expect(parsed.metadataSchema).toBeUndefined();
    });
    it('adds minimal metadataSchema when missing for storage entity', () => {
      const changes = [];
      const parsed = { entityType: 'recordStorage', fieldMappings: { attributes: {} } };
      const updated = repairMetadataSchemaFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.metadataSchema).toMatchObject({ type: 'object' });
      expect(parsed.metadataSchema.properties.externalId).toMatchObject({ type: 'string', index: true });
      expect(changes.some(c => c.includes('Added minimal metadataSchema'))).toBe(true);
    });
    it('prunes schema properties not referenced by metadata.xxx expressions', () => {
      const changes = [];
      const parsed = {
        entityType: 'recordStorage',
        fieldMappings: {
          attributes: {
            email: { expression: '{{ metadata.email }}', type: 'string' },
            id: { expression: '{{ metadata.id }}', type: 'string' }
          }
        },
        metadataSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            email: { type: 'string' },
            results: { type: 'array' },
            notReferenced: { type: 'string' }
          },
          required: ['id']
        }
      };
      const updated = repairMetadataSchemaFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.metadataSchema.properties).toHaveProperty('id');
      expect(parsed.metadataSchema.properties).toHaveProperty('email');
      expect(parsed.metadataSchema.properties).toHaveProperty('externalId');
      expect(parsed.metadataSchema.properties.externalId).toMatchObject({ type: 'string', index: true });
      expect(parsed.metadataSchema.properties).not.toHaveProperty('notReferenced');
      expect(parsed.metadataSchema.properties).not.toHaveProperty('type');
      expect(parsed.metadataSchema.properties).not.toHaveProperty('results');
    });
    it('does not prune when no metadata.xxx paths exist (preserves full schema)', () => {
      const changes = [];
      const parsed = {
        entityType: 'recordStorage',
        fieldMappings: { attributes: {} },
        metadataSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' }
          }
        }
      };
      const updated = repairMetadataSchemaFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.metadataSchema.properties).toHaveProperty('id');
      expect(parsed.metadataSchema.properties).toHaveProperty('type');
      expect(parsed.metadataSchema.properties.externalId).toMatchObject({ type: 'string', index: true });
      expect(changes.some(c => c.includes('externalId'))).toBe(true);
    });
    it('adds property stubs for referenced metadata paths', () => {
      const changes = [];
      const parsed = {
        entityType: 'recordStorage',
        fieldMappings: {
          attributes: {
            email: { expression: '{{ metadata.email }}', type: 'string' }
          }
        },
        metadataSchema: {
          type: 'object',
          properties: {},
          additionalProperties: true
        }
      };
      const updated = repairMetadataSchemaFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.metadataSchema.properties.email).toEqual({ type: 'string' });
      expect(parsed.metadataSchema.properties.externalId).toMatchObject({ type: 'string', index: true });
    });
  });

  describe('repairExposeFromAttributes', () => {
    it('sets exposed.schema to metadata.* leaves for sorted attribute keys', () => {
      const changes = [];
      const parsed = {
        fieldMappings: {
          attributes: {
            z: { expression: '{{ raw.x }}', type: 'string' },
            a: { expression: '{{ raw.y }}', type: 'string' }
          }
        }
      };
      const updated = repairExposeFromAttributes(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.exposed.schema).toEqual({ a: 'metadata.a', z: 'metadata.z' });
    });
    it('does not update when already same', () => {
      const changes = [];
      const parsed = {
        fieldMappings: { attributes: { a: {}, b: {} } },
        exposed: { schema: { a: 'metadata.a', b: 'metadata.b' } }
      };
      const updated = repairExposeFromAttributes(parsed, changes);
      expect(updated).toBe(false);
    });
  });

  describe('repairSyncSection', () => {
    it('adds default sync when missing', () => {
      const changes = [];
      const parsed = { entityType: 'recordStorage' };
      const updated = repairSyncSection(parsed, changes);
      expect(updated).toBe(true);
      expect(parsed.sync).toEqual(DEFAULT_SYNC);
    });
    it('does not add sync for entityType none', () => {
      const changes = [];
      const parsed = { entityType: 'none' };
      expect(repairSyncSection(parsed, changes)).toBe(false);
      expect(parsed.sync).toBeUndefined();
    });
    it('does not overwrite existing sync', () => {
      const changes = [];
      const parsed = { entityType: 'recordStorage', sync: { mode: 'pull', batchSize: 100 } };
      const updated = repairSyncSection(parsed, changes);
      expect(updated).toBe(false);
      expect(parsed.sync.batchSize).toBe(100);
    });
  });

  describe('sanitizeTestPayloadTopLevel', () => {
    it('removes keys not in allowlist', () => {
      const changes = [];
      const parsed = {
        testPayload: {
          payloadTemplate: {},
          expectedResult: {},
          typoKey: 1,
          scenarios: []
        }
      };
      expect(sanitizeTestPayloadTopLevel(parsed, changes)).toBe(true);
      expect(parsed.testPayload.typoKey).toBeUndefined();
      expect(parsed.testPayload.scenarios).toEqual([]);
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
    it('runs root dimensions + metadataSchema for storage entity without flags', () => {
      const parsed = {
        entityType: 'recordStorage',
        fieldMappings: {
          attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } }
        },
        dimensions: {
          email: { type: 'local', field: 'email' },
          country: { type: 'local', field: 'country' }
        }
      };
      const { updated, changes } = repairDatasourceFile(parsed, {});
      expect(updated).toBe(true);
      expect(parsed.dimensions.country).toBeUndefined();
      expect(parsed.metadataSchema).toBeDefined();
      expect(parsed.metadataSchema.type).toBe('object');
      expect(parsed.exposed).toBeUndefined();
      expect(parsed.sync).toBeUndefined();
      expect(parsed.testPayload).toBeUndefined();
      expect(changes.some(c => c.includes('Removed root dimension'))).toBe(true);
    });
    it('skips metadata and sync for entityType none', () => {
      const parsed = { entityType: 'none', fieldMappings: { attributes: {} } };
      const { updated } = repairDatasourceFile(parsed, {});
      expect(updated).toBe(false);
      expect(parsed.metadataSchema).toBeUndefined();
    });
    it('applies --expose when options.expose is true', () => {
      const parsed = {
        entityType: 'recordStorage',
        fieldMappings: { attributes: { a: { expression: '{{ raw.x }}', type: 'string' } } }
      };
      repairDatasourceFile(parsed, { expose: true });
      expect(parsed.exposed.schema).toEqual({ a: 'metadata.a' });
    });
    it('applies --sync when options.sync is true', () => {
      const parsed = { entityType: 'recordStorage', fieldMappings: { attributes: { a: {} } } };
      repairDatasourceFile(parsed, { sync: true });
      expect(parsed.sync).toEqual(DEFAULT_SYNC);
    });
    it('does not apply --sync for none', () => {
      const parsed = { entityType: 'none' };
      repairDatasourceFile(parsed, { sync: true });
      expect(parsed.sync).toBeUndefined();
    });
    it('applies --test when options.test is true', () => {
      const parsed = {
        entityType: 'recordStorage',
        fieldMappings: {
          attributes: { email: { expression: '{{ metadata.email }}', type: 'string' } }
        },
        testPayload: { junkTop: true }
      };
      repairDatasourceFile(parsed, { test: true });
      expect(parsed.testPayload.payloadTemplate).toBeDefined();
      expect(parsed.testPayload.expectedResult).toBeDefined();
      expect(parsed.testPayload.junkTop).toBeUndefined();
    });
  });
});
