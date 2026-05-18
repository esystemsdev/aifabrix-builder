/**
 * @fileoverview Trigger datasource sync after protection upload.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { createSyncJob, executeSyncJob } = require('../api/datasources-extended.api');
const { unwrapApiData } = require('../utils/external-system-readiness-core');

/**
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} datasourceKey
 * @returns {Promise<{ syncJobId: string|null, warning: string|null }>}
 */
async function syncDatasourceAfterProtectionUpload(dataplaneUrl, authConfig, datasourceKey) {
  const key = String(datasourceKey || '').trim();
  if (!key) {
    return { syncJobId: null, warning: 'Missing datasource key for sync' };
  }
  try {
    const created = unwrapApiData(
      await createSyncJob(dataplaneUrl, key, authConfig, {})
    );
    const syncJobId =
      created?.id || created?.syncJobId || created?.data?.id || null;
    if (syncJobId) {
      await executeSyncJob(dataplaneUrl, key, syncJobId, authConfig);
    }
    return { syncJobId: syncJobId ? String(syncJobId) : null, warning: null };
  } catch (err) {
    return {
      syncJobId: null,
      warning: err?.message || String(err)
    };
  }
}

/**
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string[]} datasourceKeys
 * @returns {Promise<Array<{ datasourceKey: string, syncJobId: string|null, warning: string|null }>>}
 */
async function syncUniqueDatasourcesAfterUpload(dataplaneUrl, authConfig, datasourceKeys) {
  const unique = [...new Set(datasourceKeys.map((k) => String(k || '').trim()).filter(Boolean))];
  const out = [];
  for (const datasourceKey of unique) {
    const result = await syncDatasourceAfterProtectionUpload(
      dataplaneUrl,
      authConfig,
      datasourceKey
    );
    out.push({ datasourceKey, ...result });
  }
  return out;
}

module.exports = {
  syncDatasourceAfterProtectionUpload,
  syncUniqueDatasourcesAfterUpload
};
