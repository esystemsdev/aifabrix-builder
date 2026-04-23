/**
 * @fileoverview E2E / envelope exit helpers for datasource unified test CLI (keeps main CLI file under max-lines).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { displayIntegrationTestResults, displayE2EResults } = require('../utils/external-system-display');
const { computeExitCodeFromDatasourceTestRun } = require('../utils/datasource-test-run-exit');
const { analyzeCapabilityScope } = require('../utils/datasource-test-run-capability-scope');
const {
  resolveDebugDisplayMode,
  formatDatasourceTestRunDebugBlock
} = require('../utils/datasource-test-run-debug-display');
const { formatCapabilityFocusSection } = require('../utils/datasource-test-run-display');
const { emitCapabilityScopeDiagnostics } = require('./datasource-validation-cli');

function logDatasourceTestRunDebugAppendix(envelope, debugOpt) {
  const mode = resolveDebugDisplayMode(debugOpt);
  if (!mode || !envelope) return;
  const block = formatDatasourceTestRunDebugBlock(envelope, mode, process.stdout.isTTY);
  if (block) logger.log(block);
}

function logE2eCapabilityFocusFromEnvelope(env, capabilityOpt) {
  if (!env) return;
  const capKey =
    capabilityOpt !== undefined && capabilityOpt !== null
      ? String(capabilityOpt).trim()
      : '';
  if (!capKey) return;
  const sec = formatCapabilityFocusSection(env, capKey);
  if (sec) logger.log(sec);
}

/**
 * @param {Object|null|undefined} env
 * @param {Object} options
 * @returns {number|null} null if no envelope
 */
function exitCodeFromDatasourceTestRunEnvelope(env, options) {
  if (!env || typeof env !== 'object') return null;
  let code = computeExitCodeFromDatasourceTestRun(env, {
    warningsAsErrors: options.warningsAsErrors === true,
    requireCert: options.requireCert === true
  });
  const scope = analyzeCapabilityScope(env, options.capability);
  if (options.strictCapabilityScope === true && scope.violated) {
    code = Math.max(code, 1);
  }
  return code;
}

/**
 * Legacy E2E display + exit code (no process.exit; watch mode).
 * @param {Object} data
 * @param {Object} options
 * @returns {number}
 */
function finalizeDatasourceTestE2ELegacyPath(data, options) {
  displayE2EResults(data, options.verbose);
  logDatasourceTestRunDebugAppendix(data.datasourceTestRun, options.debug);
  logE2eCapabilityFocusFromEnvelope(data.datasourceTestRun, options.capability);
  const env = data.datasourceTestRun;
  if (env) {
    emitCapabilityScopeDiagnostics(env, { requestedCapabilityKey: options.capability });
    const code = exitCodeFromDatasourceTestRunEnvelope(env, options);
    return code === null ? 1 : code;
  }
  const steps = data.steps || data.completedActions || [];
  const failed = data.success === false || steps.some(s => s.success === false || s.error);
  return failed ? 1 : 0;
}

/**
 * @param {string} datasourceKey
 * @param {Object} env
 * @param {Object} options
 */
function displayDatasourceTestE2EEnvelopeResults(datasourceKey, env, options) {
  const success = env.status !== 'fail';
  displayIntegrationTestResults(
    {
      systemKey: env.systemKey || 'unknown',
      success,
      datasourceResults: [{ key: datasourceKey, success, datasourceTestRun: env }]
    },
    options.verbose,
    {
      debug: options.debug,
      runType: 'e2e',
      requestedCapabilityKey: options.capability
    }
  );
  logE2eCapabilityFocusFromEnvelope(env, options.capability);
}

module.exports = {
  logDatasourceTestRunDebugAppendix,
  logE2eCapabilityFocusFromEnvelope,
  exitCodeFromDatasourceTestRunEnvelope,
  finalizeDatasourceTestE2ELegacyPath,
  displayDatasourceTestE2EEnvelopeResults
};
