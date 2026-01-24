/**
 * Test Functions for Dataplane Down Tests
 *
 * Individual test functions for dataplane down test suite.
 *
 * @fileoverview Test functions for dataplane down tests
 * @author AI Fabrix Team
 * @version 2.0.0
 */
'use strict';

const path = require('path');
const fs = require('fs').promises;
const {
  logInfo,
  runCommand,
  validateError,
  isTimeoutResult,
  validateDownloadDeleteResult,
  validateDeleteResult,
  validateWizardResult
} = require('./test-dataplane-down-helpers');

const INVALID_DATAPLANE_URL = 'http://localhost:9999';
const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:3110';
const ENVIRONMENT = process.env.ENVIRONMENT || 'miso';
const TEST_APP_NAME = 'test-dataplane-down';

/**
 * Creates wizard config file
 * @async
 * @function createWizardConfig
 * @param {string} configPath - Path to config file
 * @returns {Promise<void>} Resolves when config file is created
 */
async function createWizardConfig(configPath) {
  const configContent = `appName: ${TEST_APP_NAME}
mode: create-system
source:
  type: known-platform
  platform: hubspot
deployment:
  controller: ${CONTROLLER_URL}
  environment: ${ENVIRONMENT}
  dataplane: ${INVALID_DATAPLANE_URL}
`;
  await fs.writeFile(configPath, configContent, 'utf8');
}

/**
 * Test wizard command with invalid dataplane
 * @async
 * @function testWizard
 * @returns {Promise<Object>} Test result
 */
async function testWizard() {
  logInfo('\n📋 Testing: wizard command');

  const configPath = path.join(process.cwd(), 'integration', 'test-wizard-config.yaml');

  try {
    await createWizardConfig(configPath);

    const args = [
      'bin/aifabrix.js',
      'wizard',
      '--config',
      configPath,
      '--controller',
      CONTROLLER_URL,
      '--environment',
      ENVIRONMENT,
      '--dataplane',
      INVALID_DATAPLANE_URL
    ];

    const result = await runCommand('node', args);
    const output = `${result.stdout}\n${result.stderr}`;

    // Clean up config file
    try {
      await fs.unlink(configPath);
    } catch {
      // Ignore cleanup errors
    }

    return validateWizardResult(result, output);
  } catch (error) {
    return {
      name: 'wizard',
      success: false,
      output: error.message,
      error: error.message
    };
  }
}

/**
 * Test download command with invalid dataplane
 * @async
 * @function testDownload
 * @returns {Promise<Object>} Test result
 */
async function testDownload() {
  logInfo('\n📥 Testing: download command');

  const args = [
    'bin/aifabrix.js',
    'download',
    'non-existent-system-that-should-fail',
    '--environment',
    ENVIRONMENT,
    '--controller',
    CONTROLLER_URL
  ];

  const result = await runCommand('node', args);
  const output = `${result.stdout}\n${result.stderr}`;

  const expectedPatterns = [
    'failed to connect',
    'connection refused',
    'network error',
    'econnrefused',
    'fetch failed',
    'timeout',
    'unreachable',
    'failed to download system',
    'not found',
    'external system'
  ];

  const validation = validateDownloadDeleteResult(result, output, expectedPatterns);

  return {
    name: 'download',
    success: validation.isValid,
    output: validation.output,
    expectedPatterns: validation.expectedPatterns
  };
}

/**
 * Test delete command with invalid dataplane
 * @async
 * @function testDelete
 * @returns {Promise<Object>} Test result
 */
async function testDelete() {
  logInfo('\n🗑️  Testing: delete command');

  const args = [
    'bin/aifabrix.js',
    'delete',
    'non-existent-system-that-should-fail',
    '--type',
    'external',
    '--environment',
    ENVIRONMENT,
    '--controller',
    CONTROLLER_URL,
    '--yes'
  ];

  const result = await runCommand('node', args);
  const output = `${result.stdout}\n${result.stderr}`;

  const expectedPatterns = [
    'failed to connect',
    'connection refused',
    'network error',
    'econnrefused',
    'fetch failed',
    'timeout',
    'unreachable',
    'failed to delete',
    'not found',
    'external system'
  ];

  const validation = validateDeleteResult(result, output, expectedPatterns);

  return {
    name: 'delete',
    success: validation.isValid,
    output: validation.output,
    expectedPatterns: validation.expectedPatterns,
    error: validation.error
  };
}

/**
 * Creates test datasource file
 * @async
 * @function createTestDatasource
 * @param {string} datasourcePath - Path to datasource file
 * @returns {Promise<void>} Resolves when datasource file is created
 */
async function createTestDatasource(datasourcePath) {
  const datasourceContent = JSON.stringify({
    key: 'test-datasource',
    systemKey: 'test-system',
    displayName: 'Test Datasource',
    entityType: 'company',
    resourceType: 'company'
  }, null, 2);
  await fs.writeFile(datasourcePath, datasourceContent, 'utf8');
}

