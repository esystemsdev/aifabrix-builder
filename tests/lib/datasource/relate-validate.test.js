const { validateRelateSemantics } = require('../../../lib/datasource/capability/relate-validate');

function doc({ attrs, meta }) {
  return {
    key: 'x',
    systemKey: 'sys',
    entityType: 'recordStorage',
    resourceType: 'x',
    fieldMappings: { attributes: attrs || {} },
    metadataSchema: { type: 'object', properties: meta || {} }
  };
}

describe('relate-validate (semantic)', () => {
  it('passes when source+target fields exist and types match', () => {
    const source = doc({
      attrs: { companyId: { expression: '{{raw.companyId}}' } },
      meta: { companyId: { type: 'string', nullable: false } }
    });
    const target = doc({
      attrs: { externalId: { expression: '{{raw.id}}' } },
      meta: { externalId: { type: 'string', nullable: false } }
    });
    const out = validateRelateSemantics({
      localContext: {
        sourceDoc: source,
        targetDocLocal: target,
        targetDatasourceKey: 'companies',
        fields: ['companyId'],
        targetFields: ['externalId']
      },
      remoteManifest: null
    });
    expect(out.ok).toBe(true);
    expect(out.errors).toEqual([]);
  });

  it('fails when source field missing', () => {
    const source = doc({
      attrs: {},
      meta: {}
    });
    const target = doc({
      attrs: { externalId: { expression: '{{raw.id}}' } },
      meta: { externalId: { type: 'string' } }
    });
    const out = validateRelateSemantics({
      localContext: {
        sourceDoc: source,
        targetDocLocal: target,
        targetDatasourceKey: 'companies',
        fields: ['companyId'],
        targetFields: ['externalId']
      },
      remoteManifest: null
    });
    expect(out.ok).toBe(false);
    expect(out.errors.join('\n')).toMatch(/Source field not found/);
  });

  it('warns on nullable mismatch and errors on type mismatch', () => {
    const source = doc({
      attrs: { companyId: { expression: '{{raw.companyId}}' } },
      meta: { companyId: { type: 'string', nullable: true } }
    });
    const target = doc({
      attrs: { externalId: { expression: '{{raw.id}}' } },
      meta: { externalId: { type: 'number', nullable: false } }
    });
    const out = validateRelateSemantics({
      localContext: {
        sourceDoc: source,
        targetDocLocal: target,
        targetDatasourceKey: 'companies',
        fields: ['companyId'],
        targetFields: ['externalId']
      },
      remoteManifest: null
    });
    expect(out.ok).toBe(false);
    expect(out.errors.join('\n')).toMatch(/Type mismatch/);
    expect(out.warnings.join('\n')).toMatch(/Nullable mismatch/);
  });
});

