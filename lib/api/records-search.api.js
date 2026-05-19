/**
 * @fileoverview Dataplane Records Search API
 * @author AI Fabrix Team
 * @version 1.0.0
 */

const { createDataplaneApiClient } = require('./index');

/**
 * Search records across datasources (governed read path).
 * POST /api/v1/records/search
 * @requiresPermission {Dataplane} record:search
 * @async
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {import('./types/records-search.types').RecordsSearchRequest} body
 * @returns {Promise<import('./types/records-search.types').RecordsSearchResponse>}
 */
async function searchRecords(dataplaneUrl, authConfig, body) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  return await client.post('/api/v1/records/search', { body });
}

module.exports = {
  searchRecords
};
