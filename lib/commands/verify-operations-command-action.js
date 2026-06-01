/**
 * @fileoverview CLI action for `aifabrix verify-operations` (plan 150.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { cliOptsSkipSync } = require('../utils/cli-sync-options');
const { runVerifyOperationsForExternalSystem } = require('./verify-operations-external');
const { displayVerifyOperationsTTY } = require('../lifecycle/report-display');
const { exitCodeFromVerdict } = require('../lifecycle/exit-codes');
const { buildJsonEnvelope } = require('../lifecycle/json-envelope');

/**
 * @param {Object} options
 * @param {import('commander').Command} [cmd]
 * @returns {Object}
 */
function normalizeVerifyOperationsCliOptions(options, cmd) {
  const raw = cmd && Array.isArray(cmd.rawArgs) ? cmd.rawArgs : [];
  const has = flag => raw.includes(flag);
  return {
    env: options.env || 'dev',
    verbose: options.verbose === true || has('-v') || has('--verbose'),
    debug: options.debug === true || has('-d') || has('--debug'),
    json: options.json === true || has('--json'),
    noSync: cliOptsSkipSync(options, cmd),
    continue: options.continue === true || has('--continue'),
    async: options.async !== false
  };
}

async function runVerifyOperationsCommandAction(appName, options, cmd) {
  const opts = normalizeVerifyOperationsCliOptions(options, cmd);
  const result = await runVerifyOperationsForExternalSystem(appName, opts);

  if (opts.json) {
    logger.log(JSON.stringify(buildJsonEnvelope(result, opts.verbose), null, 2));
  } else {
    displayVerifyOperationsTTY(appName, result, {
      details: opts.verbose,
      warnings: result.warnings
    });
  }

  const exitCode = exitCodeFromVerdict(result.verdict);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function verifyOperationsCommandHandler(appName, options, cmd) {
  try {
    await runVerifyOperationsCommandAction(appName, options, cmd);
  } catch (error) {
    handleCommandError(error, 'verify-operations');
    process.exit(3);
  }
}

module.exports = {
  normalizeVerifyOperationsCliOptions,
  runVerifyOperationsCommandAction,
  verifyOperationsCommandHandler
};
