const { applyCapabilityRelate } = require('../../../lib/datasource/capability/relate-operations');

function targetDoc() {
  return {
    key: 'target',
    primaryKey: ['id'],
    labelKey: ['firstName', 'lastName'],
    metadataSchema: {
      type: 'object',
      properties: {
        externalId: { type: 'string', description: 'join key' },
        id: { type: 'string', description: 'pk' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        ignored: { type: 'number' }
      },
      required: ['id']
    }
  };
}

describe('capability relate operations', () => {
  it('creates metadataSchema relation object with target primaryKey+labelKey+join fields', () => {
    const doc = { key: 'source', foreignKeys: [], metadataSchema: { type: 'object', properties: {} } };
    const out = applyCapabilityRelate(doc, {
      relationName: 'owner',
      targetDatasource: 'target-ds',
      fields: ['ownerId'],
      // join defaults to externalId if not set; resolvedTargetFields is provided by runner
      resolvedTargetFields: ['externalId'],
      targetDoc: targetDoc(),
      overwrite: false,
      addMetadataProperty: true
    });
    const rel = out.doc.metadataSchema.properties.owner;
    expect(rel).toBeDefined();
    expect(rel.type).toBe('object');
    expect(rel.nullable).toBe(true);
    expect(rel.properties.externalId).toBeDefined();
    expect(rel.properties.id).toBeDefined();
    expect(rel.properties.firstName).toBeDefined();
    expect(rel.properties.lastName).toBeDefined();
    expect(rel.properties.ignored).toBeUndefined();
    expect(rel.required).toEqual(['id']);
  });

  it('preserves existing description on overwrite', () => {
    const doc = {
      key: 'source',
      foreignKeys: [{ name: 'owner', fields: ['ownerId'], targetDatasource: 'target-ds' }],
      metadataSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'object',
            nullable: true,
            description: 'Do not clobber me',
            properties: { externalId: { type: 'string' } }
          }
        }
      }
    };
    const out = applyCapabilityRelate(doc, {
      relationName: 'owner',
      targetDatasource: 'target-ds',
      fields: ['ownerId'],
      resolvedTargetFields: ['externalId'],
      targetDoc: targetDoc(),
      overwrite: true,
      addMetadataProperty: true
    });
    expect(out.doc.metadataSchema.properties.owner.description).toBe('Do not clobber me');
  });
});

describe('relate-operations', () => {
  function docWithMeta() {
    return {
      key: 'deals',
      systemKey: 'sys',
      entityType: 'recordStorage',
      resourceType: 'deal',
      metadataSchema: {
        type: 'object',
        properties: {
          externalId: { type: 'string', index: true },
          companyId: { type: 'string', index: true }
        }
      },
      fieldMappings: {
        attributes: {
          externalId: { expression: '{{raw.id}}' },
          companyId: { expression: '{{raw.companyId}}' }
        }
      },
      sync: { mode: 'pull', schedule: '0 * * * *', batchSize: 10 },
      quality: {},
      context: {},
      validation: {}
    };
  }

  it('adds foreignKeys row and metadata property', () => {
    const d = docWithMeta();
    const out = applyCapabilityRelate(d, {
      relationName: 'company',
      targetDatasource: 'test-e2e-hubspot-companies',
      fields: ['companyId'],
      targetFields: ['externalId'],
      overwrite: false,
      addMetadataProperty: true
    });
    expect(out.doc.foreignKeys).toHaveLength(1);
    expect(out.doc.foreignKeys[0].name).toBe('company');
    expect(out.doc.foreignKeys[0].targetDatasource).toBe('test-e2e-hubspot-companies');
    expect(out.doc.foreignKeys[0].fields).toEqual(['companyId']);
    expect(out.doc.foreignKeys[0].targetFields).toEqual(['externalId']);
    expect(out.doc.metadataSchema.properties.company).toBeDefined();
  });

  it('creates metadataSchema/properties when missing (when addMetadataProperty=true)', () => {
    const d = docWithMeta();
    delete d.metadataSchema;
    const out = applyCapabilityRelate(d, {
      relationName: 'company',
      targetDatasource: 'test-e2e-hubspot-companies',
      fields: ['companyId'],
      overwrite: false,
      addMetadataProperty: true
    });
    expect(out.doc.metadataSchema).toBeDefined();
    expect(out.doc.metadataSchema.properties.company).toBeDefined();
  });

  it('does not add metadata property when addMetadataProperty=false', () => {
    const d = docWithMeta();
    const out = applyCapabilityRelate(d, {
      relationName: 'company',
      targetDatasource: 'test-e2e-hubspot-companies',
      fields: ['companyId'],
      overwrite: false,
      addMetadataProperty: false
    });
    expect(out.doc.metadataSchema?.properties?.company).toBeUndefined();
  });

  it('trims and validates relationName', () => {
    const d = docWithMeta();
    expect(() =>
      applyCapabilityRelate(d, {
        relationName: '  ',
        targetDatasource: 'test-e2e-hubspot-companies',
        fields: ['companyId'],
        overwrite: false
      })
    ).toThrow(/--relation-name is required/);

    expect(() =>
      applyCapabilityRelate(d, {
        relationName: 'Company',
        targetDatasource: 'test-e2e-hubspot-companies',
        fields: ['companyId'],
        overwrite: false
      })
    ).toThrow(/must match/);
  });

  it('trims and validates targetDatasource', () => {
    const d = docWithMeta();
    expect(() =>
      applyCapabilityRelate(d, {
        relationName: 'company',
        targetDatasource: '  ',
        fields: ['companyId'],
        overwrite: false
      })
    ).toThrow(/--to <targetDatasource> is required/);

    expect(() =>
      applyCapabilityRelate(d, {
        relationName: 'company',
        targetDatasource: 'Bad Key',
        fields: ['companyId'],
        overwrite: false
      })
    ).toThrow(/must match targetDatasource pattern/);
  });

  it('requires at least one --field entry', () => {
    const d = docWithMeta();
    expect(() =>
      applyCapabilityRelate(d, {
        relationName: 'company',
        targetDatasource: 'test-e2e-hubspot-companies',
        fields: [],
        overwrite: false
      })
    ).toThrow(/at least one --field/);
  });

  it('throws when FK name exists without overwrite', () => {
    const d = docWithMeta();
    d.foreignKeys = [
      {
        name: 'company',
        fields: ['companyId'],
        targetDatasource: 'other'
      }
    ];
    expect(() =>
      applyCapabilityRelate(d, {
        relationName: 'company',
        targetDatasource: 'test-e2e-hubspot-companies',
        fields: ['companyId'],
        overwrite: false
      })
    ).toThrow(/already exists/);
  });

  it('replaces FK when overwrite', () => {
    const d = docWithMeta();
    d.foreignKeys = [
      {
        name: 'company',
        fields: ['x'],
        targetDatasource: 'old'
      }
    ];
    const out = applyCapabilityRelate(d, {
      relationName: 'company',
      targetDatasource: 'new-key',
      fields: ['companyId'],
      overwrite: true
    });
    expect(out.doc.foreignKeys).toHaveLength(1);
    expect(out.doc.foreignKeys[0].targetDatasource).toBe('new-key');
  });
});
