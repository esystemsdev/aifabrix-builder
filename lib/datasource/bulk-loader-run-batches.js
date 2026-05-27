/**
 * @fileoverview Batch upload loop for datasource load (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { bulkSyncRecords } = require('../api/records-bulk.api');
const { withTransientRetry, errorStatusCode } = require('./bulk-loader-service-retry');

/**
 * @param {Object} state
 * @param {number} index
 * @param {Error} err
 * @param {Object[]} batchRecords
 */
function recordBatchFailure(state, index, err, batchRecords) {
  state.batches.push({
    index: index + 1,
    total: state.chunkCount,
    error: err.message || String(err),
    statusCode: errorStatusCode(err),
    recordCount: batchRecords.length,
    failed: batchRecords.map(r => ({ key: r.key, message: err.message || String(err) }))
  });
  state.totals.failedCount += batchRecords.length;
}

/**
 * @param {Object} state
 * @param {number} index
 * @param {Object} response
 * @param {Object[]} batchRecords
 */
function recordBatchSuccess(state, index, response, batchRecords) {
  if (!response || typeof response !== 'object') {
    throw new Error('Bulk sync returned empty response');
  }
  if (response.success === false) {
    throw new Error(
      response.formattedError ||
        response.error ||
        `Bulk sync failed (HTTP ${response.status || 0})`
    );
  }
  const payload =
    response.data !== undefined && response.data !== null ? response.data : response;
  const inserted = payload.insertedCount || 0;
  const updated = payload.updatedCount || 0;
  const processed = payload.totalProcessed || batchRecords.length;
  const failedInBatch = Math.max(0, batchRecords.length - processed);

  state.batches.push({
    index: index + 1,
    total: state.chunkCount,
    insertedCount: inserted,
    updatedCount: updated,
    totalProcessed: processed,
    failed: failedInBatch > 0 ? [{ message: 'Some records were not processed' }] : []
  });
  state.totals.insertedCount += inserted;
  state.totals.updatedCount += updated;
  state.totals.failedCount += failedInBatch;
}

/**
 * @async
 * @param {Object} params
 * @returns {Promise<{ batches: Object[], totals: Object }>}
 */
async function uploadRecordBatches(params) {
  const { chunks, syncType, dataplaneUrl, datasourceKey, authConfig } = params;
  const state = {
    batches: [],
    totals: { insertedCount: 0, updatedCount: 0, failedCount: 0 },
    chunkCount: chunks.length
  };

  for (let i = 0; i < chunks.length; i += 1) {
    const batchRecords = chunks[i];
    const body = { syncType, sync: false, records: batchRecords };
    try {
      const response = await withTransientRetry(() =>
        bulkSyncRecords(dataplaneUrl, datasourceKey, authConfig, body)
      );
      recordBatchSuccess(state, i, response, batchRecords);
    } catch (err) {
      recordBatchFailure(state, i, err, batchRecords);
    }
  }

  return { batches: state.batches, totals: state.totals };
}

module.exports = {
  uploadRecordBatches,
  recordBatchFailure,
  recordBatchSuccess
};
