/**
 * @fileoverview Tests for bulk-loader-run-batches (plan 144)
 */

'use strict';

jest.mock('../../../lib/api/records-bulk.api', () => ({
  bulkSyncRecords: jest.fn()
}));
jest.mock('../../../lib/datasource/bulk-loader-service-retry', () => ({
  withTransientRetry: jest.fn(fn => fn()),
  errorStatusCode: jest.fn(() => 500)
}));

const { bulkSyncRecords } = require('../../../lib/api/records-bulk.api');
const { uploadRecordBatches } = require('../../../lib/datasource/bulk-loader-run-batches');

describe('bulk-loader-run-batches', () => {
  const baseParams = {
    syncType: 'incremental',
    dataplaneUrl: 'http://localhost:3001',
    datasourceKey: 'ds-1',
    authConfig: { token: 't' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates success across batches', async() => {
    bulkSyncRecords.mockResolvedValue({ insertedCount: 2, updatedCount: 0, totalProcessed: 2 });
    const chunks = [
      [{ key: 'a', displayName: '', recordType: 'item', metadata: {} }],
      [{ key: 'b', displayName: '', recordType: 'item', metadata: {} }]
    ];

    const { batches, totals } = await uploadRecordBatches({ ...baseParams, chunks });

    expect(batches).toHaveLength(2);
    expect(totals.insertedCount).toBe(4);
    expect(totals.failedCount).toBe(0);
  });

  it('records batch failure without stopping later batches', async() => {
    bulkSyncRecords
      .mockRejectedValueOnce(new Error('HTTP 409 conflict'))
      .mockResolvedValueOnce({ insertedCount: 1, updatedCount: 0, totalProcessed: 1 });

    const chunks = [
      [{ key: 'bad', displayName: '', recordType: 'item', metadata: {} }],
      [{ key: 'ok', displayName: '', recordType: 'item', metadata: {} }]
    ];

    const { totals, batches } = await uploadRecordBatches({ ...baseParams, chunks });

    expect(totals.failedCount).toBe(1);
    expect(totals.insertedCount).toBe(1);
    expect(batches[0].error).toMatch(/409/);
    expect(batches[0].failed[0].key).toBe('bad');
  });
});
