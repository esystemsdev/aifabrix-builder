/**
 * @fileoverview Tests for applyCapabilityCopy
 */

const {
  applyCapabilityCopy,
  capabilityExists
} = require('../../../lib/datasource/capability/copy-operations');

describe('applyCapabilityCopy', () => {
  const minimalDoc = () => ({
    capabilities: ['create'],
    openapi: {
      enabled: true,
      operations: {
        create: { method: 'POST', path: '/x' }
      }
    },
    execution: {
      engine: 'cip',
      cip: {
        version: '1.0',
        operations: {
          create: {
            enabled: true,
            steps: [{ fetch: { source: 'openapi', openapiRef: 'create' } }]
          }
        }
      }
    },
    exposed: {
      schema: {},
      profiles: {
        create: ['name']
      }
    }
  });

  it('clones openapi + cip + capabilities and rewrites openapiRef', () => {
    const doc = minimalDoc();
    const { doc: out, resolvedAs } = applyCapabilityCopy(doc, {
      from: 'create',
      to: 'createCopy',
      overwrite: false
    });
    expect(resolvedAs).toBe('createCopy');
    expect(out.capabilities).toContain('createCopy');
    expect(out.openapi.operations.createcopy.method).toBe('POST');
    expect(out.execution.cip.operations.createcopy.steps[0].fetch.openapiRef).toBe('createcopy');
    expect(out.openapi.operations.create).toEqual(doc.openapi.operations.create);
  });

  it('copies exposed.profiles[from] to exposed.profiles[to]', () => {
    const doc = minimalDoc();
    const { doc: out } = applyCapabilityCopy(doc, {
      from: 'create',
      to: 'createBasic',
      overwrite: false
    });
    expect(out.exposed.profiles.createBasic).toEqual(['name']);
    expect(out.openapi.operations.createbasic).toBeDefined();
  });

  it('basicExposure writes minimal profile at exposed.profiles[to]', () => {
    const doc = minimalDoc();
    doc.metadataSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' }
      }
    };
    const { doc: out } = applyCapabilityCopy(doc, {
      from: 'create',
      to: 'createBasic',
      basicExposure: true,
      overwrite: false
    });
    expect(out.exposed.profiles.createBasic).toEqual(['id', 'title']);
  });

  it('throws when target exists without overwrite', () => {
    const doc = minimalDoc();
    doc.capabilities.push('createBasic');
    doc.openapi.operations.createbasic = { method: 'POST', path: '/x' };
    doc.execution.cip.operations.createbasic = { enabled: true, steps: [] };
    expect(() =>
      applyCapabilityCopy(doc, {
        from: 'create',
        to: 'createBasic',
        overwrite: false
      })
    ).toThrow(/already exists/);
  });

  it('does not append numeric suffix when target name collides', () => {
    const doc = minimalDoc();
    doc.capabilities.push('createCopy');
    doc.openapi.operations.createcopy = { method: 'POST', path: '/x' };
    doc.execution.cip.operations.createcopy = { enabled: true, steps: [] };
    expect(() =>
      applyCapabilityCopy(doc, {
        from: 'create',
        to: 'createCopy',
        overwrite: false
      })
    ).toThrow(/already exists/);
  });

  it('overwrites existing target when overwrite is true', () => {
    const doc = minimalDoc();
    doc.capabilities.push('target');
    doc.openapi.operations.target = { method: 'GET', path: '/old' };
    doc.execution.cip.operations.target = { enabled: true, steps: [] };
    const { doc: out, resolvedAs } = applyCapabilityCopy(doc, {
      from: 'create',
      to: 'target',
      overwrite: true
    });
    expect(resolvedAs).toBe('target');
    expect(out.openapi.operations.target.method).toBe('POST');
  });

  it('accepts capabilities[] logical name when openapi/cip keys differ by casing', () => {
    const doc = {
      capabilities: ['updateAddress'],
      openapi: {
        enabled: true,
        operations: {
          updateaddress: { method: 'PATCH', path: '/x/{id}' }
        }
      },
      execution: {
        engine: 'cip',
        cip: {
          version: '1.0',
          operations: {
            updateaddress: {
              enabled: true,
              steps: [{ fetch: { source: 'openapi', openapiRef: 'updateaddress' } }]
            }
          }
        }
      },
      exposed: {
        profiles: {
          updateAddress: ['name']
        }
      }
    };
    const { doc: out, resolvedAs } = applyCapabilityCopy(doc, {
      from: 'updateAddress',
      to: 'updateCountry',
      overwrite: false
    });
    expect(resolvedAs).toBe('updateCountry');
    expect(out.openapi.operations.updatecountry.method).toBe('PATCH');
    expect(out.execution.cip.operations.updatecountry.steps[0].fetch.openapiRef).toBe('updatecountry');
    expect(out.exposed.profiles.updateCountry).toEqual(['name']);
    expect(out.capabilities).toContain('updateAddress');
    expect(out.capabilities).toContain('updateCountry');
  });

  it('clones testPayload.scenarios when includeTestPayload is true', () => {
    const doc = minimalDoc();
    doc.testPayload = {
      mode: 'live',
      scenarios: [
        { operation: 'create', order: 1, input: {} },
        { operation: 'other', order: 2 }
      ]
    };
    const { doc: out, patchOperations } = applyCapabilityCopy(doc, {
      from: 'create',
      to: 'createCopy',
      overwrite: false,
      includeTestPayload: true
    });
    const cloned = out.testPayload.scenarios.filter((s) => s.operation === 'createcopy');
    expect(cloned.length).toBe(1);
    expect(cloned[0].order).toBe(1);
    expect(patchOperations.some((p) => p.path === '/testPayload/scenarios/-')).toBe(true);
  });

  it('with includeTestPayload and overwrite drops prior target scenarios before cloning', () => {
    const doc = minimalDoc();
    doc.capabilities.push('target');
    doc.openapi.operations.target = { method: 'GET', path: '/old' };
    doc.execution.cip.operations.target = { enabled: true, steps: [] };
    doc.testPayload = {
      scenarios: [
        { operation: 'create', order: 1 },
        { operation: 'target', order: 99 }
      ]
    };
    const { doc: out } = applyCapabilityCopy(doc, {
      from: 'create',
      to: 'target',
      overwrite: true,
      includeTestPayload: true
    });
    const targets = out.testPayload.scenarios.filter((s) => s.operation === 'target');
    expect(targets.length).toBe(1);
    expect(targets[0].order).toBe(1);
  });

  it('matches --from case-insensitively against capabilities[]', () => {
    const doc = {
      capabilities: ['updateAddress'],
      openapi: {
        enabled: true,
        operations: {
          updateaddress: { method: 'PATCH', path: '/x' }
        }
      },
      execution: {
        engine: 'cip',
        cip: {
          version: '1.0',
          operations: {
            updateaddress: { enabled: true, steps: [] }
          }
        }
      },
      exposed: { profiles: {} }
    };
    const { resolvedAs } = applyCapabilityCopy(doc, {
      from: 'updateaddress',
      to: 'updateCountry',
      overwrite: false
    });
    expect(resolvedAs).toBe('updateCountry');
  });
});

describe('capabilityExists', () => {
  it('detects key in any of three locations', () => {
    expect(capabilityExists({ capabilities: ['x'] }, 'x')).toBe(true);
    expect(capabilityExists({ openapi: { operations: { y: {} } } }, 'y')).toBe(true);
    expect(capabilityExists({ execution: { cip: { operations: { z: {} } } } }, 'z')).toBe(true);
    expect(capabilityExists({ capabilities: [] }, 'nope')).toBe(false);
  });
});
