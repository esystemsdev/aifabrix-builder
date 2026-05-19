/**
 * @fileoverview Tests for bulk-loader-service (plan 144)
 */

'use strict';

jest.mock('../../../lib/datasource/datasource-load-export-context', () => ({
  resolveLoadExportContext: jest.fn()
}));
jest.mock('../../../lib/datasource/local-data-paths', () => ({
  resolveDataFilePath: jest.fn()
}));
jest.mock('../../../lib/datasource/record-file-parser', () => ({
  parseRecordFile: jest.fn(),
  estimatePayloadBytes: jest.fn(() => 128)
}));
jest.mock('../../../lib/datasource/bulk-loader-run-batches', () => ({
  uploadRecordBatches: jest.fn()
}));

const { resolveLoadExportContext } = require('../../../lib/datasource/datasource-load-export-context');
const { resolveDataFilePath } = require('../../../lib/datasource/local-data-paths');
const { parseRecordFile } = require('../../../lib/datasource/record-file-parser');
const { uploadRecordBatches } = require('../../../lib/datasource/bulk-loader-run-batches');
const {
  runDatasourceLoad,
  chunkRecords,
  buildLoadResultBase
} = require('../../../lib/datasource/bulk-loader-service');

describe('bulk-loader-service', () => {
  const ctx = {
    datasourceKey: 'hub-test-co',
    systemKey: 'hub-test',
    appKey: 'hub-test',
    datasource: {
      key: 'hub-test-co',
      primaryKey: ['externalId'],
      resourceType: 'item'
    },
    dataplaneUrl: 'http://localhost:3001',
    authConfig: { token: 't' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveLoadExportContext.mockResolvedValue(ctx);
    resolveDataFilePath.mockReturnValue({
      filePath: '/tmp/hub-test-data-co.json',
      format: 'json'
    });
    parseRecordFile.mockReturnValue([{ externalId: 'a1', name: 'A' }]);
  });

  it('chunkRecords splits by batch size', () => {
    const records = [1, 2, 3, 4, 5];
    expect(chunkRecords(records, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('dry-run does not call uploadRecordBatches', async() => {
    const result = await runDatasourceLoad('hub-test-co', { dryRun: true });
    expect(uploadRecordBatches).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.recordCount).toBe(1);
    expect(result.context).toBe(ctx);
  });

  it('uploads chunked records when not dry-run', async() => {
    uploadRecordBatches.mockResolvedValue({
      batches: [{ index: 1, total: 1, insertedCount: 1, updatedCount: 0, failed: [] }],
      totals: { insertedCount: 1, updatedCount: 0, failedCount: 0 }
    });

    const result = await runDatasourceLoad('hub-test-co', { batchSize: '100' });

    expect(uploadRecordBatches).toHaveBeenCalledWith(
      expect.objectContaining({
        syncType: 'incremental',
        datasourceKey: 'hub-test-co',
        dataplaneUrl: ctx.dataplaneUrl
      })
    );
    expect(result.totals.insertedCount).toBe(1);
  });

  it('buildLoadResultBase sets totals to zero', () => {
    const base = buildLoadResultBase({
      ctx,
      filePath: '/tmp/x.json',
      format: 'json',
      records: [{ key: 'k' }],
      batchSize: 50,
      syncType: 'bulk',
      dryRun: false
    });
    expect(base.recordCount).toBe(1);
    expect(base.totals.failedCount).toBe(0);
  });
});
