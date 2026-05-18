/**
 * @fileoverview CLI action for `aifabrix test-trust` (plan 143).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { runTestTrustForExternalSystem } = require('./test-trust-external');
const { displaySystemTrustRollupTTY } = require('../utils/agent-trust-run-display');
const { computeSystemExitCodeFromTrustRows } = require('../utils/agent-trust-run-exit');

/**
 * @async
 * @param {string} appName
 * @param {Object} options
 */
async function runTestTrustCommandAction(appName, options) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(appName).catch(() => null);
  if (!appType || appType.baseDir !== 'integration') {
    throw new Error(
      'test-trust applies to external integration folders only (integration/<systemKey>/).'
    );
  }
  const { success, results, systemKey } = await runTestTrustForExternalSystem(appName, {
    env: options.env,
    verbose: options.verbose,
    debug: options.debug,
    noSync: options.noSync === true,
    revalidate: options.revalidate === true,
    summary: options.summary === true,
    timeout: options.timeout
  });
  if (options.json) {
    logger.log(JSON.stringify(results, null, 2));
  } else if (!options.summary) {
    displaySystemTrustRollupTTY(systemKey || appName, results, {
      strict: options.strict === true
    });
  } else {
    for (const row of results) {
      const tr = row.trustRun;
      const line = tr
        ? `${row.key}: ${tr.trustDecision} (${tr.validationStatus})`
        : `${row.key}: fail (${row.error || 'error'})`;
      logger.log(line);
    }
  }
  const exitCode = computeSystemExitCodeFromTrustRows(results, {
    warningsAsErrors: options.warningsAsErrors === true,
    strict: options.strict === true
  });
  if (exitCode !== 0) process.exit(exitCode);
  if (!success) process.exit(1);
}

async function testTrustCommandHandler(appName, options) {
  try {
    await runTestTrustCommandAction(appName, options);
  } catch (error) {
    handleCommandError(error, 'test-trust');
    process.exit(3);
  }
}

module.exports = {
  runTestTrustCommandAction,
  testTrustCommandHandler
};
