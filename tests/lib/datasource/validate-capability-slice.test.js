/**
 * @fileoverview Tests for capability slice presence checks
 */

const { checkCapabilitySlices } = require('../../../lib/datasource/capability/validate-capability-slice');

describe('checkCapabilitySlices', () => {
  const doc = {
    capabilities: ['list', 'get'],
    openapi: {
      operations: {
        list: {},
        get: {}
      }
    },
    execution: {
      engine: 'cip',
      cip: {
        operations: {
          list: {},
          get: {}
        }
      }
    }
  };

  it('returns empty missing when capability is wired everywhere', () => {
    const r = checkCapabilitySlices(doc, 'list');
    expect(r.key).toBe('list');
    expect(r.missing).toHaveLength(0);
  });

  it('reports missing openapi slice', () => {
    const r = checkCapabilitySlices(doc, 'get');
    expect(r.missing.length).toBe(0);
    const partial = JSON.parse(JSON.stringify(doc));
    delete partial.openapi.operations.get;
    const m = checkCapabilitySlices(partial, 'get');
    expect(m.missing.some((x) => x.includes('openapi.operations'))).toBe(true);
  });

  it('reports missing capabilities[] entry', () => {
    const partial = JSON.parse(JSON.stringify(doc));
    partial.capabilities = ['list'];
    const m = checkCapabilitySlices(partial, 'get');
    expect(m.missing.some((x) => x.includes('capabilities[]'))).toBe(true);
  });

  it('reports missing cip operation', () => {
    const partial = JSON.parse(JSON.stringify(doc));
    delete partial.execution.cip.operations.get;
    const m = checkCapabilitySlices(partial, 'get');
    expect(m.missing.some((x) => x.includes('execution.cip.operations'))).toBe(true);
  });
});
