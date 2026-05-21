/**
 * @fileoverview Dataplane bulk record sync API (data-storage records/bulk)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

const { createDataplaneApiClient } = require('./index');

/**
 * Bulk sync external records for a datasource.
 * POST /api/v1/data-storage/{sourceIdOrKey}/records/bulk
 * @requiresPermission {Dataplane} external-data-source:sync
 * @async
 * @param {string} dataplaneUrl
 * @param {string} sourceIdOrKey
 * @param {Object} authConfig
 * @param {import('./types/records-bulk.types').ExternalRecordBulkRequest} body
 * @returns {Promise<import('./types/records-bulk.types').ExternalRecordBulkResponse>}
 */
async function bulkSyncRecords(dataplaneUrl, sourceIdOrKey, authConfig, body) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  return await client.post(
    `/api/v1/data-storage/${encodeURIComponent(sourceIdOrKey)}/records/bulk`,
    { body }
  );
}

module.exports = {
  bulkSyncRecords
};
