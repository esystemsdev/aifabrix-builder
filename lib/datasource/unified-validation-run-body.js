/**
 * @fileoverview Build ValidationRunRequest body for unified datasource runs.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  buildExternalDataSourceValidationRequest,
  buildE2eOptionsFromCli,
  includeDebugForRequest
} = require('../utils/validation-run-request');
const testHelpers = require('../utils/external-system-test-helpers');

/**
 * @param {Object} params
 * @param {string} params.systemKey
 * @param {string} params.datasourceKey
 * @param {'test'|'integration'|'e2e'} params.runType
 * @param {Object} params.datasource - Loaded datasource config
 * @param {string} [params.payloadPath]
 * @param {boolean} params.useAsync
 * @param {Object} params.options - CLI options (debug, verbose, e2e fields, capabilityKey)
 * @returns {Promise<import('../api/types/validation-run.types').ValidationRunRequestBody>}
 */
async function buildUnifiedValidationBody(params) {
  const { systemKey, datasourceKey, runType, datasource, payloadPath, useAsync, options } = params;

  let payloadTemplate;
  if (payloadPath || runType === 'integration') {
    const customPayload = await testHelpers.loadCustomPayload(payloadPath);
    payloadTemplate = testHelpers.determinePayloadTemplate(datasource, datasourceKey, customPayload);
    if (runType === 'integration' && !payloadTemplate) {
      throw new Error(`No test payload found for datasource '${datasourceKey}'`);
    }
  }

  const e2eExtra = options.capabilityKey
    ? { capabilityKeys: [String(options.capabilityKey).trim()] }
    : undefined;
  const e2eOptions =
    runType === 'e2e'
      ? buildE2eOptionsFromCli({
        debug: options.debug,
        verbose: options.verbose,
        cleanup: options.cleanup,
        primaryKeyValue: options.primaryKeyValue,
        runScenarios: options.runScenarios,
        minVectorHits: options.minVectorHits,
        minProcessed: options.minProcessed,
        minRecordCount: options.minRecordCount,
        e2eOptionsExtra: e2eExtra
      })
      : undefined;

  return buildExternalDataSourceValidationRequest({
    systemKey,
    datasourceKey,
    runType,
    payloadTemplate,
    asyncRun: runType === 'e2e' && useAsync === true,
    includeDebug: includeDebugForRequest(options.debug),
    explain: options.verbose === true,
    e2eOptions: e2eOptions && Object.keys(e2eOptions).length > 0 ? e2eOptions : undefined
  });
}

module.exports = { buildUnifiedValidationBody };
