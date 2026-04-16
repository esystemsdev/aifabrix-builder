/**
 * @fileoverview Dispatch rules for external test-integration (system vs per-datasource POST /validation/run).
 */

'use strict';

/**
 * Use one externalSystem-scoped validation run when multiple datasources exist (default).
 * Per-datasource runs when {@code options.perDatasource}, a datasource filter, or custom payload is set.
 *
 * @param {Object} options - CLI options
 * @param {string} [options.datasource] - Single-datasource filter
 * @param {boolean} [options.perDatasource] - Force one POST per datasource (externalDataSource scope)
 * @param {Array<{data?: Object}>} datasourcesToTest - Entries from manifest
 * @param {*} customPayload - Parsed payload from {@code --payload}, or null
 * @returns {boolean}
 */
function shouldUseSystemLevelIntegrationCall(options, datasourcesToTest, customPayload) {
  const noDatasourceFilter = !options || !options.datasource;
  const multi = Array.isArray(datasourcesToTest) && datasourcesToTest.length > 1;
  const noCustomPayload = customPayload === null || customPayload === undefined;
  const forcePerDs = options && options.perDatasource === true;
  return noDatasourceFilter && multi && noCustomPayload && !forcePerDs;
}

module.exports = { shouldUseSystemLevelIntegrationCall };
