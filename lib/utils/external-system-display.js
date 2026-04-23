/**
 * External System Test Display Helpers
 *
 * Provides formatted output for test results.
 *
 * @fileoverview Display helpers for external system testing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');
const { SEP, statusGlyph } = require('./datasource-test-run-display');
const { logEnvelopeForInteractiveCli } = require('./datasource-test-run-tty-log');
const { displayLocalExternalTestPlanLayout } = require('./external-system-local-test-tty');
const {
  sectionTitle,
  headerKeyValue,
  formatStatusKeyValue,
  formatDatasourceListRow,
  integrationFooterLine,
  formatSuccessParagraph,
  formatBlockingError,
  successGlyph,
  failureGlyph
} = require('./cli-test-layout-chalk');
const { displaySystemAggregateDatasourceTestRuns } = require('./external-system-system-test-tty');

/**
 * Displays formatted test results (local external `aifabrix test` — structured report layout).
 * @param {Object} results - Test results
 * @param {boolean} verbose - Show detailed output
 * @param {string} [appName] - Integration folder / app key for header
 */
function displayTestResults(results, verbose = false, appName = '') {
  displayLocalExternalTestPlanLayout(results, verbose, appName || results.appName || results.systemKey || 'unknown');
}

/**
 * Displays validation results in verbose mode
 * @function displayVerboseValidationResults
 * @param {Object} vr - Validation results
 */
function displayVerboseValidationResults(vr) {
  if (vr.isValid) {
    logger.log(chalk.gray('    Validation: ✔ Valid'));
  } else {
    logger.log(chalk.red('    Validation: ✖ Invalid'));
  }
  if (vr.errors && vr.errors.length > 0) {
    vr.errors.forEach(err => logger.log(chalk.red(`      - ${err}`)));
  }
  if (vr.warnings && vr.warnings.length > 0) {
    vr.warnings.forEach(warn => logger.log(chalk.yellow(`      ⚠ ${warn}`)));
  }
}

/**
 * Displays field mapping results in verbose mode
 * @function displayVerboseFieldMappingResults
 * @param {Object} fmr - Field mapping results
 */
function displayVerboseFieldMappingResults(fmr) {
  logger.log(chalk.gray(`    Field mappings: ${fmr.mappingCount || 0} attributes`));
  if (fmr.dimensions && Object.keys(fmr.dimensions).length > 0) {
    const dimensionKeys = Object.keys(fmr.dimensions);
    logger.log(chalk.gray(`      Dimensions: ${dimensionKeys.join(', ')}`));
  }
}

/**
 * Displays endpoint test results in verbose mode
 * @function displayVerboseEndpointResults
 * @param {Object} etr - Endpoint test results
 */
function displayVerboseEndpointResults(etr) {
  if (etr.endpointConfigured) {
    logger.log(chalk.gray('    Endpoint: ✔ Configured'));
  } else {
    logger.log(chalk.gray('    Endpoint: Not configured'));
  }
}

/**
 * Displays verbose integration test details
 * @function displayVerboseIntegrationDetails
 * @param {Object} dsResult - Datasource result
 */
function displayVerboseIntegrationDetails(dsResult) {
  if (!dsResult.validationResults) {
    return;
  }

  displayVerboseValidationResults(dsResult.validationResults);

  if (dsResult.fieldMappingResults) {
    displayVerboseFieldMappingResults(dsResult.fieldMappingResults);
  }

  if (dsResult.endpointTestResults) {
    displayVerboseEndpointResults(dsResult.endpointTestResults);
  }
}

/**
 * @param {Object} dsResult
 * @returns {'ok'|'warn'|'fail'|'skipped'}
 */
function legacyIntegrationRowStatus(dsResult) {
  if (dsResult.skipped) return 'skipped';
  if (!dsResult.success) return 'fail';
  const w = dsResult.validationResults && dsResult.validationResults.warnings;
  if (Array.isArray(w) && w.length > 0) return 'warn';
  return 'ok';
}

function legacyIntegrationRowHint(dsResult) {
  if (dsResult.skipped) return dsResult.reason || 'Skipped';
  if (!dsResult.success) return 'Failed';
  return legacyIntegrationRowStatus(dsResult) === 'warn' ? 'Partial' : 'Ready';
}

