const { applyCapabilityDimension } = require('../../../lib/datasource/capability/dimension-operations');

describe('applyCapabilityDimension', () => {
  function baseDoc() {
    return {
      key: 'test',
      displayName: 'Test',
      systemKey: 'sys',
      entityType: 'recordStorage',
      resourceType: 'customer',
      primaryKey: ['id'],
      labelKey: ['name'],
      metadataSchema: {
        type: 'object',
        properties: {
          externalId: { type: 'string', index: true },
          id: { type: 'string', index: true },
          name: { type: 'string', index: true },
          country: { type: 'string', index: true }
        }
      },
      fieldMappings: {
        attributes: {
          id: { expression: '{{raw.id}}' },
          name: { expression: '{{raw.name}}' },
          country: { expression: '{{raw.country}}' }
        }
      },
      openapi: { operations: {} },
      execution: { engine: 'cip', cip: { version: '1.0', operations: {} } },
      capabilities: []
    };
  }

  it('adds local binding and returns JSON Patch add', () => {
    const r = applyCapabilityDimension(baseDoc(), {
      dimension: 'market',
      type: 'local',
      field: 'country'
    });
    expect(r.replaced).toBe(false);
    expect(r.doc.dimensions.market).toEqual({ type: 'local', field: 'country' });
    expect(r.patchOperations).toEqual([
      { op: 'add', path: '/dimensions/market', value: { type: 'local', field: 'country' } }
    ]);
  });

  it('throws on overwrite when binding exists and overwrite=false', () => {
    const doc = baseDoc();
    doc.dimensions = { market: { type: 'local', field: 'country' } };
    expect(() =>
      applyCapabilityDimension(doc, {
        dimension: 'market',
        type: 'local',
        field: 'country'
      })
    ).toThrow(/overwrite/);
  });

  it('replaces existing binding when overwrite=true', () => {
    const doc = baseDoc();
    doc.dimensions = { market: { type: 'local', field: 'country' } };
    const r = applyCapabilityDimension(doc, {
      dimension: 'market',
      type: 'local',
      field: 'country',
      overwrite: true
    });
    expect(r.replaced).toBe(true);
    expect(r.patchOperations[0].op).toBe('replace');
    expect(r.patchOperations[0].path).toBe('/dimensions/market');
  });
});

