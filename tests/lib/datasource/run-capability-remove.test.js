/**
 * @fileoverview Tests for runCapabilityRemove error paths and force no-write
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { runCapabilityRemove } = require('../../../lib/datasource/capability/run-capability-remove');

/** Minimal object that passes validateDatasourceParsed (schema + field refs). */
function minimalValidDatasource() {
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
        name: { type: 'string', index: true }
      }
    },
    fieldMappings: {
      attributes: {
        id: { expression: '{{raw.id}}' },
        name: { expression: '{{raw.name}}' }
      }
    },
    openapi: { operations: {} },
    execution: { engine: 'cip', cip: { version: '1.0', operations: {} } },
    capabilities: []
  };
}

describe('runCapabilityRemove', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-rm-'));
    file = path.join(dir, 'ds.json');
    fs.writeFileSync(file, JSON.stringify(minimalValidDatasource()), 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('throws when capability missing and no force', async() => {
    await expect(
      runCapabilityRemove({
        fileOrKey: file,
        capability: 'nope',
        dryRun: true
      })
    ).rejects.toThrow(/not found/);
  });

  it('dry-run with force does not require capability present', async() => {
    const before = fs.readFileSync(file, 'utf8');
    const r = await runCapabilityRemove({
      fileOrKey: file,
      capability: 'nope',
      dryRun: true,
      force: true
    });
    expect(r.removed).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });

  it('force without dry-run does not write when capability absent', async() => {
    const before = fs.readFileSync(file, 'utf8');
    const r = await runCapabilityRemove({
      fileOrKey: file,
      capability: 'nope',
      force: true,
      noBackup: true
    });
    expect(r.removed).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
});
