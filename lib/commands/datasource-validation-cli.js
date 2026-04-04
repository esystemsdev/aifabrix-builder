/**
 * @fileoverview Shared CLI handling for unified validation (DatasourceTestRun + exit matrix).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { computeExitCodeFromDatasourceTestRun, exitCodeForPollTimeout } = require('../utils/datasource-test-run-exit');
const { getReportVersionStderrMessage } = require('../utils/datasource-test-run-report-version');
const {
  formatDatasourceTestRunSummary,
  formatDatasourceTestRunTTY
} = require('../utils/datasource-test-run-display');
const {
  resolveDebugDisplayMode,
  formatDatasourceTestRunDebugBlock
} = require('../utils/datasource-test-run-debug-display');

/**
 * Build unified CLI result from integration test return shape.
 * @param {Object} r - runDatasourceTestIntegration result
 * @returns {{ envelope: Object|null, apiError: Object|null, pollTimedOut: boolean, incompleteNoAsync: boolean }}
 */
function unifiedCliResultFromIntegrationReturn(r) {
  const meta = r.runMeta || {};
  return {
    apiError: meta.apiError || null,
    pollTimedOut: meta.pollTimedOut === true,
    incompleteNoAsync: meta.incompleteNoAsync === true,
    envelope: r.datasourceTestRun || null
  };
}

/**
 * Print stderr for reportVersion policy (plan §3.15).
 * @param {Object|null} envelope
 */
function emitReportVersionDiagnostics(envelope) {
  if (!envelope || typeof envelope !== 'object') return;
  const msg = getReportVersionStderrMessage(envelope.reportVersion);
  if (!msg) return;
  if (msg.level === 'warn') logger.warn(chalk.yellow(msg.message));
  else if (msg.level === 'info') logger.log(chalk.gray(msg.message));
}

function exitFromApiError(apiError) {
  logger.error(
    chalk.red('❌ Dataplane request failed:'),
    apiError.formattedError || apiError.error || 'Request failed'
  );
  if (apiError.status) {
    logger.error(chalk.gray(`  HTTP ${apiError.status}`));
  }
  process.exit(3);
}

function exitFromPollTimeout(envelope) {
  logger.error(chalk.red('Report incomplete: timeout'));
  process.exit(exitCodeForPollTimeout(envelope));
}

function exitFromIncompleteNoAsync() {
  logger.error(
    chalk.red(
      'Report incomplete: async polling disabled (--no-async) but server returned partial/minimal report.'
    )
  );
  process.exit(3);
}

function printEnvelope(envelope, options) {
  if (options.json) {
    logger.log(JSON.stringify(envelope));
  } else if (options.summary) {
    logger.log(formatDatasourceTestRunSummary(envelope));
  } else {
    logger.log(formatDatasourceTestRunTTY(envelope));
  }
  if (!options.json) {
    const mode = resolveDebugDisplayMode(options.debug);
    if (mode) {
      const appendix = formatDatasourceTestRunDebugBlock(envelope, mode, process.stdout.isTTY);
      if (appendix) logger.log(appendix);
    }
  }
}

/**
 * Handle unified validation result: logs, stdout JSON, process.exit.
 * @param {Object} result - From runUnifiedDatasourceValidation
 * @param {Object} options - CLI flags
 * @returns {void} Exits process
 */
function exitFromUnifiedValidationResult(result, options = {}) {
  if (result.apiError) {
    exitFromApiError(result.apiError);
    return;
  }
  if (result.pollTimedOut) {
    exitFromPollTimeout(result.envelope);
    return;
  }
  if (result.incompleteNoAsync) {
    exitFromIncompleteNoAsync();
    return;
  }

  const envelope = result.envelope;
  emitReportVersionDiagnostics(envelope);
  printEnvelope(envelope, options);

  const exitCode = computeExitCodeFromDatasourceTestRun(envelope, {
    warningsAsErrors: options.warningsAsErrors === true,
    requireCert: options.requireCert === true
  });
  if (
    exitCode === 2 &&
    options.requireCert &&
    !envelope.certificate
  ) {
    logger.error(chalk.red('Certification not returned; cannot verify.'));
  }
  process.exit(exitCode);
}

/**
 * Exit after integration CLI when not using raw unified output modes.
 * @param {Object} integrationResult - From runDatasourceTestIntegration
 * @param {Object} [exitOpts]
 */
function exitAfterIntegrationDisplay(integrationResult, exitOpts = {}) {
  const env = integrationResult.datasourceTestRun;
  if (!env) {
    process.exit(integrationResult.success ? 0 : 1);
    return;
  }
  const code = computeExitCodeFromDatasourceTestRun(env, {
    warningsAsErrors: exitOpts.warningsAsErrors === true,
    requireCert: exitOpts.requireCert === true
  });
  process.exit(code);
}

module.exports = {
  exitFromUnifiedValidationResult,
  emitReportVersionDiagnostics,
  unifiedCliResultFromIntegrationReturn,
  exitAfterIntegrationDisplay
};
