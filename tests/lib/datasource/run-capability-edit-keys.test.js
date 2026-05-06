/**
 * @fileoverview collectCapabilityKeys helper tests (non-interactive)
 */

const {
  collectCapabilityKeys,
  resolveOpsKeyForEdit
} = require('../../../lib/datasource/capability/run-capability-edit');

describe('collectCapabilityKeys', () => {
  it('merges keys from capabilities, openapi, and cip', () => {
    const keys = collectCapabilityKeys({
      capabilities: ['z'],
      openapi: { operations: { a: {}, z: {} } },
      execution: { cip: { operations: { b: {} } } }
    });
    expect(keys).toEqual(['a', 'b', 'z']);
  });
});

describe('resolveOpsKeyForEdit', () => {
  const hubspotLike = () => ({
    capabilities: ['updateAddress'],
    openapi: {
      operations: {
        updateaddress: { method: 'PATCH', path: '/x' }
      }
    },
    execution: {
      cip: {
        operations: {
          updateaddress: { enabled: true, steps: [] }
        }
      }
    }
  });

  it('resolves lowercase openapi/cip keys when capability name is camelCase', () => {
    const doc = hubspotLike();
    expect(resolveOpsKeyForEdit(doc, 'updateAddress', 'openapi')).toBe('updateaddress');
    expect(resolveOpsKeyForEdit(doc, 'updateAddress', 'cip')).toBe('updateaddress');
  });

  it('accepts lowercase user input when capabilities lists camelCase', () => {
    const doc = hubspotLike();
    expect(resolveOpsKeyForEdit(doc, 'updateaddress', 'cip')).toBe('updateaddress');
  });
});
