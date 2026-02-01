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

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
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
const ENVIRONMENT = process.env.ENVIRONMENT || 'miso';

/** Path to temp config used so CLI uses invalid controller URL and fails with connection error */
let tempConfigPath = null;
let originalAifabrixConfig = null;

/**
 * Create temp config pointing controller to invalid URL so commands fail with connection error
 * @async
 * @returns {Promise<string>} Path to temp config file
 */
async function createTempConfig() {
  const dir = path.join(os.tmpdir(), `aifabrix-dataplane-down-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  const configPath = path.join(dir, 'config.yaml');
  const content = `controller: "${INVALID_DATAPLANE_URL}"
environment: "${ENVIRONMENT}"
`;
  await fs.writeFile(configPath, content, 'utf8');
  return configPath;
}

/**
 * Restore AIFABRIX_CONFIG and remove temp config
 * @async
 * @returns {Promise<void>} Resolves when cleanup is complete
 */
async function cleanupTempConfig() {
  if (originalAifabrixConfig !== undefined) {
    if (originalAifabrixConfig === null) {
      delete process.env.AIFABRIX_CONFIG;
    } else {
      process.env.AIFABRIX_CONFIG = originalAifabrixConfig;
    }
  }
  if (tempConfigPath) {
    try {
      await fs.rm(path.dirname(tempConfigPath), { recursive: true, force: true }).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
    tempConfigPath = null;
  }
}

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
  logInfo(`Invalid Controller URL (used for all commands): ${INVALID_DATAPLANE_URL}`);
  logInfo(`Environment: ${ENVIRONMENT}`);
  logInfo('='.repeat(60));

  try {
    tempConfigPath = await createTempConfig();
    originalAifabrixConfig = process.env.AIFABRIX_CONFIG || null;
    process.env.AIFABRIX_CONFIG = tempConfigPath;

    const results = await runTests();
    displaySummary(results);

    const failed = results.filter(r => !r.success).length;
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await cleanupTempConfig();
  }
}

main().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exitCode = 1;
});
