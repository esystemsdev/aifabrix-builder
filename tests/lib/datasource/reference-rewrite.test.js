/**
 * @fileoverview Tests for capability reference rewriting
 */

const { rewriteCapabilityReferences } = require('../../../lib/datasource/capability/reference-rewrite');

describe('rewriteCapabilityReferences', () => {
  it('rewrites only known keys when value equals from', () => {
    const tree = {
      fetch: { openapiRef: 'create' },
      nested: { operation: 'create', keep: 'create' },
      list: ['create']
    };
    rewriteCapabilityReferences(tree, 'create', 'createbasic');
    expect(tree.fetch.openapiRef).toBe('createbasic');
    expect(tree.nested.operation).toBe('createbasic');
    expect(tree.nested.keep).toBe('create');
    expect(tree.list[0]).toBe('create');
  });

  it('does not rewrite unrelated strings', () => {
    const tree = { path: '/crm/create', openapiRef: 'get' };
    rewriteCapabilityReferences(tree, 'create', 'createbasic');
    expect(tree.path).toBe('/crm/create');
    expect(tree.openapiRef).toBe('get');
  });
});
