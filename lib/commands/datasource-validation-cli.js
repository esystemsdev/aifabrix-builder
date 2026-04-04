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
const { analyzeCapabilityScope } = require('../utils/datasource-test-run-capability-scope');

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

/**
 * Plan §2.3: warn when --capability was set but the envelope lists multiple capability rows.
 * @param {Object|null} envelope
 * @param {Object} [opts]
 * @param {string} [opts.requestedCapabilityKey]
 */
function emitCapabilityScopeDiagnostics(envelope, opts = {}) {
  const scope = analyzeCapabilityScope(envelope, opts.requestedCapabilityKey);
  if (scope.violated && scope.message) {
    logger.warn(chalk.yellow(`⚠ ${scope.message}`));
  }
}

function logApiError(apiError) {
  logger.error(
    chalk.red('❌ Dataplane request failed:'),
    apiError.formattedError || apiError.error || 'Request failed'
  );
  if (apiError.status) {
    logger.error(chalk.gray(`  HTTP ${apiError.status}`));
  }
}

function printEnvelope(envelope, options) {
  const displayOpts = { focusCapabilityKey: options.requestedCapabilityKey };
  if (options.json) {
    logger.log(JSON.stringify(envelope));
  } else if (options.summary) {
    logger.log(formatDatasourceTestRunSummary(envelope, displayOpts));
  } else {
    logger.log(formatDatasourceTestRunTTY(envelope, displayOpts));
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
 * Print unified validation outcome and return exit code (plan §3.14 watch — no process.exit).
 * @param {Object} result - From runUnifiedDatasourceValidation
 * @param {Object} options - CLI flags
 * @returns {number}
 */
function finalizeUnifiedValidationResult(result, options = {}) {
  if (result.apiError) {
    logApiError(result.apiError);
    return 3;
  }
  if (result.pollTimedOut) {
    logger.error(chalk.red('Report incomplete: timeout'));
    return exitCodeForPollTimeout(result.envelope);
  }
  if (result.incompleteNoAsync) {
    logger.error(
      chalk.red(
        'Report incomplete: async polling disabled (--no-async) but server returned partial/minimal report.'
      )
    );
    return 3;
  }

  const envelope = result.envelope;
  emitReportVersionDiagnostics(envelope);
  emitCapabilityScopeDiagnostics(envelope, {
    requestedCapabilityKey: options.requestedCapabilityKey
  });
  printEnvelope(envelope, options);

  let exitCode = computeExitCodeFromDatasourceTestRun(envelope, {
    warningsAsErrors: options.warningsAsErrors === true,
    requireCert: options.requireCert === true
  });
  const scope = analyzeCapabilityScope(envelope, options.requestedCapabilityKey);
  if (options.strictCapabilityScope === true && scope.violated) {
    exitCode = Math.max(exitCode, 1);
  }
  if (
    exitCode === 2 &&
    options.requireCert &&
    !envelope.certificate
  ) {
    logger.error(chalk.red('Certification not returned; cannot verify.'));
  }
  return exitCode;
}

/**
 * Handle unified validation result: logs, stdout JSON, process.exit.
 * @param {Object} result - From runUnifiedDatasourceValidation
 * @param {Object} options - CLI flags
 * @returns {void} Exits process
 */
function exitFromUnifiedValidationResult(result, options = {}) {
  process.exit(finalizeUnifiedValidationResult(result, options));
}

/**
 * Compute exit code after integration CLI display (no process.exit; plan §3.14 watch).
 * @param {Object} integrationResult - From runDatasourceTestIntegration
 * @param {Object} [exitOpts]
 * @returns {number}
 */
function finalizeAfterIntegrationDisplay(integrationResult, exitOpts = {}) {
  const env = integrationResult.datasourceTestRun;
  if (!env) {
    return integrationResult.success ? 0 : 1;
  }
  return computeExitCodeFromDatasourceTestRun(env, {
    warningsAsErrors: exitOpts.warningsAsErrors === true,
    requireCert: exitOpts.requireCert === true
  });
}

/**
 * Exit after integration CLI when not using raw unified output modes.
 * @param {Object} integrationResult - From runDatasourceTestIntegration
 * @param {Object} [exitOpts]
 */
function exitAfterIntegrationDisplay(integrationResult, exitOpts = {}) {
  process.exit(finalizeAfterIntegrationDisplay(integrationResult, exitOpts));
}

module.exports = {
  exitFromUnifiedValidationResult,
  finalizeUnifiedValidationResult,
  emitReportVersionDiagnostics,
  emitCapabilityScopeDiagnostics,
  unifiedCliResultFromIntegrationReturn,
  finalizeAfterIntegrationDisplay,
  exitAfterIntegrationDisplay
};
