const { validateDimensionSemantics } = require('../../../lib/datasource/capability/dimension-validate');

describe('validateDimensionSemantics', () => {
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
      foreignKeys: [{ name: 'hubspotOwner', fields: ['ownerId'], targetDatasource: 'users' }]
    };
  }

  it('fails for local when field missing from metadataSchema', () => {
    const r = validateDimensionSemantics({
      localContext: {
        sourceDoc: baseDoc(),
        dimensionKey: 'market',
        type: 'local',
        field: 'nope'
      },
      remoteTargetsByKey: null,
      catalogDimensionKeys: null
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/metadataSchema\.properties/);
  });

  it('fails for fk when via fk name missing', () => {
    const r = validateDimensionSemantics({
      localContext: {
        sourceDoc: baseDoc(),
        dimensionKey: 'owner',
        type: 'fk',
        via: [{ fk: 'missingFk', dimension: 'owner' }]
      },
      remoteTargetsByKey: null,
      catalogDimensionKeys: null
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/Foreign key not found/);
  });

  it('fails when catalog set provided and key absent', () => {
    const r = validateDimensionSemantics({
      localContext: {
        sourceDoc: baseDoc(),
        dimensionKey: 'market',
        type: 'local',
        field: 'country'
      },
      remoteTargetsByKey: null,
      catalogDimensionKeys: new Set(['owner'])
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/dimension catalog/);
  });

  it('validates fk hop against remote target dimensions when provided', () => {
    const r = validateDimensionSemantics({
      localContext: {
        sourceDoc: baseDoc(),
        dimensionKey: 'owner',
        type: 'fk',
        via: [{ fk: 'hubspotOwner', dimension: 'owner' }]
      },
      remoteTargetsByKey: {
        users: { key: 'users', dimensions: { owner: { type: 'local', field: 'email' } } }
      },
      catalogDimensionKeys: null
    });
    expect(r.ok).toBe(true);
  });
});

