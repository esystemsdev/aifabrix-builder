/**
 * @fileoverview Tests for datasource-exporter-service (plan 144)
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../lib/datasource/datasource-load-export-context', () => ({
  resolveLoadExportContext: jest.fn()
}));
jest.mock('../../../lib/api/records-search.api', () => ({
  searchRecords: jest.fn()
}));

const { resolveLoadExportContext } = require('../../../lib/datasource/datasource-load-export-context');
const { searchRecords } = require('../../../lib/api/records-search.api');
const {
  runDatasourceExport,
  projectExportRows,
  writeExportFile
} = require('../../../lib/datasource/datasource-exporter-service');

describe('datasource-exporter-service', () => {
  let tmpDir;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-export-'));
    resolveLoadExportContext.mockResolvedValue({
      datasourceKey: 'hub-test-co',
      systemKey: 'hub-test',
      appKey: 'hub-test',
      entitySuffix: 'co',
      dataplaneUrl: 'http://localhost:3001',
      authConfig: { token: 't' }
    });
    searchRecords.mockResolvedValue({
      data: [{ metadata: { email: 'a@x.com', name: 'A' } }],
      meta: { excluded: { abac: 1 }, auditRef: 'rss-1' }
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('projectExportRows filters metadata keys', () => {
    const rows = projectExportRows(
      [{ metadata: { email: 'a@x.com', name: 'A', secret: 'x' } }],
      ['email']
    );
    expect(rows).toEqual([{ email: 'a@x.com' }]);
  });

  it('writeExportFile writes JSON array', () => {
    const out = path.join(tmpDir, 'out.json');
    writeExportFile(out, 'json', [{ id: 1 }]);
    const parsed = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(parsed).toEqual([{ id: 1 }]);
  });

  it('runDatasourceExport calls search and writes output', async() => {
    const out = path.join(tmpDir, 'export.json');
    const result = await runDatasourceExport('hub-test-co', { file: out, limit: '10' });

    expect(searchRecords).toHaveBeenCalledWith(
      'http://localhost:3001',
      { token: 't' },
      expect.objectContaining({
        intent: 'validation',
        datasourceKeys: ['hub-test-co'],
        searchMode: 'full',
        limit: 10
      })
    );
    expect(result.outputFile).toBe(out);
    expect(result.recordCount).toBe(1);
    expect(result.meta.auditRef).toBe('rss-1');
    expect(fs.existsSync(out)).toBe(true);
  });
});
