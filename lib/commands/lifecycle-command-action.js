/**
 * @fileoverview CLI action for `aifabrix lifecycle` certification report (plan 150.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { cliOptsSkipSync } = require('../utils/cli-sync-options');
const { runLifecycleForExternalSystem } = require('./lifecycle-external');
const { displayLifecycleReportTTY } = require('../lifecycle/report-display');
const { VERDICT } = require('../lifecycle/product-model');
const { exitCodeFromVerdict } = require('../lifecycle/exit-codes');

/**
 * @param {Object} options
 * @param {import('commander').Command} [cmd]
 * @returns {Object}
 */
function normalizeLifecycleCliOptions(options, cmd) {
  const raw = cmd && Array.isArray(cmd.rawArgs) ? cmd.rawArgs : [];
  const has = flag => raw.includes(flag);
  return {
    env: options.env || 'dev',
    verbose: options.verbose === true || has('-v') || has('--verbose'),
    debug: options.debug === true || has('-d') || has('--debug'),
    json: options.json === true || has('--json'),
    run: options.run === true || has('--run'),
    noSync: cliOptsSkipSync(options, cmd),
    force: options.force === true || has('--force')
  };
}

/**
 * @param {Object} report
 * @returns {string}
 */
function lifecycleVerdictFromReport(report) {
  const ops = report.operations?.verdict;
  const trust = report.trust?.verdict;
  const gov = report.governance?.verdict;
  if (ops === VERDICT.FAILED || trust === VERDICT.FAILED || gov === VERDICT.FAILED) {
    return VERDICT.FAILED;
  }
  if (
    ops === VERDICT.VERIFIED &&
    trust === VERDICT.VERIFIED &&
    gov === VERDICT.VERIFIED
  ) {
    return VERDICT.VERIFIED;
  }
  return VERDICT.NOT_VERIFIED;
}

async function runLifecycleCommandAction(appName, options, cmd) {
  const opts = normalizeLifecycleCliOptions(options, cmd);
  const result = await runLifecycleForExternalSystem(appName, opts);
  const report = result.report;

  if (opts.json) {
    const envelope = {
      systemKey: result.systemKey,
      command: 'lifecycle',
      certification: report.certification,
      operations: report.operations,
      trust: report.trust,
      governance: report.governance,
      recommendations: report.recommendations,
      warnings: report.warnings,
      stepsRun: result.stepsRun
    };
    if (opts.verbose) {
      envelope.datasources = report.datasources;
    }
    logger.log(JSON.stringify(envelope, null, 2));
  } else {
    displayLifecycleReportTTY(result.systemKey, report, { details: opts.verbose });
  }

  const pillarVerdict = lifecycleVerdictFromReport(report);
  const exitCode =
    pillarVerdict === VERDICT.VERIFIED
      ? 0
      : exitCodeFromVerdict(pillarVerdict, { partial: pillarVerdict === VERDICT.NOT_VERIFIED });
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function lifecycleCommandHandler(appName, options, cmd) {
  try {
    await runLifecycleCommandAction(appName, options, cmd);
  } catch (error) {
    handleCommandError(error, 'lifecycle');
    process.exit(3);
  }
}

module.exports = {
  normalizeLifecycleCliOptions,
  runLifecycleCommandAction,
  lifecycleCommandHandler,
  lifecycleVerdictFromReport
};
