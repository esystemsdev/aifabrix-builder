/**
 * @fileoverview CLI action for `aifabrix test-trust` (plan 143).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { runTestTrustForExternalSystem } = require('./test-trust-external');
const {
  displaySystemTrustRollupTTY,
  displayAgentTrustRunTTY
} = require('../utils/agent-trust-run-display');
const { computeSystemExitCodeFromTrustRows } = require('../utils/agent-trust-run-exit');
const { writeTrustDebugLogAndPrint } = require('../datasource/agent-trust-debug-log');
const { normalizeTestTrustCliOptions } = require('./test-trust-cli-options');

/**
 * @async
 * @param {string} appName
 * @param {Object} options
 */
async function writeSystemTrustDebugLogs(appName, results, options) {
  if (!options.debug) return;
  logger.log('');
  logger.log(chalk.gray('Debug logs:'));
  for (const row of results) {
    await writeTrustDebugLogAndPrint(appName, row.key, {
      request: {
        datasourceKey: row.key,
        revalidate: options.revalidate === true,
        noSync: options.noSync === true
      },
      response: row.trustRun,
      error: row.error || null
    });
  }
}

function displaySystemTrustResults(systemKey, appName, results, options) {
  if (options.json) {
    logger.log(JSON.stringify(results, null, 2));
    return;
  }
  if (options.summary) {
    for (const row of results) {
      const tr = row.trustRun;
      const line = tr
        ? `${row.key}: ${tr.trustDecision} (${tr.validationStatus})`
        : `${row.key}: fail (${row.error || 'error'})`;
      logger.log(line);
    }
    return;
  }

  const displayOpts = {
    strict: options.strict === true,
    showCache: options.verbose === true || options.revalidate === true
  };
  displaySystemTrustRollupTTY(systemKey || appName, results, displayOpts);

  if (!options.verbose) return;

  for (const row of results) {
    if (!row.trustRun) continue;
    displayAgentTrustRunTTY(row.trustRun, {
      environment: options.env,
      verbose: true,
      noSync: options.noSync === true,
      strict: options.strict === true
    });
  }
}

async function runTestTrustCommandAction(appName, options, cmd) {
  const opts = normalizeTestTrustCliOptions(options, cmd);
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(appName).catch(() => null);
  if (!appType || appType.baseDir !== 'integration') {
    throw new Error(
      'test-trust applies to external integration folders only (integration/<systemKey>/).'
    );
  }
  const { success, results, systemKey } = await runTestTrustForExternalSystem(appName, {
    env: opts.env,
    verbose: opts.verbose,
    debug: opts.debug,
    noSync: opts.noSync === true,
    revalidate: opts.revalidate === true,
    summary: opts.summary === true,
    timeout: opts.timeout
  });
  displaySystemTrustResults(systemKey, appName, results, opts);
  await writeSystemTrustDebugLogs(appName, results, opts);
  const exitCode = computeSystemExitCodeFromTrustRows(results, {
    warningsAsErrors: opts.warningsAsErrors === true,
    strict: opts.strict === true
  });
  if (exitCode !== 0) process.exit(exitCode);
  if (!success) process.exit(1);
}

async function testTrustCommandHandler(appName, options, cmd) {
  try {
    await runTestTrustCommandAction(appName, options, cmd);
  } catch (error) {
    handleCommandError(error, 'test-trust');
    process.exit(3);
  }
}

module.exports = {
  runTestTrustCommandAction,
  testTrustCommandHandler
};
