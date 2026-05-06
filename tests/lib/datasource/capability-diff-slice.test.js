/**
 * @fileoverview Tests for extractCapabilitySliceForDiff
 */

const {
  extractCapabilitySliceForDiff
} = require('../../../lib/datasource/capability/capability-diff-slice');

describe('extractCapabilitySliceForDiff', () => {
  const doc = () => ({
    capabilities: ['list'],
    openapi: { operations: { list: { method: 'GET', path: '/a' } } },
    execution: { cip: { operations: { list: { enabled: true, steps: [] } } } },
    exposed: {
      profiles: {
        list: ['id', 'name'],
        other: ['id']
      }
    }
  });

  it('includes openapi, cip, and listedInCapabilities', () => {
    const s = extractCapabilitySliceForDiff(doc(), 'list');
    expect(s.listedInCapabilities).toBe(true);
    expect(s.openapiOperation).toEqual({ method: 'GET', path: '/a' });
    expect(s.cipOperation).toEqual({ enabled: true, steps: [] });
    expect(s.exposedProfile).toBeUndefined();
  });

  it('includes exposedProfile when profileKey is set', () => {
    const s = extractCapabilitySliceForDiff(doc(), 'list', 'list');
    expect(s.exposedProfile).toEqual(['id', 'name']);
  });

  it('sets exposedProfile undefined when profile key missing', () => {
    const s = extractCapabilitySliceForDiff(doc(), 'list', 'missing');
    expect(s.exposedProfile).toBeUndefined();
  });

  it('marks listedInCapabilities false when capability only in operations', () => {
    const d = doc();
    d.capabilities = [];
    const s = extractCapabilitySliceForDiff(d, 'list');
    expect(s.listedInCapabilities).toBe(false);
    expect(s.openapiOperation).toBeDefined();
  });

  it('omits openapiOperation when key missing', () => {
    const d = doc();
    delete d.openapi.operations.list;
    const s = extractCapabilitySliceForDiff(d, 'list');
    expect(s.openapiOperation).toBeUndefined();
  });
});
