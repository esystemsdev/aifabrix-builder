/**
 * @fileoverview System-level unified validation runner for external systems (aggregate layer).
 *
 * Preferred behavior is a single externalSystem-scoped POST that returns an aggregate body.
 * Until that aggregate is guaranteed everywhere, this module performs the plan §2.2 “interim”
 * strategy: fan-out datasource-scoped runs and merge into a single system result.
 */

'use strict';

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { writeTestLog } = require('../utils/test-log-writer');
const { getIntegrationPath } = require('../utils/paths');
const { runUnifiedDatasourceValidation } = require('../datasource/unified-validation-run');

async function runOneDatasourceKey(appName, datasourceKey, opts) {
  const { environment, runType, debug, timeoutMs } = opts;
  try {
    const uni = await runUnifiedDatasourceValidation(datasourceKey, {
      app: appName,
      environment,
      runType,
      debug,
      verbose: false,
      timeout: timeoutMs,
      async: true,
      noAsync: false
    });

    if (uni.apiError) {
      return {
        key: datasourceKey,
        success: false,
        skipped: false,
        error: uni.apiError.formattedError || uni.apiError.error || 'Request failed',
        datasourceTestRun: null
      };
    }
    if (uni.pollTimedOut) {
      return {
        key: datasourceKey,
        success: false,
        skipped: false,
        error: 'Report incomplete: timeout',
        datasourceTestRun: uni.envelope
      };
    }
    if (uni.incompleteNoAsync) {
      return {
        key: datasourceKey,
        success: false,
        skipped: false,
        error: 'Report incomplete (async required)',
        datasourceTestRun: uni.envelope
      };
    }
    const env = uni.envelope;
    const ok = env && typeof env.status === 'string' ? env.status !== 'fail' : false;
    return { key: datasourceKey, success: ok, skipped: false, datasourceTestRun: env };
  } catch (err) {
    return { key: datasourceKey, success: false, skipped: false, error: err.message };
  }
}

async function maybeWriteSystemRunLog(appName, systemKey, datasourceKeys, runType, debug, payload) {
  if (!debug) return;
  const appPath = getIntegrationPath(appName);
  const integrationDir = path.dirname(appPath);
  const logPath = await writeTestLog(
    appName,
    { request: { systemKey, datasourceKeys, runType, includeDebug: true }, response: payload },
    runType === 'e2e' ? 'test-e2e' : 'test-integration',
    integrationDir
  );
  logger.log(chalk.gray(`  Debug log: ${logPath}`));
}

/**
 * Run system-level pipeline test and map response to datasource results
 * @async
 * @param {Object} params - Parameters
 * @param {string} params.appName - Application name
 * @param {string} params.systemKey - System key
 * @param {Object} params.authConfig - Auth config
 * @param {string} params.dataplaneUrl - Dataplane URL
 * @param {boolean} [params.debug] - Write debug log
 * @param {number} [params.timeout] - Request timeout
 * @returns {Promise<{success: boolean, datasourceResults: Object[]}>}
 */
async function runSystemLevelTest({ appName, systemKey, datasourceKeys, environment, runType, debug, timeout }) {
  if (!Array.isArray(datasourceKeys) || datasourceKeys.length === 0) {
    return { success: true, datasourceResults: [] };
  }
  const timeoutMs = Number.isFinite(timeout) ? timeout : 30000;

  const results = [];
  for (const key of datasourceKeys) {
    // Keep sequential to avoid spiking external APIs / dataplane concurrency in CLI runs.
    // (Plan allows parallel later, but UX needs stable logs first.)
    // eslint-disable-next-line no-await-in-loop -- intentional sequential execution
    results.push(await runOneDatasourceKey(appName, key, { environment, runType, debug, timeoutMs }));
  }

  const success = results.every(r => r.success);
  await maybeWriteSystemRunLog(appName, systemKey, datasourceKeys, runType, debug, { success, results });

  return { success, datasourceResults: results };
}

module.exports = { runSystemLevelTest };