/**
 * Displays a single datasource integration test result (legacy pipeline row).
 * @param {Object} dsResult - Datasource result
 * @param {boolean} verbose - Show detailed output
 */
function displayDatasourceIntegrationResult(dsResult, verbose) {
  const rowSt = legacyIntegrationRowStatus(dsResult);
  const hint = legacyIntegrationRowHint(dsResult);
  logger.log(formatDatasourceListRow(rowSt, dsResult.key, hint));

  if (!dsResult.skipped && !dsResult.success && dsResult.error) {
    logger.log(chalk.red(`    Error: ${dsResult.error}`));
  }

  if (verbose) {
    displayVerboseIntegrationDetails(dsResult);
  }
}

/**
 * Worst status across server runs (envelope.status or transport failure).
 * @param {Object} results
 * @returns {'ok'|'warn'|'fail'}
 */
function serverRowFails(r) {
  if (r.skipped) return false;
  if (r.datasourceTestRun && r.datasourceTestRun.status === 'fail') return true;
  return !r.datasourceTestRun && r.success === false;
}

function serverRowWarns(r) {
  if (r.skipped) return false;
  return !!(r.datasourceTestRun && r.datasourceTestRun.status === 'warn');
}

function deriveAggregateServerStatus(results) {
  const ds = results.datasourceResults || [];
  if (ds.length === 0) {
    return results.success === false ? 'fail' : 'ok';
  }
  if (ds.some(serverRowFails)) return 'fail';
  if (ds.some(serverRowWarns)) return 'warn';
  return results.success === false ? 'fail' : 'ok';
}

/**
 * Aggregate status for legacy pipeline integration results (no DatasourceTestRun envelope).
 * @param {Object} results
 * @returns {'ok'|'warn'|'fail'}
 */
function deriveAggregateLegacyIntegrationStatus(results) {
  const ds = results.datasourceResults || [];
  if (ds.length === 0) {
    return results.success === false ? 'fail' : 'ok';
  }
  if (ds.some(r => !r.skipped && r.success === false)) return 'fail';
  if (ds.some(r => legacyIntegrationRowStatus(r) === 'warn')) return 'warn';
  return results.success === false ? 'fail' : 'ok';
}

function integrationResultsHaveEnvelope(results) {
  return (results.datasourceResults || []).some(
    r => r.datasourceTestRun && typeof r.datasourceTestRun === 'object'
  );
}

/**
 * One datasource with DatasourceTestRun — same display path as `aifabrix datasource test` (no server wrapper).
 * @param {Object} results
 * @returns {boolean}
 */
function isSingleUnskippedEnvelopeRun(results) {
  const rows = results.datasourceResults || [];
  if (rows.length !== 1) return false;
  const r = rows[0];
  return Boolean(
    r && !r.skipped && r.datasourceTestRun && typeof r.datasourceTestRun === 'object'
  );
}

function runLabelForServerRun(runType) {
  return runType === 'e2e' ? 'test-e2e (dataplane)' : 'test-integration (dataplane)';
}

function renderOneServerDatasourceRow(dsResult, verbose, opts) {
  logger.log('');
  if (!dsResult.datasourceTestRun) {
    logger.log(headerKeyValue('Datasource:', dsResult.key));
  }
  if (dsResult.skipped) {
    logger.log(formatDatasourceListRow('skipped', dsResult.key, dsResult.reason || 'Skipped'));
    return;
  }
  if (dsResult.datasourceTestRun) {
    logEnvelopeForInteractiveCli(dsResult.datasourceTestRun, {
      json: false,
      summary: false,
      debug: opts.debug,
      requestedCapabilityKey: opts.requestedCapabilityKey
    });
    return;
  }
  displayDatasourceIntegrationResult(dsResult, verbose);
}

function logServerDatasourceTestRunHeader(results, runType, agg) {
  logger.log('');
  logger.log(sectionTitle('Server test results'));
  logger.log('');
  logger.log(headerKeyValue('System:', results.systemKey));
  logger.log(headerKeyValue('Run:', runLabelForServerRun(runType)));
  logger.log(formatStatusKeyValue(agg, statusGlyph(agg)));
  logger.log('');
  logger.log(chalk.gray(SEP));
}

