/**
 * @fileoverview Batch upload loop for datasource load (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { bulkSyncRecords } = require('../api/records-bulk.api');
const { withTransientRetry, errorStatusCode } = require('./bulk-loader-service-retry');

/**
 * @async
 * @param {Object} params
 * @returns {Promise<{ batches: Object[], totals: Object }>}
 */
async function uploadRecordBatches(params) {
  const { chunks, syncType, dataplaneUrl, datasourceKey, authConfig } = params;
  const batches = [];
  const totals = { insertedCount: 0, updatedCount: 0, failedCount: 0 };

  for (let i = 0; i < chunks.length; i += 1) {
    const batchRecords = chunks[i];
    const body = { syncType, sync: false, records: batchRecords };
    let response;
    try {
      response = await withTransientRetry(() =>
        bulkSyncRecords(dataplaneUrl, datasourceKey, authConfig, body)
      );
    } catch (err) {
      batches.push({
        index: i + 1,
        total: chunks.length,
        error: err.message || String(err),
        statusCode: errorStatusCode(err),
        recordCount: batchRecords.length,
        failed: batchRecords.map(r => ({ key: r.key, message: err.message || String(err) }))
      });
      totals.failedCount += batchRecords.length;
      continue;
    }

    const inserted = response.insertedCount || 0;
    const updated = response.updatedCount || 0;
    const processed = response.totalProcessed || batchRecords.length;
    const failedInBatch = Math.max(0, batchRecords.length - processed);

    batches.push({
      index: i + 1,
      total: chunks.length,
      insertedCount: inserted,
      updatedCount: updated,
      totalProcessed: processed,
      failed: failedInBatch > 0 ? [{ message: 'Some records were not processed' }] : []
    });
    totals.insertedCount += inserted;
    totals.updatedCount += updated;
    totals.failedCount += failedInBatch;
  }

  return { batches, totals };
}

module.exports = {
  uploadRecordBatches
};
