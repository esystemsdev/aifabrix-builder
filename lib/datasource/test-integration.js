/**
 * Datasource integration test — unified dataplane validation (runType=integration).
 * @fileoverview Datasource integration test logic
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const {
  getSystemKeyFromAppKey,
  findDatasourceFileByKey
} = require('./integration-context');
const { runUnifiedDatasourceValidation } = require('./unified-validation-run');
const { integrationResultFromEnvelope } = require('../utils/datasource-test-run-legacy-adapter');
const { writeTestLog } = require('../utils/test-log-writer');

/**
 * @param {string} appKey - Integration folder name (same as --app; system key in publish flows)
 * @returns {Promise<string>} systemKey
 */
async function getSystemKeyFromAppKeyExport(appKey) {
  return getSystemKeyFromAppKey(appKey);
}

function legacyFailureShell(datasourceKey, systemKey, error, datasourceTestRun, runMeta) {
  return {
    key: datasourceKey,
    systemKey,
    success: false,
    skipped: false,
    validationResults: {},
    fieldMappingResults: {},
    endpointTestResults: {},
    error,
    datasourceTestRun,
    runMeta
  };
}

/**
 * @returns {{ body: Object, apiErrMsg?: string }|null}
 */
function integrationEarlyExitBody(datasourceKey, systemKey, unifiedResult, runMeta) {
  if (unifiedResult.apiError) {
    const errMsg =
      unifiedResult.apiError.formattedError ||
      unifiedResult.apiError.error ||
      'Request failed';
    return {
      body: legacyFailureShell(datasourceKey, systemKey, errMsg, null, runMeta),
      apiErrMsg: errMsg
    };
  }
  if (unifiedResult.pollTimedOut) {
    return {
      body: legacyFailureShell(
        datasourceKey,
        systemKey,
        'Report incomplete: timeout',
        unifiedResult.envelope,
        runMeta
      )
    };
  }
  if (unifiedResult.incompleteNoAsync) {
    return {
      body: legacyFailureShell(
        datasourceKey,
        systemKey,
        'Report incomplete (async required)',
        unifiedResult.envelope,
        runMeta
      )
    };
  }
  return null;
}

/**
 * Run integration test for one datasource (unified validation API).
 * @async
 * @param {string} datasourceKey - Datasource key
 * @param {Object} options - Options
 * @param {string} [options.app] - App key (or resolve from cwd)
 * @param {string} [options.payload] - Path to custom payload file
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {boolean} [options.verbose] - explain=true on request
 * @param {boolean|string} [options.debug] - Truthy enables includeDebug and log file; string `summary`|`full`|`raw` selects TTY appendix (CLI)
 * @param {number|string} [options.timeout] - Aggregate timeout ms
 * @returns {Promise<Object>} Legacy-shaped result + datasourceTestRun / runMeta when present
 */
async function runDatasourceTestIntegration(datasourceKey, options = {}) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  const systemKey = await getSystemKeyFromAppKey(appKey);

  logger.log(chalk.blue(`\n📡 Testing datasource: ${datasourceKey} (system: ${systemKey})`));

  const unifiedResult = await runUnifiedDatasourceValidation(datasourceKey, {
    app: options.app,
    environment: options.environment,
    runType: 'integration',
    payload: options.payload,
    debug: options.debug,
    verbose: options.verbose,
    timeout: options.timeout,
    async: true,
    noAsync: false
  });

  const runMeta = {
    apiError: unifiedResult.apiError,
    pollTimedOut: unifiedResult.pollTimedOut,
    incompleteNoAsync: unifiedResult.incompleteNoAsync
  };

  const early = integrationEarlyExitBody(datasourceKey, systemKey, unifiedResult, runMeta);
  if (early) {
    if (early.apiErrMsg && options.debug) {
      await writeTestLog(
        appKey,
        { request: { systemKey, datasourceKey }, error: early.apiErrMsg },
        'test-integration'
      );
    }
    return early.body;
  }

  const legacy = integrationResultFromEnvelope(unifiedResult.envelope, datasourceKey);
  legacy.systemKey = systemKey;
  legacy.datasourceTestRun = unifiedResult.envelope;
  legacy.runMeta = { apiError: null, pollTimedOut: false, incompleteNoAsync: false };

  if (options.debug && unifiedResult.envelope) {
    const logPath = await writeTestLog(
      appKey,
      {
        request: { systemKey, datasourceKey, includeDebug: true },
        response: unifiedResult.envelope
      },
      'test-integration'
    );
    logger.log(chalk.gray(`  Debug log: ${logPath}`));
  }

  return legacy;
}

module.exports = {
  runDatasourceTestIntegration,
  getSystemKeyFromAppKey: getSystemKeyFromAppKeyExport,
  findDatasourceFileByKey
};
