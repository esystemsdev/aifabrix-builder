/**
 * External System Test Helpers
 *
 * Helper functions for external system testing
 *
 * @fileoverview Test helper utilities for external system testing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const externalSystemSchema = require('../schema/external-system.schema.json');
const { validateAgainstSchema } = require('../utils/external-system-validators');

/**
 * Initialize test results object
 * @function initializeTestResults
 * @returns {Object} Initial test results
 */
function initializeTestResults() {
  return {
    valid: true,
    errors: [],
    warnings: [],
    systemResults: [],
    datasourceResults: []
  };
}

/**
 * Validates system files against schema
 * @function validateSystemFiles
 * @param {Array} systemFiles - Array of system file objects with data property
 * @param {Object} schema - External system schema
 * @returns {Object} Validation results
 */
function validateSystemFiles(systemFiles, schema) {
  const systemResults = [];
  let valid = true;
  const errors = [];

  for (const systemFile of systemFiles) {
    const validation = validateAgainstSchema(systemFile.data, schema);
    if (!validation.valid) {
      valid = false;
      errors.push(...validation.errors);
    }
    systemResults.push({
      file: systemFile.path || systemFile.file,
      valid: validation.valid,
      errors: validation.errors || []
    });
  }

  return { valid, errors, systemResults };
}

/**
 * Validates system files and updates results
 * @function validateSystemFilesForTest
 * @param {Array} systemFiles - System files
 * @param {Object} results - Test results object
 */
function validateSystemFilesForTest(systemFiles, results) {
  logger.log(chalk.blue('📋 Validating system files...'));
  const systemValidation = validateSystemFiles(systemFiles, externalSystemSchema);
  results.valid = systemValidation.valid;
  results.errors.push(...systemValidation.errors);
  results.systemResults = systemValidation.systemResults;
}

/**
 * Validates datasource files and updates results
 * @function validateDatasourceFilesForTest
 * @param {Array} datasourceFiles - Datasource files
 * @param {Array} systemFiles - System files
 * @param {Object} results - Test results object
 * @param {Object} options - Test options
 * @param {Function} validateSingleDatasource - Function to validate single datasource
 * @param {Function} determineDatasourcesToTest - Function to determine datasources to test
 */
function validateDatasourceFilesForTest(datasourceFiles, systemFiles, results, options, validateSingleDatasource, determineDatasourcesToTest) {
  logger.log(chalk.blue('📋 Validating datasource files...'));
  const datasourcesToTest = determineDatasourcesToTest(datasourceFiles, options.datasource);
  const systemKey = systemFiles.length > 0 ? systemFiles[0].data.key : null;

  for (const datasourceFile of datasourcesToTest) {
    const datasourceResult = validateSingleDatasource(
      datasourceFile,
      systemKey,
      require('../schema/external-datasource.schema.json'),
      options.verbose
    );

    if (!datasourceResult.valid) {
      results.valid = false;
    }

    results.datasourceResults.push(datasourceResult);
  }
}

module.exports = {
  initializeTestResults,
  validateSystemFilesForTest,
  validateDatasourceFilesForTest
};

