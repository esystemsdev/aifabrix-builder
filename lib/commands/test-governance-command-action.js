/**
 * @fileoverview CLI action for `aifabrix test-governance` (plan 406)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { handleCommandError } = require('../utils/cli-utils');
const { runTestGovernanceForExternalSystem } = require('./test-governance-external');
const { normalizeTestGovernanceCliOptions } = require('./test-governance-cli-options');
const {
  displayGovernanceRunTTY,
  printGovernanceRunJson,
  exitCodeFromGovernanceSummary
} = require('../governance/governance-run-display');

/**
 * @async
 * @param {string} appName
 * @param {Object} options
 * @param {import('commander').Command} [cmd]
 */
async function runTestGovernanceCommandAction(appName, options, cmd) {
  const opts = normalizeTestGovernanceCliOptions(options, cmd);
  const { result, packPath, systemKey } = await runTestGovernanceForExternalSystem(appName, opts);

  if (opts.json) {
    printGovernanceRunJson(result);
  } else {
    displayGovernanceRunTTY(systemKey, result, {
      verbose: opts.verbose,
      packPath
    });
  }

  const exitCode = exitCodeFromGovernanceSummary(result.summary);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function testGovernanceCommandHandler(appName, options, cmd) {
  try {
    await runTestGovernanceCommandAction(appName, options, cmd);
  } catch (error) {
    handleCommandError(error, 'test-governance');
    process.exit(3);
  }
}

module.exports = {
  runTestGovernanceCommandAction,
  testGovernanceCommandHandler
};
