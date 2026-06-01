/**
 * @fileoverview CLI action for `aifabrix verify-governance` (plan 150.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { runVerifyGovernanceForExternalSystem } = require('./verify-governance-external');
const { normalizeTestGovernanceCliOptions } = require('./test-governance-cli-options');
const { displayVerifyGovernanceTTY } = require('../lifecycle/report-display');
const { exitCodeFromVerdict } = require('../lifecycle/exit-codes');
const { buildJsonEnvelope } = require('../lifecycle/json-envelope');

async function runVerifyGovernanceCommandAction(appName, options, cmd) {
  const opts = normalizeTestGovernanceCliOptions(options, cmd);
  const result = await runVerifyGovernanceForExternalSystem(appName, {
    env: opts.env,
    verbose: opts.verbose,
    noSync: opts.noSync === true,
    pack: opts.pack,
    app: opts.app,
    scenarioIds: opts.scenarioIds
  });

  if (opts.json) {
    logger.log(JSON.stringify(buildJsonEnvelope(result, opts.verbose), null, 2));
  } else {
    displayVerifyGovernanceTTY(result.systemKey, result, { details: opts.verbose });
  }

  const exitCode = exitCodeFromVerdict(result.verdict);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function verifyGovernanceCommandHandler(appName, options, cmd) {
  try {
    await runVerifyGovernanceCommandAction(appName, options, cmd);
  } catch (error) {
    handleCommandError(error, 'verify-governance');
    process.exit(3);
  }
}

module.exports = {
  runVerifyGovernanceCommandAction,
  verifyGovernanceCommandHandler
};
