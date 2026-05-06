/**
 * @fileoverview capability diff runner (temp files + compareObjects path)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runCapabilityDiff,
  resolveCapabilityKeys,
  resolveProfileKeys
} = require('../../../lib/datasource/capability/run-capability-diff');

const sliceDoc = (capKey, openapiExtra = {}, profilePayload = {}) => ({
  key: 't',
  displayName: 'T',
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
      name: { type: 'string', index: true }
    }
  },
  fieldMappings: {
    attributes: {
      id: { expression: '{{raw.id}}' },
      name: { expression: '{{raw.name}}' }
    }
  },
  openapi: {
    operations: {
      [capKey]: { method: 'GET', path: '/x', ...openapiExtra }
    }
  },
  execution: {
    engine: 'cip',
    cip: {
      version: '1.0',
      operations: {
        [capKey]: { enabled: true, steps: [] }
      }
    }
  },
  capabilities: [capKey],
  exposed: {
    schema: { id: { expression: '{{raw.id}}' } },
    profiles: Object.keys(profilePayload).length ? profilePayload : {}
  }
});

describe('runCapabilityDiff', () => {
  let dir;
  let aFile;
  let bFile;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-diff-'));
    aFile = path.join(dir, 'a.json');
    bFile = path.join(dir, 'b.json');
    fs.writeFileSync(aFile, JSON.stringify(sliceDoc('list')), 'utf8');
    fs.writeFileSync(bFile, JSON.stringify(sliceDoc('list', { x: 1 })), 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('reports differences when openapi slice differs', () => {
    const { identical } = runCapabilityDiff({
      fileA: aFile,
      fileB: bFile,
      capability: 'list'
    });
    expect(identical).toBe(false);
  });

  it('resolveCapabilityKeys accepts --capability', () => {
    expect(
      resolveCapabilityKeys({
        capability: 'get'
      })
    ).toEqual({ capA: 'get', capB: 'get' });
  });

  it('resolveCapabilityKeys accepts separate a/b', () => {
    expect(
      resolveCapabilityKeys({
        capabilityA: 'list',
        capabilityB: 'get'
      })
    ).toEqual({ capA: 'list', capB: 'get' });
  });

  it('resolveCapabilityKeys throws when keys missing', () => {
    expect(() => resolveCapabilityKeys({})).toThrow(/Provide --capability/);
  });

  it('identical slices yield identical true', () => {
    fs.writeFileSync(bFile, fs.readFileSync(aFile, 'utf8'));
    const { identical } = runCapabilityDiff({
      fileA: aFile,
      fileB: bFile,
      capability: 'list'
    });
    expect(identical).toBe(true);
  });

  it('resolveProfileKeys maps shared --profile to both sides', () => {
    expect(resolveProfileKeys({ profile: 'list' })).toEqual({
      profA: 'list',
      profB: 'list'
    });
  });

  it('resolveProfileKeys uses profile-a and profile-b', () => {
    expect(
      resolveProfileKeys({
        profileA: 'foo',
        profileB: 'bar'
      })
    ).toEqual({ profA: 'foo', profB: 'bar' });
  });

  it('diff includes exposed profile when profiles differ', () => {
    fs.writeFileSync(
      aFile,
      JSON.stringify(sliceDoc('list', {}, { list: ['id'] })),
      'utf8'
    );
    fs.writeFileSync(
      bFile,
      JSON.stringify(sliceDoc('list', {}, { list: ['id', 'name'] })),
      'utf8'
    );
    const { identical } = runCapabilityDiff({
      fileA: aFile,
      fileB: bFile,
      capability: 'list',
      profile: 'list'
    });
    expect(identical).toBe(false);
  });
});
