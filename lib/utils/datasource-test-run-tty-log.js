/**
 * @fileoverview Log DatasourceTestRun to TTY — shared by datasource commands and external system server tests.
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const { getReportVersionStderrMessage } = require('./datasource-test-run-report-version');
const {
  formatDatasourceTestRunSummary,
  formatDatasourceTestRunTTY
} = require('./datasource-test-run-display');
const {
  resolveDebugDisplayMode,
  formatDatasourceTestRunDebugBlock
} = require('./datasource-test-run-debug-display');
const { analyzeCapabilityScope } = require('./datasource-test-run-capability-scope');

function emitReportVersionDiagnostics(envelope) {
  if (!envelope || typeof envelope !== 'object') return;
  const msg = getReportVersionStderrMessage(envelope.reportVersion);
  if (!msg) return;
  if (msg.level === 'warn') logger.warn(chalk.yellow(msg.message));
  else if (msg.level === 'info') logger.log(chalk.gray(msg.message));
}

function emitCapabilityScopeDiagnostics(envelope, opts = {}) {
  const scope = analyzeCapabilityScope(envelope, opts.requestedCapabilityKey);
  if (scope.violated && scope.message) {
    logger.warn(chalk.yellow(`⚠ ${scope.message}`));
  }
}

/**
 * Print envelope (JSON, summary, or full TTY + optional debug appendix). Does not emit reportVersion/capability diagnostics.
 * @param {Object} envelope
 * @param {Object} options
 * @param {boolean} [options.json]
 * @param {boolean} [options.summary]
 * @param {boolean|string} [options.debug]
 * @param {string} [options.requestedCapabilityKey]
 */
function printDatasourceTestRunForTTY(envelope, options = {}) {
  const mode = resolveDebugDisplayMode(options.debug);
  const displayOpts = {
    focusCapabilityKey: options.requestedCapabilityKey,
    includeRefs: Boolean(mode)
  };
  if (options.json) {
    logger.log(JSON.stringify(envelope));
    return;
  }
  if (options.summary) {
    logger.log(formatDatasourceTestRunSummary(envelope, displayOpts));
  } else {
    logger.log(formatDatasourceTestRunTTY(envelope, displayOpts));
  }
  if (mode) {
    const appendix = formatDatasourceTestRunDebugBlock(envelope, mode, process.stdout.isTTY);
    if (appendix) logger.log(appendix);
  }
}

/**
 * Emit diagnostics + human output for one server validation run (integration / test / e2e).
 * @param {Object|null|undefined} envelope
 * @param {Object} options - Same flags as unified CLI (json, summary, debug, requestedCapabilityKey)
 */
function logEnvelopeForInteractiveCli(envelope, options = {}) {
  if (!envelope || typeof envelope !== 'object') return;
  emitReportVersionDiagnostics(envelope);
  emitCapabilityScopeDiagnostics(envelope, {
    requestedCapabilityKey: options.requestedCapabilityKey
  });
  printDatasourceTestRunForTTY(envelope, options);
}

module.exports = {
  emitReportVersionDiagnostics,
  emitCapabilityScopeDiagnostics,
  printDatasourceTestRunForTTY,
  logEnvelopeForInteractiveCli
};
