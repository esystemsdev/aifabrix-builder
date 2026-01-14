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
  logger.log(chalk.gray(`    Field mappings: ${fmr.mappingCount || 0} fields`));
  if (fmr.accessFields && fmr.accessFields.length > 0) {
    logger.log(chalk.gray(`      Access fields: ${fmr.accessFields.join(', ')}`));
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

module.exports = {
  displayTestResults,
  displayIntegrationTestResults
};

