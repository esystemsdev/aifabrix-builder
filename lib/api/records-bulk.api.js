/**
 * @fileoverview Dataplane bulk record sync API (data-storage records/bulk)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

const { createDataplaneApiClient } = require('./index');
const { unwrapApiData } = require('../utils/external-system-readiness-core');

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
  const res = await client.post(
    `/api/v1/data-storage/${encodeURIComponent(sourceIdOrKey)}/records/bulk`,
    { body }
  );
  if (res && res.success === false) {
    const msg =
      res.formattedError ||
      res.error ||
      `Bulk sync failed (HTTP ${res.status || 0})`;
    throw new Error(msg);
  }
  const payload = unwrapApiData(res);
  if (!payload || typeof payload !== 'object') {
    throw new Error('Bulk sync returned an unexpected response shape');
  }
  return payload;
}

module.exports = {
  bulkSyncRecords
};
