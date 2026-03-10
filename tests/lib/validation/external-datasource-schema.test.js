/**
 * Tests for external-datasource schema (primaryKey required).
 * Uses real schema to ensure configs without primaryKey fail and with valid primaryKey pass.
 * Loads schema via require() so tests pass in CI when fs is mocked by other test files in the same worker.
 *
 * @fileoverview External datasource schema validation tests
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const Ajv = require('ajv');
const externalDatasourceSchema = require('../../../lib/schema/external-datasource.schema.json');

describe('External datasource schema – primaryKey', () => {
  let validate;

  beforeAll(() => {
    const schemaToCompile = { ...externalDatasourceSchema };
    if (schemaToCompile.$schema && schemaToCompile.$schema.includes('2020-12')) {
      delete schemaToCompile.$schema;
    }
    const ajv = new Ajv({ allErrors: true, strict: false, strictSchema: false });
    validate = ajv.compile(schemaToCompile);
  });

  it('should fail validation when primaryKey is missing', () => {
    const config = {
      key: 'hubspot-contacts',
      displayName: 'HubSpot Contacts',
      systemKey: 'hubspot',
      entityType: 'recordStorage',
      resourceType: 'contact',
      fieldMappings: {
        dimensions: {},
        attributes: { id: { expression: '{{id}}', type: 'string' } }
      }
    };
    const valid = validate(config);
    expect(valid).toBe(false);
    const errors = validate.errors || [];
    expect(errors.some(e => e.params?.missingProperty === 'primaryKey' || (e.message && e.message.includes('primaryKey')))).toBe(true);
  });

  it('should pass validation when primaryKey is present and valid', () => {
    const config = {
      key: 'hubspot-contacts',
      displayName: 'HubSpot Contacts',
      systemKey: 'hubspot',
      entityType: 'recordStorage',
      resourceType: 'contact',
      primaryKey: ['id'],
      fieldMappings: {
        dimensions: {},
        attributes: { id: { expression: '{{id}}', type: 'string' } }
      }
    };
    const valid = validate(config);
    expect(valid).toBe(true);
  });

  it('should pass validation with primaryKey externalId', () => {
    const config = {
      key: 'hubspot-deals',
      displayName: 'HubSpot Deals',
      systemKey: 'hubspot',
      entityType: 'recordStorage',
      resourceType: 'deal',
      primaryKey: ['externalId'],
      fieldMappings: {
        dimensions: {},
        attributes: { externalId: { expression: '{{properties.hs_object_id}}', type: 'string' } }
      }
    };
    const valid = validate(config);
    expect(valid).toBe(true);
  });
});
