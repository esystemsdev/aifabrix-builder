/**
 * Tests for external-datasource schema (v2.4+ required fields and expression shape).
 * Uses real schema to ensure invalid configs fail and minimal valid configs pass.
 *
 * @fileoverview External datasource schema validation tests
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const Ajv = require('ajv');
const externalDatasourceSchema = require('../../../lib/schema/external-datasource.schema.json');

/** Minimal metadata + fieldMappings for recordStorage (non-none allOf) */
function minimalRecordStorage(overrides = {}) {
  return {
    key: 'hubspot-contacts',
    displayName: 'HubSpot Contacts',
    systemKey: 'hubspot',
    entityType: 'recordStorage',
    resourceType: 'contact',
    primaryKey: ['id'],
    labelKey: ['id'],
    metadataSchema: {
      type: 'object',
      required: ['id', 'externalId'],
      properties: {
        id: { type: 'string', index: true },
        externalId: { type: 'string', index: true }
      }
    },
    fieldMappings: {
      attributes: {
        id: { expression: '{{raw.id}}' },
        externalId: { expression: '{{raw.id}}' }
      }
    },
    ...overrides
  };
}

describe('External datasource schema – v2.4', () => {
  let validate;

  beforeAll(() => {
    const schemaToCompile = { ...externalDatasourceSchema };
    if (schemaToCompile.$schema && schemaToCompile.$schema.includes('2020-12')) {
      delete schemaToCompile.$schema;
    }
    const ajv = new Ajv({ allErrors: true, strict: false, strictSchema: false });
    ajv.addSchema(require('../../../lib/schema/type/document-storage.json'));
    ajv.addSchema(require('../../../lib/schema/type/message-service.json'));
    ajv.addSchema(require('../../../lib/schema/type/vector-store.json'));
    validate = ajv.compile(schemaToCompile);
  });

  it('should fail validation when primaryKey is missing (non-none)', () => {
    const config = {
      key: 'hubspot-contacts',
      displayName: 'HubSpot Contacts',
      systemKey: 'hubspot',
      entityType: 'recordStorage',
      resourceType: 'contact',
      labelKey: ['id'],
      metadataSchema: {
        type: 'object',
        required: ['id', 'externalId'],
        properties: {
          id: { type: 'string', index: true },
          externalId: { type: 'string', index: true }
        }
      },
      fieldMappings: {
        attributes: {
          id: { expression: '{{raw.id}}' },
          externalId: { expression: '{{raw.id}}' }
        }
      }
    };
    const valid = validate(config);
    expect(valid).toBe(false);
    const errors = validate.errors || [];
    expect(errors.some(e => e.params?.missingProperty === 'primaryKey' || (e.message && e.message.includes('primaryKey')))).toBe(true);
  });

  it('should pass validation when primaryKey, labelKey, metadataSchema, and raw.* expressions are valid', () => {
    const config = minimalRecordStorage();
    const valid = validate(config);
    expect(valid).toBe(true);
  });

  it('should pass validation with primaryKey externalId and matching metadata', () => {
    const config = minimalRecordStorage({
      key: 'hubspot-deals',
      displayName: 'HubSpot Deals',
      resourceType: 'deal',
      primaryKey: ['externalId'],
      labelKey: ['externalId'],
      metadataSchema: {
        type: 'object',
        required: ['externalId'],
        properties: {
          externalId: { type: 'string', index: true }
        }
      },
      fieldMappings: {
        attributes: {
          externalId: { expression: '{{raw.properties.hs_object_id}}' }
        }
      }
    });
    const valid = validate(config);
    expect(valid).toBe(true);
  });

  it('should fail when fieldMappings.dimensions is not an object', () => {
    const config = minimalRecordStorage({
      fieldMappings: {
        dimensions: [],
        attributes: {
          id: { expression: '{{raw.id}}' },
          externalId: { expression: '{{raw.id}}' }
        }
      }
    });
    expect(validate(config)).toBe(false);
  });
});
