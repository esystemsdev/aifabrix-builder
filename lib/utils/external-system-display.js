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
 * Displays formatted test results
 * @param {Object} results - Test results
 * @param {boolean} verbose - Show detailed output
 */
function displayTestResults(results, verbose = false) {
  logger.log(chalk.blue('\n📊 Test Results\n'));

  if (results.systemResults.length > 0) {
    logger.log(chalk.blue('System Files:'));
    for (const systemResult of results.systemResults) {
      if (systemResult.valid) {
        logger.log(chalk.green(`  ✓ ${systemResult.file}`));
      } else {
        logger.log(chalk.red(`  ✗ ${systemResult.file}`));
      }
    }
  }

  if (results.datasourceResults.length > 0) {
    logger.log(chalk.blue('\nDatasource Files:'));
    for (const dsResult of results.datasourceResults) {
      if (dsResult.valid) {
        logger.log(chalk.green(`  ✓ ${dsResult.key} (${dsResult.file})`));
      } else {
        logger.log(chalk.red(`  ✗ ${dsResult.key} (${dsResult.file})`));
        if (verbose && dsResult.errors.length > 0) {
          dsResult.errors.forEach(err => logger.log(chalk.red(`    - ${err}`)));
        }
      }

      if (verbose) {
        if (dsResult.warnings.length > 0) {
          dsResult.warnings.forEach(warn => logger.log(chalk.yellow(`    ⚠ ${warn}`)));
        }

        if (dsResult.fieldMappingResults) {
          const fm = dsResult.fieldMappingResults;
          logger.log(chalk.gray(`    Field mappings: ${Object.keys(fm.mappedFields || {}).length} fields`));
        }

        if (dsResult.metadataSchemaResults) {
          const ms = dsResult.metadataSchemaResults;
          if (ms.valid) {
            logger.log(chalk.gray('    Metadata schema: ✓ Valid'));
          } else {
            logger.log(chalk.red('    Metadata schema: ✗ Invalid'));
          }
        }
      }
    }
  }

  if (results.errors.length > 0) {
    logger.log(chalk.red('\n❌ Errors:'));
    results.errors.forEach(err => logger.log(chalk.red(`  - ${err}`)));
  }

  if (results.warnings.length > 0) {
    logger.log(chalk.yellow('\n⚠ Warnings:'));
    results.warnings.forEach(warn => logger.log(chalk.yellow(`  - ${warn}`)));
  }

  if (results.valid) {
    logger.log(chalk.green('\n✅ All tests passed!'));
  } else {
    logger.log(chalk.red('\n❌ Some tests failed'));
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
    if (dsResult.skipped) {
      logger.log(chalk.yellow(`  ⚠ ${dsResult.key}: ${dsResult.reason}`));
      continue;
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
      if (dsResult.validationResults) {
        const vr = dsResult.validationResults;
        if (vr.isValid) {
          logger.log(chalk.gray('    Validation: ✓ Valid'));
        } else {
          logger.log(chalk.red('    Validation: ✗ Invalid'));
          if (vr.errors && vr.errors.length > 0) {
            vr.errors.forEach(err => logger.log(chalk.red(`      - ${err}`)));
          }
        }
        if (vr.warnings && vr.warnings.length > 0) {
          vr.warnings.forEach(warn => logger.log(chalk.yellow(`      ⚠ ${warn}`)));
        }
      }

      if (dsResult.fieldMappingResults) {
        const fmr = dsResult.fieldMappingResults;
        logger.log(chalk.gray(`    Field mappings: ${fmr.mappingCount || 0} fields`));
        if (fmr.accessFields && fmr.accessFields.length > 0) {
          logger.log(chalk.gray(`      Access fields: ${fmr.accessFields.join(', ')}`));
        }
      }

      if (dsResult.endpointTestResults) {
        const etr = dsResult.endpointTestResults;
        if (etr.endpointConfigured) {
          logger.log(chalk.gray('    Endpoint: ✓ Configured'));
        } else {
          logger.log(chalk.gray('    Endpoint: Not configured'));
        }
      }
    }
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

