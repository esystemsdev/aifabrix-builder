/**
 * Helpers for system-level pipeline test mapping (keeps runSystemLevelTest under max-lines-per-function).
 * @fileoverview
 */
'use strict';

const { integrationResultFromEnvelope } = require('../utils/datasource-test-run-legacy-adapter');

/**
 * Build a single failure-shaped datasource result row.
 * @param {string} error
 * @returns {Object}
 */
function systemFailureRow(error) {
  return {
    key: 'system',
    success: false,
    skipped: false,
    validationResults: {},
    fieldMappingResults: {},
    endpointTestResults: {},
    error
  };
}

/**
 * Map unified envelope-style response to datasourceResults.
 * @param {Object} data
 * @param {string} datasourceKey
 * @returns {{ success: boolean, datasourceResults: Object[] }}
 */
function mapEnvelopeSingleDatasource(data, datasourceKey) {
  const legacy = integrationResultFromEnvelope(data, datasourceKey);
  return {
    success: legacy.success,
    datasourceResults: [
      {
        key: legacy.key,
        success: legacy.success,
        skipped: legacy.skipped,
        validationResults: legacy.validationResults,
        fieldMappingResults: legacy.fieldMappingResults,
        endpointTestResults: legacy.endpointTestResults,
        error: legacy.error,
        envelope: legacy.envelope
      }
    ]
  };
}

/**
 * Map legacy array-shaped results to normalized datasource rows.
 * @param {Array} rawResults
 * @param {Object} data
 * @returns {{ success: boolean, datasourceResults: Object[] }}
 */
function mapLegacyRawResults(rawResults, data) {
  const datasourceResults = [];
  let success = true;

  for (const r of rawResults) {
    const dsKey = r.key || r.sourceKey || r.name || r.datasourceKey;
    const dsResult = {
      key: dsKey,
      success: r.success !== false,
      skipped: !!r.skipped,
      reason: r.reason,
      validationResults: r.validationResults || {},
      fieldMappingResults: r.fieldMappingResults || {},
      endpointTestResults: r.endpointTestResults || {}
    };
    if (r.error) dsResult.error = r.error;
    if (!dsResult.success && !dsResult.skipped) success = false;
    datasourceResults.push(dsResult);
  }

  if (rawResults.length === 0 && data.success === false) {
    success = false;
    datasourceResults.push(
      systemFailureRow(data.error || data.formattedError || 'System test failed')
    );
  }

  return { success, datasourceResults };
}

/**
 * Normalize pipeline response body to { success, datasourceResults }.
 * @param {Object} data
 * @returns {{ success: boolean, datasourceResults: Object[] }}
 */
function mapPipelineDataToDatasourceResults(data) {
  if (
    data &&
    typeof data === 'object' &&
    typeof data.status === 'string' &&
    typeof data.datasourceKey === 'string'
  ) {
    return mapEnvelopeSingleDatasource(data, data.datasourceKey);
  }

  const rawResults =
    data.datasourceResults || data.results || data.data?.datasourceResults || (Array.isArray(data) ? data : []);
  return mapLegacyRawResults(rawResults, data);
}

module.exports = {
  systemFailureRow,
  mapPipelineDataToDatasourceResults
};
