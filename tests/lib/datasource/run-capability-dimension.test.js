/**
 * @fileoverview Tests for runCapabilityDimension critical paths (dry-run/write, via parsing, remote/catalog checks)
 */

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn()
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

jest.mock('../../../lib/api/dimensions.api', () => ({
  listDimensions: jest.fn()
}));

jest.mock('../../../lib/resolvers/datasource-resolver', () => ({
  tryResolveDatasourceKeyToLocalPath: jest.fn(),
  readJsonFile: jest.fn()
}));

jest.mock('../../../lib/resolvers/manifest-resolver', () => ({
  tryFetchDatasourceConfig: jest.fn()
}));

const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { listDimensions } = require('../../../lib/api/dimensions.api');
const { tryResolveDatasourceKeyToLocalPath, readJsonFile } = require('../../../lib/resolvers/datasource-resolver');
const { tryFetchDatasourceConfig } = require('../../../lib/resolvers/manifest-resolver');

const { runCapabilityDimension } = require('../../../lib/datasource/capability/run-capability-dimension');

function minimalValidDatasource(extra = {}) {
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
        name: { type: 'string', index: true },
        country: { type: 'string', index: true }
      }
    },
    fieldMappings: {
      attributes: {
        id: { expression: '{{raw.id}}' },
        name: { expression: '{{raw.name}}' },
        country: { expression: '{{raw.country}}' }
      }
    },
    openapi: { operations: {} },
    execution: { engine: 'cip', cip: { version: '1.0', operations: {} } },
    capabilities: [],
    ...extra
  };
}

describe('runCapabilityDimension', () => {
  let dir;
  let file;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: not authenticated => catalog check skipped.
    resolveControllerUrl.mockResolvedValue(null);
    getOrRefreshDeviceToken.mockResolvedValue(null);
    listDimensions.mockResolvedValue({ success: true, data: { items: [] } });

    // Default: no local target and no remote target.
    tryResolveDatasourceKeyToLocalPath.mockReturnValue({ ok: false, error: 'not found' });
    readJsonFile.mockImplementation(() => null);
    tryFetchDatasourceConfig.mockResolvedValue({ ok: false, error: 'Authentication required.', code: 'not_authenticated' });

    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-dim-'));
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

  it('dry-run does not write file', async() => {
    const before = fs.readFileSync(file, 'utf8');
    const r = await runCapabilityDimension({
      fileOrKey: file,
      dimension: 'market',
      type: 'local',
      field: 'country',
      dryRun: true
    });
    expect(r.dryRun).toBe(true);
    expect(r.patchOperations[0].path).toBe('/dimensions/market');
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });

  it('write mode updates file and creates backup by default', async() => {
    const r = await runCapabilityDimension({
      fileOrKey: file,
      dimension: 'market',
      type: 'local',
      field: 'country'
    });
    expect(r.dryRun).toBe(false);
    expect(r.backupPath).toBeTruthy();
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(after.dimensions.market).toEqual({ type: 'local', field: 'country' });
  });

  it('throws on invalid --via format', async() => {
    await expect(
      runCapabilityDimension({
        fileOrKey: file,
        dimension: 'owner',
        type: 'fk',
        via: ['badViaNoColon']
      })
    ).rejects.toThrow(/--via must be in form/);
  });

  it('fk: loads remote target and validates via dimension exists', async() => {
    fs.writeFileSync(
      file,
      JSON.stringify(
        minimalValidDatasource({
          foreignKeys: [{ name: 'hubspotOwner', fields: ['ownerId'], targetDatasource: 'users' }]
        })
      ),
      'utf8'
    );

    tryFetchDatasourceConfig.mockResolvedValue({
      ok: true,
      datasourceConfig: { key: 'users', dimensions: { owner: { type: 'local', field: 'email' } } }
    });

    const r = await runCapabilityDimension({
      fileOrKey: file,
      dimension: 'owner',
      type: 'fk',
      via: ['hubspotOwner:owner'],
      overwrite: true
    });
    expect(r.remoteValidation.attempted).toBe(true);
    expect(r.remoteValidation.fetchedKeys).toContain('users');
  });

  it('catalog check blocks when authenticated and dimension key not found', async() => {
    resolveControllerUrl.mockResolvedValue('http://controller');
    getOrRefreshDeviceToken.mockResolvedValue({ controller: 'http://controller', token: 't' });
    listDimensions.mockResolvedValue({ success: true, data: { items: [{ key: 'owner' }] } });

    await expect(
      runCapabilityDimension({
        fileOrKey: file,
        dimension: 'market',
        type: 'local',
        field: 'country',
        dryRun: true
      })
    ).rejects.toThrow(/dimension catalog/);
  });
});