function logServerDatasourceTestRunFooter(success, agg) {
  logger.log(
    integrationFooterLine(
      success,
      agg,
      'All server tests passed.',
      'Server tests completed with warnings.',
      'Some server tests failed.'
    )
  );
}

/**
 * Dataplane DatasourceTestRun layout (multi- or single-datasource).
 * @param {Object} results
 * @param {boolean} verbose
 * @param {Object} opts
 * @param {boolean|string} [opts.debug]
 * @param {'integration'|'e2e'} [opts.runType]
 */
function displayServerDatasourceTestRunResults(results, verbose, opts = {}) {
  const runType = opts.runType === 'e2e' ? 'e2e' : 'integration';

  if (isSingleUnskippedEnvelopeRun(results)) {
    const row = results.datasourceResults[0];
    logEnvelopeForInteractiveCli(row.datasourceTestRun, {
      json: false,
      summary: false,
      debug: opts.debug,
      requestedCapabilityKey: opts.requestedCapabilityKey
    });
    return;
  }

  // Plan §17: system-level overview for multi-datasource results (no full §16 dump per datasource by default).
  // Keep legacy per-datasource full envelope available only via datasource commands.
  if (integrationResultsHaveEnvelope(results)) {
    displaySystemAggregateDatasourceTestRuns(results, { runType, verbose: Boolean(verbose) });
    return;
  }

  const agg = deriveAggregateServerStatus(results);
  logServerDatasourceTestRunHeader(results, runType, agg);

  if (results.datasourceResults.length === 0) {
    logger.log('');
    logger.log(chalk.yellow('No datasources tested'));
    logger.log('');
    return;
  }

  for (const dsResult of results.datasourceResults) {
    renderOneServerDatasourceRow(dsResult, verbose, opts);
    logger.log('');
    logger.log(chalk.gray(SEP));
  }

  logServerDatasourceTestRunFooter(results.success, agg);
}

/**
 * Displays formatted integration / E2E test results (legacy or DatasourceTestRun TTY).
 * @param {Object} results - Integration test results
 * @param {boolean} verbose - Show detailed output
 * @param {Object} [displayOpts]
 * @param {boolean|string} [displayOpts.debug] - Debug appendix for each envelope
 * @param {'integration'|'e2e'} [displayOpts.runType]
 * @param {string} [displayOpts.requestedCapabilityKey]
 */
function displayIntegrationTestResults(results, verbose = false, displayOpts = {}) {
  if (integrationResultsHaveEnvelope(results)) {
    displayServerDatasourceTestRunResults(results, verbose, displayOpts);
    return;
  }

  const agg = deriveAggregateLegacyIntegrationStatus(results);
  logger.log('');
  logger.log(sectionTitle('Integration test results'));
  logger.log('');
  logger.log(headerKeyValue('System:', results.systemKey));
  logger.log(headerKeyValue('Run:', 'test-integration (pipeline)'));
  logger.log(formatStatusKeyValue(agg, statusGlyph(agg)));
  logger.log('');
  logger.log(chalk.gray(SEP));

  if (results.datasourceResults.length === 0) {
    logger.log('');
    logger.log(chalk.yellow('No datasources tested'));
    return;
  }

  logger.log('');
  for (const dsResult of results.datasourceResults) {
    displayDatasourceIntegrationResult(dsResult, verbose);
  }

  logger.log(
    integrationFooterLine(
      results.success,
      agg,
      'All integration tests passed.',
      'Integration tests completed with warnings.',
      'Some integration tests failed.'
    )
  );
}

/**
 * Displays E2E test results (steps: config, credential, sync, data, cip).
 * Supports sync response (data.steps only), final poll (data.steps + data.success), and running poll
 * (data.completedActions, no data.steps yet). When status is present (async flow), shows it.
 *
 * @param {Object} data - E2E response or poll data
 * @param {string} [data.status] - Optional status: 'running' | 'completed' | 'failed' (async flow)
 * @param {Object[]} [data.steps] - Per-step results (final state)
 * @param {Object[]} [data.completedActions] - Steps completed so far (running state when steps absent)
 * @param {boolean} [data.success] - Overall success (final state)
 * @param {string} [data.error] - Error message when failed
 * @param {boolean} [verbose] - Show detailed output
 */
