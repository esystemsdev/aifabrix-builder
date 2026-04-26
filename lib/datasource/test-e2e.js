/**
 * Datasource E2E test — unified POST /api/v1/validation/run (runType=e2e).
 * @fileoverview Datasource E2E via DatasourceTestRun envelope
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const { infoLine } = require('../utils/cli-test-layout-chalk');
const { runUnifiedDatasourceValidation } = require('./unified-validation-run');
const { includeDebugForRequest } = require('../utils/validation-run-request');
const { e2eShapeFromEnvelope } = require('../utils/datasource-test-run-legacy-adapter');
const { writeTestLog } = require('../utils/test-log-writer');

const DEFAULT_POLL_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * @param {Object} options
 * @param {string|number} timeoutMs
 * @param {string|Object|null} pk
 */
function buildUnifiedE2eRunOptions(options, timeoutMs, pk) {
  return {
    app: options.app,
    environment: options.environment,
    runType: 'e2e',
    debug: options.debug,
    verbose: options.verbose,
    async: options.async !== false,
    noAsync: options.async === false,
    testCrud: options.testCrud,
    recordId: options.recordId,
    cleanup: options.cleanup,
    primaryKeyValue: pk,
    minVectorHits: options.minVectorHits,
    minProcessed: options.minProcessed,
    minRecordCount: options.minRecordCount,
    capabilityKey: options.capabilityKey,
    timeout: timeoutMs,
    sync: options.sync === true
  };
}

function logE2eDatasourceBanner(datasourceKey, verbose) {
  if (!verbose) return;
  logger.log('');
  logger.log(infoLine(`🧪 Running E2E test for datasource: ${datasourceKey}`));
}

/**
 * Resolve primaryKeyValue for request body: string as-is, or read and parse JSON from @path
 * @param {string} [value]
 * @returns {Promise<string|Object|null>}
 */
async function resolvePrimaryKeyValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (str.startsWith('@')) {
    const filePath = path.resolve(str.slice(1).trim());
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }
  return str;
}

function e2eIntegrationLogDir(appKey) {
  return path.dirname(getIntegrationPath(appKey));
}

/**
 * @param {Object} options
 * @returns {number}
 */
function resolveE2ePollTimeoutMs(options) {
  const raw =
    options.timeout !== undefined && options.timeout !== null && options.timeout !== ''
      ? parseInt(String(options.timeout), 10)
      : options.pollTimeoutMs;
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_POLL_TIMEOUT_MS;
}

/**
 * @param {string} datasourceKey
 * @param {Object} options
 * @param {string|Object|null} pk
 * @returns {Object}
 */
function buildE2eRequestMeta(datasourceKey, options, pk) {
  return {
    datasourceKey,
    runType: 'e2e',
    includeDebug: includeDebugForRequest(options.debug),
    testCrud: options.testCrud,
    recordId: options.recordId,
    cleanup: options.cleanup,
    primaryKeyValue: pk !== undefined && pk !== null,
    minVectorHits: options.minVectorHits,
    minProcessed: options.minProcessed,
    minRecordCount: options.minRecordCount
  };
}

/**
 * Write JSON debug log and print paths + CLI wall clock when --debug.
 * @param {string} appKey
 * @param {Object} requestMeta
 * @param {Object} envelope
 * @param {number} cliWallSeconds
 * @returns {Promise<void>}
 */
async function logE2eDebugSuccess(appKey, requestMeta, envelope, cliWallSeconds) {
  const logPath = await writeTestLog(
    appKey,
    { request: { ...requestMeta, cliWallSeconds }, response: envelope },
    'test-e2e',
    e2eIntegrationLogDir(appKey)
  );
  logger.log(chalk.gray(`  Debug log: ${logPath}`));
  logger.log(
    chalk.gray(`  CLI wall time: ${cliWallSeconds}s (URL resolve, POST, poll, log write)`)
  );
}

/**
 * Throw when unified run failed, timed out, or needs async; optionally write debug log.
 * @returns {Promise<void>}
 */
async function throwIfUnifiedE2EBlocked(unifiedResult, appKey, options, requestMeta) {
  if (unifiedResult.apiError) {
    const msg =
      unifiedResult.apiError.formattedError ||
      unifiedResult.apiError.error ||
      'E2E request failed';
    if (options.debug) {
      await writeTestLog(
        appKey,
        { request: requestMeta, error: msg },
        'test-e2e',
        e2eIntegrationLogDir(appKey)
      );
    }
    throw new Error(msg);
  }
  if (unifiedResult.pollTimedOut) {
    const err = new Error('Report incomplete: timeout');
    if (options.debug) {
      await writeTestLog(
        appKey,
        { request: requestMeta, error: err.message },
        'test-e2e',
        e2eIntegrationLogDir(appKey)
      );
    }
    throw err;
  }
  if (unifiedResult.incompleteNoAsync) {
    throw new Error(
      'Report incomplete: async polling disabled (--no-async) but server returned partial report.'
    );
  }
}

/**
 * Run E2E for one datasource (unified validation API).
 * @returns {Promise<Object>} displayE2EResults-compatible shape
 */
async function runDatasourceTestE2E(datasourceKey, options = {}) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const cliWallStartedAt = Date.now();
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  logE2eDatasourceBanner(datasourceKey, options.verbose);
  const pk = await resolvePrimaryKeyValue(options.primaryKeyValue);
  const timeoutMs = resolveE2ePollTimeoutMs(options);
  const requestMeta = buildE2eRequestMeta(datasourceKey, options, pk);
  const unifiedResult = await runUnifiedDatasourceValidation(
    datasourceKey,
    buildUnifiedE2eRunOptions(options, timeoutMs, pk)
  );

  await throwIfUnifiedE2EBlocked(unifiedResult, appKey, options, requestMeta);

  const display = e2eShapeFromEnvelope(unifiedResult.envelope);
  Object.assign(display, { datasourceTestRun: unifiedResult.envelope });

  if (options.debug) {
    const cliWallSeconds = Math.round((Date.now() - cliWallStartedAt) / 10) / 100;
    await logE2eDebugSuccess(appKey, requestMeta, unifiedResult.envelope, cliWallSeconds);
  }

  return display;
}

module.exports = {
  runDatasourceTestE2E,
  resolvePrimaryKeyValue
};
