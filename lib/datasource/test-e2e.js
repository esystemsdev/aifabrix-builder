/**
 * Datasource E2E test - run full E2E test via dataplane external API
 * @fileoverview Datasource E2E test logic (config, credential, sync, data, CIP)
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-statements -- Auth setup, API call, polling, debug log */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getDeviceOnlyAuth } = require('../utils/token-manager');
const { testDatasourceE2E, getE2ETestRun } = require('../api/external-test.api');
const { writeTestLog } = require('../utils/test-log-writer');

const DEFAULT_POLL_INTERVAL_MS = 2500;
const DEFAULT_POLL_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Resolve primaryKeyValue for request body: string as-is, or read and parse JSON from @path
 * @param {string} [value] - Literal value or path prefixed with @ (e.g. @pk.json)
 * @returns {Promise<string|Object|null>} Resolved value for body.primaryKeyValue, or null if absent
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

/**
 * Build E2E request body from options
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Request body
 */
async function buildE2EBody(options) {
  const body = {};
  if (options.debug) body.includeDebug = true;
  if (options.verbose) body.audit = true;
  if (options.testCrud === true) body.testCrud = true;
  if (options.recordId !== undefined && options.recordId !== null && options.recordId !== '') body.recordId = String(options.recordId);
  if (options.cleanup === false) body.cleanup = false;
  else if (options.cleanup === true) body.cleanup = true;
  const pk = await resolvePrimaryKeyValue(options.primaryKeyValue);
  if (pk !== null && pk !== undefined) body.primaryKeyValue = pk;
  return body;
}

/**
 * Poll E2E test run until completed or failed
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} sourceIdOrKey - Source ID or key
 * @param {string} testRunId - Test run ID
 * @param {Object} authConfig - Auth config
 * @param {Object} opts - Poll options
 * @param {number} [opts.intervalMs] - Poll interval (ms)
 * @param {number} [opts.timeoutMs] - Max wait (ms)
 * @param {boolean} [opts.verbose] - Log each poll
 * @returns {Promise<Object>} Final poll result (status completed or failed)
 */
async function pollE2ETestRun(dataplaneUrl, sourceIdOrKey, testRunId, authConfig, opts = {}) {
  const intervalMs = opts.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const verbose = opts.verbose === true;
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await getE2ETestRun(dataplaneUrl, sourceIdOrKey, testRunId, authConfig);
    if (last.status === 'completed' || last.status === 'failed') {
      return last;
    }
    if (verbose) {
      const steps = last.completedActions || [];
      logger.log(chalk.gray(`  Polling… status: ${last.status}, ${steps.length} step(s) completed`));
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(
    `E2E test run did not complete within ${timeoutMs / 1000}s (run ID: ${testRunId})`
  );
}

/**
 * Run E2E test for one datasource (Bearer token or API key required; no client credentials).
 * Default: async start + polling until completed/failed. Use options.async === false for sync.
 *
 * @async
 * @param {string} datasourceKey - Datasource key (used as sourceIdOrKey)
 * @param {Object} options - Options
 * @param {string} [options.app] - App key (or resolve from cwd)
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {boolean} [options.debug] - Include debug, write log file
 * @param {boolean} [options.verbose] - Verbose output (e.g. poll progress)
 * @param {boolean} [options.async] - If false, use sync mode (no polling). Default true.
 * @param {boolean} [options.testCrud] - Set body testCrud true
 * @param {string} [options.recordId] - Set body recordId
 * @param {boolean} [options.cleanup] - Set body cleanup (default true)
 * @param {string} [options.primaryKeyValue] - Set body primaryKeyValue (string or @path to JSON)
 * @param {number} [options.pollIntervalMs] - Poll interval in ms (default 2500)
 * @param {number} [options.pollTimeoutMs] - Poll timeout in ms (default 15 min)
 * @returns {Promise<Object>} E2E test result (steps, success, error, etc.)
 */
async function runDatasourceTestE2E(datasourceKey, options = {}) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  const controllerUrl = await resolveControllerUrl();
  const { resolveEnvironment } = require('../core/config');
  const environment = options.environment || await resolveEnvironment();
  const authConfig = await getDeviceOnlyAuth(controllerUrl);
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);

  logger.log(chalk.blue(`\n🧪 Running E2E test for datasource: ${datasourceKey}`));

  const body = await buildE2EBody(options);
  const useAsync = options.async !== false;
  const requestMeta = {
    sourceIdOrKey: datasourceKey,
    dataplaneUrl,
    includeDebug: options.debug,
    testCrud: options.testCrud,
    recordId: options.recordId,
    cleanup: options.cleanup,
    primaryKeyValue: options.primaryKeyValue !== undefined && options.primaryKeyValue !== null
  };

  const execOpts = {
    dataplaneUrl,
    datasourceKey,
    authConfig,
    body,
    useAsync,
    verbose: options.verbose,
    pollIntervalMs: options.pollIntervalMs,
    pollTimeoutMs: options.pollTimeoutMs
  };
  let data;
  try {
    data = await executeE2EWithOptionalPoll(execOpts);
  } catch (error) {
    if (options.debug) {
      const appPath = getIntegrationPath(appKey);
      const integrationDir = path.dirname(appPath);
      await writeTestLog(appKey, { request: requestMeta, error: error.message }, 'test-e2e', integrationDir);
    }
    throw error;
  }

  if (options.debug) {
    const appPath = getIntegrationPath(appKey);
    const integrationDir = path.dirname(appPath);
    const logPath = await writeTestLog(appKey, { request: requestMeta, response: data }, 'test-e2e', integrationDir);
    logger.log(chalk.gray(`  Debug log: ${logPath}`));
  }

  return data;
}

/**
 * Call E2E API and optionally poll until completed. On throw, caller should log if debug.
 * @param {Object} opts - Options
 * @param {string} opts.dataplaneUrl - Dataplane URL
 * @param {string} opts.datasourceKey - Source key
 * @param {Object} opts.authConfig - Auth config
 * @param {Object} opts.body - Request body
 * @param {boolean} opts.useAsync - Whether to use async + poll
 * @param {boolean} opts.verbose - Verbose poll progress
 * @param {number} [opts.pollIntervalMs] - Override poll interval (ms)
 * @param {number} [opts.pollTimeoutMs] - Override poll timeout (ms)
 * @returns {Promise<Object>} Final result data
 */
/* eslint-disable-next-line max-params -- single opts object; destructuring in body */
async function executeE2EWithOptionalPoll(opts) {
  const { dataplaneUrl, datasourceKey, authConfig, body, useAsync, verbose, pollIntervalMs, pollTimeoutMs } = opts;
  const response = await testDatasourceE2E(dataplaneUrl, datasourceKey, authConfig, body, {
    asyncRun: useAsync
  });
  let data = response.data || response;
  const runId = (data?.testRunId !== null && data?.testRunId !== undefined)
    ? (typeof data.testRunId === 'string' ? data.testRunId : data.testRunId.id || data.testRunId.key)
    : null;
  if (useAsync && runId) {
    data = await pollE2ETestRun(
      dataplaneUrl,
      datasourceKey,
      runId,
      authConfig,
      {
        intervalMs: pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        timeoutMs: pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
        verbose
      }
    );
  }
  return data;
}

module.exports = {
  runDatasourceTestE2E
};
