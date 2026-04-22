const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
/**
 * @fileoverview Shared CLI handling for unified validation (DatasourceTestRun + exit matrix).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { computeExitCodeFromDatasourceTestRun, exitCodeForPollTimeout } = require('../utils/datasource-test-run-exit');
const { analyzeCapabilityScope } = require('../utils/datasource-test-run-capability-scope');
const ttyLog = require('../utils/datasource-test-run-tty-log');
const { logEnvelopeForInteractiveCli } = ttyLog;

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

function logApiError(apiError) {
  logger.error(
    formatBlockingError('Dataplane request failed:'),
    apiError.formattedError || apiError.error || 'Request failed'
  );
  if (apiError.status) {
    logger.error(chalk.gray(`  HTTP ${apiError.status}`));
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
    logger.error(formatBlockingError('Report incomplete: timeout'));
    return exitCodeForPollTimeout(result.envelope);
  }
  if (result.incompleteNoAsync) {
    logger.error(
      chalk.red(
        '✖ Report incomplete: async polling disabled (--no-async) but server returned partial/minimal report.'
      )
    );
    return 3;
  }

  const envelope = result.envelope;
  logEnvelopeForInteractiveCli(envelope, options);

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
    logger.error(formatBlockingError('Certification not returned; cannot verify.'));
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
  let exitCode = computeExitCodeFromDatasourceTestRun(env, {
    warningsAsErrors: exitOpts.warningsAsErrors === true,
    requireCert: exitOpts.requireCert === true
  });
  if (exitOpts.strictCapabilityScope === true) {
    const scope = analyzeCapabilityScope(env, exitOpts.requestedCapabilityKey);
    if (scope.violated) {
      exitCode = Math.max(exitCode, 1);
    }
  }
  if (
    exitCode === 2 &&
    exitOpts.requireCert &&
    !env.certificate
  ) {
    logger.error(formatBlockingError('Certification not returned; cannot verify.'));
  }
  return exitCode;
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
  emitReportVersionDiagnostics: ttyLog.emitReportVersionDiagnostics,
  emitCapabilityScopeDiagnostics: ttyLog.emitCapabilityScopeDiagnostics,
  unifiedCliResultFromIntegrationReturn,
  finalizeAfterIntegrationDisplay,
  exitAfterIntegrationDisplay
};
