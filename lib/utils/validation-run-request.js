/**
 * @fileoverview Build ValidationRunRequest bodies for datasource-scoped CLI commands.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Whether the unified validation request should set includeDebug (any `--debug` or `--debug <level>`).
 * @param {*} debugOpt - Commander `options.debug`
 * @returns {boolean}
 */
function includeDebugForRequest(debugOpt) {
  if (debugOpt === undefined || debugOpt === false || debugOpt === null || debugOpt === '') {
    return false;
  }
  return true;
}

/**
 * @param {Object} e2e
 * @param {string} key
 * @param {*} raw
 */
function assignOptionalNonNegativeInt(e2e, key, raw) {
  if (raw === undefined || raw === null || raw === '') {
    return;
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) {
    e2e[key] = n;
  }
}

/**
 * Merge E2E options from CLI flags into e2eOptions for ExternalDataSourceE2ETestRequest (dataplane).
 * @param {Object} options - CLI-derived options
 * @param {boolean} [options.debug]
 * @param {boolean} [options.verbose]
 * @param {boolean} [options.testCrud]
 * @param {string} [options.recordId]
 * @param {boolean} [options.cleanup]
 * @param {string|Object} [options.primaryKeyValue]
 * @param {Object} [options.e2eOptionsExtra] - Shallow-merged last (e.g. server-specific drill-down fields)
 * @returns {Object}
 */
function buildE2eOptionsFromCli(options = {}) {
  const e2e = {};
  if (options.debug) e2e.includeDebug = true;
  if (options.verbose) e2e.audit = true;
  if (options.testCrud === true) e2e.testCrud = true;
  if (options.recordId !== undefined && options.recordId !== null && options.recordId !== '') {
    e2e.recordId = String(options.recordId);
  }
  if (options.cleanup === false) e2e.cleanup = false;
  else if (options.cleanup === true) e2e.cleanup = true;
  if (options.primaryKeyValue !== undefined && options.primaryKeyValue !== null) {
    e2e.primaryKeyValue = options.primaryKeyValue;
  }
  assignOptionalNonNegativeInt(e2e, 'minVectorHits', options.minVectorHits);
  assignOptionalNonNegativeInt(e2e, 'minProcessed', options.minProcessed);
  assignOptionalNonNegativeInt(e2e, 'minRecordCount', options.minRecordCount);
  if (options.e2eOptionsExtra && typeof options.e2eOptionsExtra === 'object') {
    Object.assign(e2e, options.e2eOptionsExtra);
  }
  return e2e;
}

/**
 * Build request body for validationScope=externalDataSource (single datasource in DB).
 * @param {Object} params
 * @param {string} params.systemKey - External system key
 * @param {string} params.datasourceKey - Datasource key
 * @param {'test'|'integration'|'e2e'} params.runType
 * @param {Object} [params.payloadTemplate] - Required for integration-style payload tests when runType=test
 * @param {boolean} [params.asyncRun]
 * @param {boolean} [params.includeDebug]
 * @param {boolean} [params.explain]
 * @param {Object} [params.e2eOptions] - Merged with buildE2eOptionsFromCli when both used by caller
 * @returns {import('../api/types/validation-run.types').ValidationRunRequestBody}
 */
function buildExternalDataSourceValidationRequest(params) {
  const {
    systemKey,
    datasourceKey,
    runType,
    payloadTemplate,
    asyncRun,
    includeDebug,
    explain,
    e2eOptions
  } = params;
  if (!systemKey || !datasourceKey || !runType) {
    throw new Error('systemKey, datasourceKey, and runType are required');
  }
  /** @type {import('../api/types/validation-run.types').ValidationRunRequestBody} */
  const body = {
    validationScope: 'externalDataSource',
    systemIdOrKey: systemKey,
    datasourceKey,
    runType
  };
  if (payloadTemplate !== undefined) body.payloadTemplate = payloadTemplate;
  if (asyncRun === true) body.asyncRun = true;
  if (includeDebug === true) body.includeDebug = true;
  if (explain === true) body.explain = true;
  if (e2eOptions && typeof e2eOptions === 'object' && Object.keys(e2eOptions).length > 0) {
    body.e2eOptions = e2eOptions;
  }
  return body;
}

module.exports = {
  includeDebugForRequest,
  buildE2eOptionsFromCli,
  buildExternalDataSourceValidationRequest
};
