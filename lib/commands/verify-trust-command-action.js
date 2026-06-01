/**
 * @fileoverview CLI action for `aifabrix verify-trust` (plan 150.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { runVerifyTrustForExternalSystem } = require('./verify-trust-external');
const { normalizeTestTrustCliOptions } = require('./test-trust-cli-options');
const { displayVerifyTrustTTY } = require('../lifecycle/report-display');
const { exitCodeFromVerdict } = require('../lifecycle/exit-codes');
const { buildJsonEnvelope } = require('../lifecycle/json-envelope');

async function runVerifyTrustCommandAction(appName, options, cmd) {
  const opts = normalizeTestTrustCliOptions(options, cmd);
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(appName).catch(() => null);
  if (!appType || appType.baseDir !== 'integration') {
    throw new Error(
      'verify-trust applies to external integration folders only (integration/<systemKey>/).'
    );
  }

  const result = await runVerifyTrustForExternalSystem(appName, {
    env: opts.env,
    verbose: opts.verbose,
    debug: opts.debug,
    noSync: opts.noSync === true,
    revalidate: opts.revalidate === true,
    timeout: opts.timeout
  });

  if (opts.json) {
    const envelope = buildJsonEnvelope(
      {
        systemKey: result.systemKey,
        command: result.command,
        verdict: result.verdict,
        businessContextConfidencePercent: result.businessContextConfidencePercent,
        datasourceRows: opts.details ? result.datasourceRows : undefined
      },
      opts.details || opts.verbose
    );
    logger.log(JSON.stringify(envelope, null, 2));
  } else {
    displayVerifyTrustTTY(result.systemKey, result, { details: opts.verbose || opts.details });
  }

  const exitCode = exitCodeFromVerdict(result.verdict);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function verifyTrustCommandHandler(appName, options, cmd) {
  try {
    await runVerifyTrustCommandAction(appName, options, cmd);
  } catch (error) {
    handleCommandError(error, 'verify-trust');
    process.exit(3);
  }
}

module.exports = {
  runVerifyTrustCommandAction,
  verifyTrustCommandHandler
};