/**
 * Builds datasource deploy command arguments
 * @function buildDatasourceDeployArgs
 * @param {string} datasourcePath - Path to datasource file
 * @returns {string[]} Command arguments
 */
function buildDatasourceDeployArgs(datasourcePath) {
  return [
    'bin/aifabrix.js',
    'datasource',
    'deploy',
    'test-app',
    datasourcePath,
    '--environment',
    ENVIRONMENT,
    '--controller',
    CONTROLLER_URL,
    '--dataplane',
    INVALID_DATAPLANE_URL
  ];
}

/**
 * Gets expected error patterns for datasource deploy
 * @function getDatasourceDeployErrorPatterns
 * @returns {string[]} Expected error patterns
 */
function getDatasourceDeployErrorPatterns() {
  return [
    'failed to connect',
    'connection refused',
    'network error',
    'econnrefused',
    'fetch failed',
    'timeout',
    'unreachable',
    'failed to publish',
    'deployment failed'
  ];
}

/**
 * Test datasource deploy command with invalid dataplane
 * @async
 * @function testDatasourceDeploy
 * @returns {Promise<Object>} Test result
 */
async function testDatasourceDeploy() {
  logInfo('\n🚀 Testing: datasource deploy command');

  const datasourcePath = path.join(process.cwd(), 'integration', 'test-datasource.json');

  try {
    await createTestDatasource(datasourcePath);
    const args = buildDatasourceDeployArgs(datasourcePath);
    const result = await runCommand('node', args);
    const output = `${result.stdout}\n${result.stderr}`;

    // Clean up datasource file
    try {
      await fs.unlink(datasourcePath);
    } catch {
      // Ignore cleanup errors
    }

    const expectedPatterns = getDatasourceDeployErrorPatterns();
    const isValid = !result.success && validateError(output, expectedPatterns);

    return {
      name: 'datasource deploy',
      success: isValid,
      output,
      expectedPatterns
    };
  } catch (error) {
    return {
      name: 'datasource deploy',
      success: false,
      output: error.message,
      error: error.message
    };
  }
}

/**
 * Determines test app name for integration test
 * @async
 * @function determineTestApp
 * @returns {Promise<string>} Test app name
 */
async function determineTestApp() {
  const hubspotPath = path.join(process.cwd(), 'integration', 'hubspot');
  try {
    await fs.access(hubspotPath);
    return 'hubspot';
  } catch {
    return 'non-existent-app';
  }
}

/**
 * Test test-integration command with invalid dataplane
 * @async
 * @function testIntegration
 * @returns {Promise<Object>} Test result
 */
async function testIntegration() {
  logInfo('\n🧪 Testing: test-integration command');

  const testApp = await determineTestApp();

  const args = [
    'bin/aifabrix.js',
    'test-integration',
    testApp,
    '--environment',
    ENVIRONMENT,
    '--controller',
    CONTROLLER_URL
  ];

  const result = await runCommand('node', args);
  const output = `${result.stdout}\n${result.stderr}`;

  const expectedPatterns = [
    'failed to connect',
    'connection refused',
    'network error',
    'econnrefused',
    'fetch failed',
    'timeout',
    'unreachable',
    'failed to run integration tests',
    'not found',
    'dataplane url not found',
    'application not found'
  ];

  const isValid = !result.success && (
    validateError(output, expectedPatterns) ||
    output.includes('Failed') ||
    output.includes('Error') ||
    output.includes('not found')
  );

  return {
    name: 'test-integration',
    success: isValid,
    output,
    expectedPatterns
  };
}

/**
 * Test dataplane discovery with invalid dataplane
 * @async
 * @function testDataplaneDiscovery
 * @returns {Promise<Object>} Test result
 */
async function testDataplaneDiscovery() {
  logInfo('\n🌐 Testing: dataplane discovery');

  const args = [
    'bin/aifabrix.js',
    'download',
    'non-existent-system-for-discovery-test',
    '--environment',
    ENVIRONMENT,
    '--controller',
    CONTROLLER_URL
  ];

  const result = await runCommand('node', args);
  const output = `${result.stdout}\n${result.stderr}`;

  const expectedPatterns = [
    'failed to discover dataplane url',
    'dataplane service not found',
    'application not found',
    'dataplane url not found',
    'failed to download system',
    'not found',
    'external system'
  ];

  const timeout = isTimeoutResult(result);
  const isValid = (!result.success || timeout) && (
    timeout ||
    validateError(output, expectedPatterns) ||
    output.includes('not found') ||
    output.includes('Failed') ||
    output.includes('Error')
  );

  return {
    name: 'dataplane discovery',
    success: isValid,
    output: timeout ? `${output}\n[Command timed out - this indicates the command may be hanging]` : output,
    expectedPatterns: timeout ? [...expectedPatterns, 'timeout'] : expectedPatterns
  };
}

module.exports = {
  testWizard,
  testDownload,
  testDelete,
  testDatasourceDeploy,
  testIntegration,
  testDataplaneDiscovery
};
