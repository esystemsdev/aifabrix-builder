/**
 * @fileoverview Run one persisted datasource through the dataplane unified validation flow (POST + optional poll via `lib/api/validation-run.api.js`).
 *
 * **CLI:** `aifabrix datasource test`, `test-integration`, and `test-e2e` use this module with different `runType` values.
 * **User-facing permissions:** see `docs/commands/permissions.md` (Dataplane scopes may differ from the minimum noted on the HTTP helper JSDoc).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { resolveAppKeyForDatasource } = require('./resolve-app');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { getConfig } = require('../core/config');
const { getSystemKeyFromAppKey, findDatasourceFileByKey } = require('./integration-context');
const { loadDatasourceForApp } = require('./unified-validation-run-resolve');
const { buildUnifiedValidationBody } = require('./unified-validation-run-body');
const { postValidationRunAndOptionalPoll } = require('./unified-validation-run-post');

/**
 * Resolve datasource JSON path and loaded object (same rules as test-integration).
 * Re-export for tests.
 */
function loadDatasourceForAppExport(appKey, datasourceKey) {
  return loadDatasourceForApp(appKey, datasourceKey, findDatasourceFileByKey);
}

/**
 * Run unified validation for one persisted datasource.
 * @async
 * @param {string} datasourceKey
 * @param {Object} options
 * @returns {Promise<{ envelope: Object|null, apiError: Object|null, pollTimedOut: boolean, incompleteNoAsync: boolean }>}
 */
async function runUnifiedDatasourceValidation(datasourceKey, options) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const runType = options.runType || 'test';
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  const systemKey = await getSystemKeyFromAppKey(appKey);
  const { datasource } = loadDatasourceForAppExport(appKey, datasourceKey);

  const configObj = await getConfig();
  const { authConfig, dataplaneUrl } = await setupIntegrationTestAuth(appKey, options, configObj);

  const useAsync = options.noAsync ? false : options.async !== false;
  const timeoutMs = parseInt(String(options.timeout || '30000'), 10) || 30000;

  const body = await buildUnifiedValidationBody({
    systemKey,
    datasourceKey,
    runType,
    datasource,
    payloadPath: options.payload,
    useAsync,
    options
  });

  return postValidationRunAndOptionalPoll({
    dataplaneUrl,
    authConfig,
    body,
    timeoutMs,
    useAsync,
    noAsync: options.noAsync === true || options.async === false
  });
}

module.exports = {
  runUnifiedDatasourceValidation,
  loadDatasourceForApp: loadDatasourceForAppExport
};
