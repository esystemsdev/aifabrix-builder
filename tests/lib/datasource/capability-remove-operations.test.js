/**
 * @fileoverview Tests for applyCapabilityRemove and pruneTestPayloadScenarios
 */

const {
  applyCapabilityRemove,
  pruneTestPayloadScenarios,
  finalizeTestPayloadShape,
  finalizeEmptyExposedProfiles
} = require('../../../lib/datasource/capability/remove-operations');

describe('pruneTestPayloadScenarios', () => {
  it('filters scenarios by operation key', () => {
    const doc = {
      testPayload: {
        scenarios: [{ operation: 'list' }, { operation: 'get' }, { operation: 'list' }]
      }
    };
    const changed = pruneTestPayloadScenarios(doc, 'list', undefined, undefined);
    expect(changed).toBe(true);
    expect(doc.testPayload.scenarios).toEqual([{ operation: 'get' }]);
  });

  it('returns false when nothing matches', () => {
    const doc = { testPayload: { scenarios: [{ operation: 'get' }] } };
    expect(pruneTestPayloadScenarios(doc, 'list', undefined, undefined)).toBe(false);
  });

  it('drops scenarios matching openapi alias when different from logical key', () => {
    const doc = {
      testPayload: {
        scenarios: [{ operation: 'updateaddress' }]
      }
    };
    expect(pruneTestPayloadScenarios(doc, 'updateAddress', 'updateaddress', 'updateaddress')).toBe(
      true
    );
    expect(doc.testPayload.scenarios).toEqual([]);
  });
});

describe('finalizeTestPayloadShape', () => {
  it('drops empty scenarios array then removes testPayload when empty', () => {
    const doc = { testPayload: { scenarios: [] } };
    expect(finalizeTestPayloadShape(doc)).toBe(true);
    expect(doc.testPayload).toBeUndefined();
  });

  it('keeps other testPayload keys when scenarios emptied', () => {
    const doc = { testPayload: { mode: 'live', scenarios: [] } };
    expect(finalizeTestPayloadShape(doc)).toBe(true);
    expect(doc.testPayload).toEqual({ mode: 'live' });
  });
});

describe('finalizeEmptyExposedProfiles', () => {
  it('removes exposed.profiles when it is {}', () => {
    const doc = { exposed: { schema: {}, profiles: {} } };
    expect(finalizeEmptyExposedProfiles(doc)).toBe(true);
    expect(doc.exposed.profiles).toBeUndefined();
    expect(doc.exposed.schema).toEqual({});
  });
});

describe('applyCapabilityRemove', () => {
  const baseDoc = () => ({
    capabilities: ['list', 'get'],
    openapi: {
      operations: {
        list: { method: 'GET', path: '/l' },
        get: { method: 'GET', path: '/g' }
      }
    },
    execution: {
      engine: 'cip',
      cip: {
        operations: {
          list: { enabled: true, steps: [] },
          get: { enabled: true, steps: [] }
        }
      }
    },
    exposed: {
      schema: {},
      profiles: {
        list: ['id']
      }
    }
  });

  it('removes capability slices, exposed.profiles.<key>, and matching test scenarios', () => {
    const doc = baseDoc();
    doc.testPayload = {
      scenarios: [{ operation: 'list' }, { operation: 'get' }, { operation: 'list' }]
    };
    const { doc: out, removed } = applyCapabilityRemove(doc, { capability: 'list' });
    expect(removed).toBe(true);
    expect(out.capabilities.includes('list')).toBe(false);
    expect(out.openapi.operations.list).toBeUndefined();
    expect(out.execution.cip.operations.list).toBeUndefined();
    expect(out.openapi.operations.get).toBeDefined();
    expect(out.exposed.profiles).toBeUndefined();
    expect(out.testPayload.scenarios).toEqual([{ operation: 'get' }]);
  });

  it('returns planned JSON Patch removes for capabilities, openapi/cip, profiles, scenarios', () => {
    const doc = baseDoc();
    doc.testPayload = {
      scenarios: [{ operation: 'list' }, { operation: 'get' }, { operation: 'list' }]
    };
    const { patchOperations } = applyCapabilityRemove(doc, { capability: 'list' });
    expect(patchOperations).toEqual([
      { op: 'remove', path: '/capabilities/0' },
      { op: 'remove', path: '/openapi/operations/list' },
      { op: 'remove', path: '/execution/cip/operations/list' },
      { op: 'remove', path: '/exposed/profiles/list' },
      { op: 'remove', path: '/testPayload/scenarios/2' },
      { op: 'remove', path: '/testPayload/scenarios/0' }
    ]);
  });

  it('removes testPayload entirely when scenarios only referenced the removed capability', () => {
    const doc = baseDoc();
    doc.testPayload = { scenarios: [{ operation: 'list' }] };
    const { doc: out } = applyCapabilityRemove(doc, { capability: 'list' });
    expect(out.testPayload).toBeUndefined();
  });

  it('throws when absent without force', () => {
    expect(() =>
      applyCapabilityRemove(baseDoc(), { capability: 'missing' })
    ).toThrow(/not found/);
  });

  it('no-op with force when absent', () => {
    const doc = baseDoc();
    const { doc: out, removed } = applyCapabilityRemove(doc, {
      capability: 'missing',
      force: true
    });
    expect(removed).toBe(false);
    expect(JSON.stringify(out)).toBe(JSON.stringify(doc));
  });

  it('removes openapi/cip slices when keys differ by casing from capability name', () => {
    const doc = {
      capabilities: ['updateAddress'],
      openapi: {
        operations: {
          updateaddress: { method: 'PATCH', path: '/x' }
        }
      },
      execution: {
        engine: 'cip',
        cip: {
          operations: {
            updateaddress: { enabled: true, steps: [] }
          }
        }
      },
      exposed: {
        profiles: {
          updateAddress: ['name']
        }
      }
    };
    const { doc: out, removed } = applyCapabilityRemove(doc, { capability: 'updateAddress' });
    expect(removed).toBe(true);
    expect(out.openapi.operations.updateaddress).toBeUndefined();
    expect(out.execution.cip.operations.updateaddress).toBeUndefined();
    expect(out.capabilities.includes('updateAddress')).toBe(false);
    expect(out.exposed.profiles).toBeUndefined();
  });
});
