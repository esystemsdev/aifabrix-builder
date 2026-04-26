/**
 * @fileoverview Tests for datasource-validate-summary
 */

const {
  buildDatasourceValidateSummary,
  countMetadataSchemaProperties
} = require('../../../lib/datasource/datasource-validate-summary');

describe('datasource-validate-summary', () => {
  it('countMetadataSchemaProperties counts nested properties', () => {
    const n = countMetadataSchemaProperties({
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: {
          type: 'object',
          properties: { c: { type: 'number' } }
        }
      }
    });
    expect(n).toBe(3);
  });

  it('buildDatasourceValidateSummary extracts keys and dimensions', () => {
    const s = buildDatasourceValidateSummary({
      key: 'k1',
      resourceType: 'customer',
      entityType: 'recordStorage',
      metadataSchema: { type: 'object', properties: { x: { type: 'string' } } },
      fieldMappings: { attributes: { a: {}, b: {} } },
      primaryKey: ['id'],
      labelKey: ['name'],
      foreignKeys: [{ name: 'fk1', fields: ['ownerId'], targetDatasource: 'users' }],
      dimensions: {
        market: { type: 'local', field: 'country' },
        owner: { type: 'fk', actor: 'email', via: [{ fk: 'hubspotOwner', dimension: 'owner' }] }
      },
      exposed: { profiles: { default: [], minimal: [] } },
      openapi: { enabled: true, autoRbac: true, operations: { list: {}, get: {} } },
      sync: { mode: 'pull', batchSize: 50, schedule: '0 * * * *' },
      testPayload: { scenarios: [{}, {}] }
    });
    expect(s.key).toBe('k1');
    expect(s.fieldMappingAttributeCount).toBe(2);
    expect(s.metadataSchemaPropertyCount).toBe(1);
    expect(s.foreignKeys).toHaveLength(1);
    expect(s.foreignKeys[0].name).toBe('fk1');
    expect(s.dimensionKeys).toContain('market');
    expect(s.dimensionKeys).toContain('owner');
    expect(s.dimensions.owner).toContain('fk:');
    expect(s.exposedProfileNames).toEqual(['default', 'minimal']);
    expect(s.capabilityKeys).toEqual(['list', 'get']);
    expect(s.openapiLine).toBe('enabled, auto RBAC');
    expect(s.testPayloadLine).toBe('2 scenario(s)');
    expect(s.syncLine).toContain('pull');
    expect(s.syncLine).toContain('50');
  });
});
