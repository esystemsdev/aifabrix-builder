/**
 * @fileoverview Preflight: datasource must exist on dataplane before protection upload.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { getDatasource } = require('../api/datasources-core.api');
const { unwrapApiData } = require('../utils/external-system-readiness-core');

/**
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} datasourceKey
 * @returns {Promise<void>}
 */
async function assertDatasourceExistsOnDataplane(dataplaneUrl, authConfig, datasourceKey) {
  const key = String(datasourceKey || '').trim();
  if (!key) {
    throw new Error('spec.datasourceKey is required');
  }
  const res = await getDatasource(dataplaneUrl, key, authConfig);
  const row = unwrapApiData(res);
  if (!row || (res && res.success === false)) {
    throw new Error(
      `Datasource "${key}" is not deployed on the dataplane. Run aifabrix deploy <app> first.`
    );
  }
}

/**
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {Object} manifest
 * @returns {Promise<void>}
 */
async function preflightDatasourceReady(dataplaneUrl, authConfig, manifest) {
  const ds = String(manifest?.spec?.datasourceKey || '').trim();
  await assertDatasourceExistsOnDataplane(dataplaneUrl, authConfig, ds);
}

module.exports = {
  assertDatasourceExistsOnDataplane,
  preflightDatasourceReady
};
