#!/usr/bin/env node
/**
 * Dataplane Down Test Suite
 *
 * Tests all commands that interact with dataplane when dataplane is unavailable.
 * Validates that appropriate error messages are returned.
 *
 * @fileoverview Dataplane down error handling tests
 * @author AI Fabrix Team
 * @version 2.0.0
 */
'use strict';

const {
  logInfo,
  logSuccess,
  logError,
  logWarn
} = require('./test-dataplane-down-helpers');
const {
  testWizard,
  testDownload,
  testDelete,
  testDatasourceDeploy,
  testIntegration,
  testDataplaneDiscovery
} = require('./test-dataplane-down-tests');

const INVALID_DATAPLANE_URL = 'http://localhost:9999';
const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:3110';
const ENVIRONMENT = process.env.ENVIRONMENT || 'miso';

/**
 * Displays failed test details
 * @function displayFailedTestDetails
 * @param {Array} failedTests - Failed test results
 * @returns {void}
 */
function displayFailedTestDetails(failedTests) {
  if (failedTests.length === 0) {
    return;
  }

  logError('\nFailed Tests:');
  for (const test of failedTests) {
    logError(`  - ${test.name}`);
    if (test.output) {
      const outputPreview = test.output.length > 500 ? test.output.substring(0, 500) + '...' : test.output;
      logWarn(`    Output: ${outputPreview}`);
    }
    if (test.error) {
      logWarn(`    Error: ${test.error}`);
    }
    if (test.expectedPatterns) {
      logWarn(`    Expected patterns: ${test.expectedPatterns.join(', ')}`);
    }
  }
}

/**
 * Displays test results summary
 * @function displaySummary
 * @param {Array} results - Test results
 * @returns {void}
 */
function displaySummary(results) {
  logInfo('\n' + '='.repeat(60));
  logInfo('Test Summary');
  logInfo('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  logInfo(`Total tests: ${results.length}`);
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  }

  const failedTests = results.filter(r => !r.success);
  displayFailedTestDetails(failedTests);

  logInfo('='.repeat(60));
}

/**
 * Runs all test cases
 * @async
 * @function runTests
 * @returns {Promise<Array>} Test results
 */
async function runTests() {
  const tests = [
    testWizard,
    testDownload,
    testDelete,
    testDatasourceDeploy,
    testIntegration,
    testDataplaneDiscovery
  ];

  const results = [];

  for (const testFn of tests) {
    try {
      const result = await testFn();
      results.push(result);

      if (result.success) {
        logSuccess(`✓ ${result.name}: Error handling validated`);
      } else {
        logError(`✗ ${result.name}: Error handling failed`);
        if (result.output) {
          logWarn(`  Output: ${result.output.substring(0, 200)}...`);
        }
      }
    } catch (error) {
      logError(`✗ ${testFn.name}: Unexpected error: ${error.message}`);
      results.push({
        name: testFn.name,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Main test runner
 * @async
 * @function main
 * @returns {Promise<void>} Resolves when tests complete
 */
async function main() {
  logInfo('='.repeat(60));
  logInfo('Dataplane Down Error Handling Test Suite');
  logInfo('='.repeat(60));
  logInfo(`Invalid Dataplane URL: ${INVALID_DATAPLANE_URL}`);
  logInfo(`Controller URL: ${CONTROLLER_URL}`);
  logInfo(`Environment: ${ENVIRONMENT}`);
  logInfo('='.repeat(60));

  const results = await runTests();
  displaySummary(results);

  const failed = results.filter(r => !r.success).length;
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exitCode = 1;
});
