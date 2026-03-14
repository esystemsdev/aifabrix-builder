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

/**
 * Displays system file results
 * @function displaySystemResults
 * @param {Object[]} systemResults - System file results
 */
function displaySystemResults(systemResults) {
  if (systemResults.length === 0) {
    return;
  }
  logger.log(chalk.blue('System Files:'));
  for (const systemResult of systemResults) {
    if (systemResult.valid) {
      logger.log(chalk.green(`  ✓ ${systemResult.file}`));
    } else {
      logger.log(chalk.red(`  ✗ ${systemResult.file}`));
    }
  }
}

/**
 * Displays verbose datasource details
 * @function displayVerboseDatasourceDetails
 * @param {Object} dsResult - Datasource result
 */
function displayVerboseDatasourceDetails(dsResult) {
  if (dsResult.warnings.length > 0) {
    dsResult.warnings.forEach(warn => logger.log(chalk.yellow(`    ⚠ ${warn}`)));
  }

  if (dsResult.fieldMappingResults) {
    const fm = dsResult.fieldMappingResults;
    logger.log(chalk.gray(`    Field mappings: ${Object.keys(fm.mappedFields || {}).length} fields`));
  }

  if (dsResult.metadataSchemaResults) {
    const ms = dsResult.metadataSchemaResults;
    const statusMsg = ms.valid ? '    Metadata schema: ✓ Valid' : '    Metadata schema: ✗ Invalid';
    logger.log(ms.valid ? chalk.gray(statusMsg) : chalk.red(statusMsg));
  }
}

/**
 * Displays datasource file results
 * @function displayDatasourceResults
 * @param {Object[]} datasourceResults - Datasource file results
 * @param {boolean} verbose - Show detailed output
 */
function displayDatasourceResults(datasourceResults, verbose) {
  if (datasourceResults.length === 0) {
    return;
  }
  logger.log(chalk.blue('\nDatasource Files:'));
  for (const dsResult of datasourceResults) {
    if (dsResult.valid) {
      logger.log(chalk.green(`  ✓ ${dsResult.key} (${dsResult.file})`));
    } else {
      logger.log(chalk.red(`  ✗ ${dsResult.key} (${dsResult.file})`));
      if (verbose && dsResult.errors.length > 0) {
        dsResult.errors.forEach(err => logger.log(chalk.red(`    - ${err}`)));
      }
    }

    if (verbose) {
      displayVerboseDatasourceDetails(dsResult);
    }
  }
}

/**
 * Displays errors and warnings
 * @function displayErrorsAndWarnings
 * @param {string[]} errors - Error messages
 * @param {string[]} warnings - Warning messages
 */
function displayErrorsAndWarnings(errors, warnings) {
  if (errors.length > 0) {
    logger.log(chalk.red('\n❌ Errors:'));
    errors.forEach(err => logger.log(chalk.red(`  - ${err}`)));
  }

  if (warnings.length > 0) {
    logger.log(chalk.yellow('\n⚠ Warnings:'));
    warnings.forEach(warn => logger.log(chalk.yellow(`  - ${warn}`)));
  }
}

/**
 * Displays final test status
 * @function displayFinalTestStatus
 * @param {boolean} valid - Whether all tests passed
 */
function displayFinalTestStatus(valid) {
  if (valid) {
    logger.log(chalk.green('\n✅ All tests passed!'));
  } else {
    logger.log(chalk.red('\n❌ Some tests failed'));
  }
}

/**
 * Displays formatted test results
 * @param {Object} results - Test results
 * @param {boolean} verbose - Show detailed output
 */
function displayTestResults(results, verbose = false) {
  logger.log(chalk.blue('\n📊 Test Results\n'));

  displaySystemResults(results.systemResults);
  displayDatasourceResults(results.datasourceResults, verbose);
  displayErrorsAndWarnings(results.errors, results.warnings);
  displayFinalTestStatus(results.valid);
}

/**
 * Displays validation results in verbose mode
 * @function displayVerboseValidationResults
 * @param {Object} vr - Validation results
 */
function displayVerboseValidationResults(vr) {
  if (vr.isValid) {
    logger.log(chalk.gray('    Validation: ✓ Valid'));
  } else {
    logger.log(chalk.red('    Validation: ✗ Invalid'));
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
    logger.log(chalk.gray('    Endpoint: ✓ Configured'));
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
 * Displays a single datasource integration test result
 * @function displayDatasourceIntegrationResult
 * @param {Object} dsResult - Datasource result
 * @param {boolean} verbose - Show detailed output
 */
function displayDatasourceIntegrationResult(dsResult, verbose) {
  if (dsResult.skipped) {
    logger.log(chalk.yellow(`  ⚠ ${dsResult.key}: ${dsResult.reason}`));
    return;
  }

  if (dsResult.success) {
    logger.log(chalk.green(`  ✓ ${dsResult.key}`));
  } else {
    logger.log(chalk.red(`  ✗ ${dsResult.key}`));
    if (dsResult.error) {
      logger.log(chalk.red(`    Error: ${dsResult.error}`));
    }
  }

  if (verbose) {
    displayVerboseIntegrationDetails(dsResult);
  }
}

/**
 * Displays formatted integration test results
 * @param {Object} results - Integration test results
 * @param {boolean} verbose - Show detailed output
 */
function displayIntegrationTestResults(results, verbose = false) {
  logger.log(chalk.blue('\n📊 Integration Test Results\n'));
  logger.log(chalk.blue(`System: ${results.systemKey}`));

  if (results.datasourceResults.length === 0) {
    logger.log(chalk.yellow('No datasources tested'));
    return;
  }

  for (const dsResult of results.datasourceResults) {
    displayDatasourceIntegrationResult(dsResult, verbose);
  }

  if (results.success) {
    logger.log(chalk.green('\n✅ All integration tests passed!'));
  } else {
    logger.log(chalk.red('\n❌ Some integration tests failed'));
  }
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
  logger.log(chalk.blue('\n📊 E2E Test Results\n'));
  if (data.status) {
    const statusLabel = data.status === 'running'
      ? chalk.yellow('running')
      : data.status === 'completed'
        ? chalk.green('completed')
        : data.status === 'failed'
          ? chalk.red('failed')
          : data.status;
    logger.log(`Status: ${statusLabel}`);
  }
  const steps = data.steps || data.completedActions || [];
  if (steps.length === 0) {
    if (data.success === false) {
      logger.log(chalk.red('✗ E2E test failed'));
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
    logger.log(`  ${ok ? chalk.green('✓') : chalk.red('✗')} ${name}`);
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
  logger.log(allPassed ? chalk.green('\n✅ E2E test passed!') : chalk.red('\n❌ E2E test failed'));
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