/* eslint-disable max-statements,complexity -- Step iteration and status display */
function displayE2EResults(data, verbose = false) {
  logger.log('');
  logger.log(sectionTitle('E2E test results'));
  logger.log('');
  if (data.status) {
    const statusLabel = data.status === 'running'
      ? chalk.yellow('running')
      : data.status === 'completed'
        ? chalk.green('completed')
        : data.status === 'failed'
          ? chalk.red('failed')
          : data.status;
    logger.log(`${chalk.gray('Status:')} ${statusLabel}`);
  }
  const steps = data.steps || data.completedActions || [];
  if (steps.length === 0) {
    if (data.success === false) {
      logger.log(formatBlockingError('E2E test failed.'));
      if (data.error) logger.log(chalk.red(`  Error: ${data.error}`));
    } else if (data.status === 'running') {
      logger.log(chalk.gray('  No steps completed yet'));
    } else {
      logger.log(chalk.yellow('No step results returned'));
    }
    return;
  }
  const isRunning = data.status === 'running' && !data.steps;
  if (isRunning && verbose) {
    logger.log(chalk.gray(`  (${steps.length} step(s) completed so far)`));
  }
  for (const step of steps) {
    const name = step.name || step.step || 'unknown';
    const ok = step.success !== false && !step.error;
    logger.log(`  ${ok ? successGlyph() : failureGlyph()} ${chalk.white(name)}`);
    if (!ok && (step.error || step.message)) logger.log(chalk.red(`    ${step.error || step.message}`));
    if (verbose && step.message && ok) logger.log(chalk.gray(`    ${step.message}`));
    if (verbose && ok && (name === 'sync' || step.step === 'sync') && step.evidence && step.evidence.jobs) {
      formatSyncStepEvidence(step.evidence.jobs);
    }
  }
  if (verbose && data.auditLog && Array.isArray(data.auditLog) && data.auditLog.length > 0) {
    const n = data.auditLog.length;
    const first = data.auditLog[0];
    const execId = (first && (first.executionId || first.id || first.traceId)) ? String(first.executionId || first.id || first.traceId) : null;
    if (execId) {
      const short = execId.length > 10 ? `${execId.slice(0, 8)}…` : execId;
      logger.log(chalk.gray(`  CIP execution trace(s): ${n} (executionId: ${short})`));
    } else {
      logger.log(chalk.gray(`  CIP execution trace(s): ${n}`));
    }
  }
  if (isRunning) {
    return;
  }
  const allPassed = steps.every(s => s.success !== false && !s.error);
  logger.log(
    allPassed ? formatSuccessParagraph('E2E test passed.') : `\n${formatBlockingError('E2E test failed.')}`
  );
}

/**
 * Log sync step job evidence (record counts) in verbose E2E output
 * @param {Object[]} jobs - evidence.jobs from sync step
 */
function formatSyncStepEvidence(jobs) {
  for (const job of jobs) {
    const rec = job.recordsProcessed ?? job.totalProcessed;
    const total = job.totalRecords ?? (job.audit && job.audit.totalProcessed);
    const parts = [];
    if (rec !== undefined && rec !== null) parts.push(`${rec} processed`);
    if (total !== undefined && total !== null) parts.push(`total: ${total}`);
    const audit = job.audit || {};
    const ins = audit.inserted ?? job.insertedCount;
    const upd = audit.updated ?? job.updatedCount;
    const del = audit.deleted ?? job.deletedCount;
    const tot = audit.totalProcessed ?? total;
    if (ins !== undefined || upd !== undefined || del !== undefined || tot !== undefined) {
      const a = [`inserted: ${ins ?? 0}`, `updated: ${upd ?? 0}`, `deleted: ${del ?? 0}`];
      if (tot !== undefined) a.push(`totalProcessed: ${tot}`);
      parts.push(`(${a.join(', ')})`);
    }
    if (job.skippedCount !== undefined) parts.push(`skipped: ${job.skippedCount}`);
    if (job.rejectedByQualityCount !== undefined) parts.push(`rejectedByQuality: ${job.rejectedByQualityCount}`);
    if (parts.length > 0) {
      logger.log(chalk.gray(`    Managed records: ${parts.join(' ')}`));
    }
  }
}

module.exports = {
  displayTestResults,
  displayIntegrationTestResults,
  displayE2EResults,
  displayDatasourceIntegrationResult
};

