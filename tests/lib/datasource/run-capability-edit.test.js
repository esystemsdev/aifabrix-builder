/**
 * @fileoverview runCapabilityEdit — TTY guard and editor round-trip (inquirer mocked)
 */

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const inquirer = require('inquirer');

const { runCapabilityEdit } = require('../../../lib/datasource/capability/run-capability-edit');

/** Matches validateDatasourceParsed (schema-enforced list operation + CIP steps). */
function editableDatasourceFile() {
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
    openapi: {
      operations: {
        list: {
          operationId: 'listEntities',
          method: 'GET',
          path: '/orig'
        }
      }
    },
    execution: {
      engine: 'cip',
      cip: {
        version: '1.0',
        operations: {
          list: {
            enabled: true,
            steps: [{ fetch: { source: 'openapi', openapiRef: 'list' } }]
          }
        }
      }
    },
    capabilities: ['list'],
    exposed: {
      schema: {
        id: 'metadata.id'
      },
      profiles: {
        list: ['id'],
        custom: ['id']
      }
    }
  };
}

describe('runCapabilityEdit', () => {
  let dir;
  let file;

  /**
   * @param {boolean} val
   * @returns {void}
   */
  function setStdinIsTTY(val) {
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      enumerable: true,
      value: val,
      writable: true
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setStdinIsTTY(true);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-edit-'));
    file = path.join(dir, 'ds.json');
    fs.writeFileSync(file, JSON.stringify(editableDatasourceFile()), 'utf8');
  });

  afterEach(() => {
    setStdinIsTTY(true);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('throws when stdin is not a TTY', async() => {
    setStdinIsTTY(false);
    await expect(
      runCapabilityEdit({
        fileOrKey: file,
        capability: 'list',
        section: 'openapi'
      })
    ).rejects.toThrow(/TTY/);
  });

  it('updates openapi.operations from editor JSON', async() => {
    inquirer.prompt.mockResolvedValue({
      body: JSON.stringify({
        operationId: 'listEntities',
        method: 'GET',
        path: '/edited'
      })
    });

    await runCapabilityEdit({
      fileOrKey: file,
      capability: 'list',
      section: 'openapi',
      noBackup: true
    });

    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(doc.openapi.operations.list.path).toBe('/edited');
  });

  it('updates exposed.profiles from editor JSON', async() => {
    inquirer.prompt.mockResolvedValue({
      body: JSON.stringify(['id', 'name'])
    });

    await runCapabilityEdit({
      fileOrKey: file,
      capability: 'list',
      section: 'profile',
      profile: 'custom',
      noBackup: true
    });

    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(doc.exposed.profiles.custom).toEqual(['id', 'name']);
  });

  it('skips exposure profile prompt when -c matches exposed.profiles row', async() => {
    inquirer.prompt.mockResolvedValue({
      body: JSON.stringify(['id', 'name'])
    });

    await runCapabilityEdit({
      fileOrKey: file,
      capability: 'list',
      section: 'profile',
      noBackup: true
    });

    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(doc.exposed.profiles.list).toEqual(['id', 'name']);
  });

  it('skips exposure profile prompt when capability is chosen interactively and matches a profile row', async() => {
    inquirer.prompt
      .mockResolvedValueOnce({ key: 'list' })
      .mockResolvedValueOnce({ section: 'profile' })
      .mockResolvedValueOnce({
        body: JSON.stringify(['id', 'name'])
      });

    await runCapabilityEdit({
      fileOrKey: file,
      noBackup: true
    });

    expect(inquirer.prompt).toHaveBeenCalledTimes(3);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(doc.exposed.profiles.list).toEqual(['id', 'name']);
  });
});
