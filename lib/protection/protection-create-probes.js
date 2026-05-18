/**
 * @fileoverview Online probes for `protection create` (dataplane datasource + Controller dimension).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { getDatasource } = require('../api/datasources-core.api');
const { getDimension } = require('../api/dimensions.api');
const { unwrapApiData } = require('../utils/external-system-readiness-core');
const {
  startDatasourceProbeLines,
  appendDatasourceSuccessDetail,
  startDimensionProbeLines,
  appendDimensionSuccessDetail
} = require('./protection-create-probe-lines');

/**
 * @param {*} response
 * @returns {*}
 */
function unwrapControllerDimension(response) {
  const d = response?.data?.data ?? response?.data ?? response;
  return d;
}

/**
 * @param {string[]} lines
 * @param {string} msg
 * @returns {never}
 */
function throwProbe(lines, msg) {
  const err = new Error(msg);
  err.probeLines = lines;
  throw err;
}

/**
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} datasourceKey
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function probeDatasourceForProtectionCreate(dataplaneUrl, authConfig, datasourceKey, opts = {}) {
  const key = String(datasourceKey || '').trim();
  const lines = startDatasourceProbeLines(key);
  const res = await getDatasource(dataplaneUrl, key, authConfig);
  if (res && res.success === false) {
    const msg = res.formattedError || res.error || `Datasource "${key}" request failed`;
    throwProbe(lines, typeof msg === 'string' ? msg : 'Datasource probe failed');
  }
  const row = unwrapApiData(res);
  if (!row) {
    throwProbe(
      lines,
      `Datasource "${key}" not found or not readable on the dataplane. Deploy the integration first.`
    );
  }
  appendDatasourceSuccessDetail(lines, row, key, dataplaneUrl, opts);
  return { row, lines };
}

/**
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} dimensionKey
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function probeDimensionForProtectionCreate(controllerUrl, authConfig, dimensionKey, opts = {}) {
  const key = String(dimensionKey || '').trim();
  const lines = startDimensionProbeLines(key);
  const res = await getDimension(controllerUrl, authConfig, key, { includeValues: opts.verbose === true });
  if (res && res.success === false) {
    const msg = res.formattedError || res.error || `Dimension "${key}" request failed`;
    throwProbe(lines, typeof msg === 'string' ? msg : 'Dimension probe failed');
  }
  const row = unwrapControllerDimension(res);
  if (!row || !row.key) {
    throwProbe(
      lines,
      `Dimension "${key}" not found in the Controller catalog. Create it with: aifabrix dimension create …`
    );
  }
  appendDimensionSuccessDetail(lines, row, controllerUrl, opts);
  return { row, lines };
}

module.exports = {
  probeDatasourceForProtectionCreate,
  probeDimensionForProtectionCreate,
  unwrapControllerDimension
};
