/**
 * External System Test Execution
 *
 * Test execution functions for integration tests
 *
 * @fileoverview Test execution utilities for external system testing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const testHelpers = require('../utils/external-system-test-helpers');

/**
 * Executes test for a single datasource
 * @async
 * @function executeDatasourceTest
 * @param {string} systemKey - System key
 * @param {string} datasourceKey - Datasource key
 * @param {Object} payloadTemplate - Payload template
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Test result
 */
async function executeDatasourceTest(systemKey, datasourceKey, payloadTemplate, dataplaneUrl, authConfig, options) {
  try {
    const datasourceResult = await testHelpers.testSingleDatasource({
      systemKey,
      datasourceKey,
      payloadTemplate,
      dataplaneUrl,
      authConfig,
      timeout: parseInt(options.timeout, 10) || 30000
    });
    return datasourceResult;
  } catch (error) {
    return {
      key: datasourceKey,
      skipped: false,
      success: false,
      error: error.message
    };
  }
}

/**
 * Tests a single datasource integration
 * @async
 * @function testSingleDatasourceIntegration
 * @param {Object} datasourceFile - Datasource file object
 * @param {string} systemKey - System key
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} customPayload - Custom payload
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Test result
 */
async function testSingleDatasourceIntegration(datasourceFile, systemKey, dataplaneUrl, authConfig, customPayload, options) {
  const datasource = datasourceFile.data;
  const datasourceKey = datasource.key;

  logger.log(chalk.blue(`\n📡 Testing datasource: ${datasourceKey}`));

  // Determine payload to use
  const payloadTemplate = testHelpers.determinePayloadTemplate(datasource, datasourceKey, customPayload);
  if (!payloadTemplate) {
    logger.log(chalk.yellow(`  ⚠ No test payload found for ${datasourceKey}, skipping...`));
    return {
      key: datasourceKey,
      skipped: true,
      reason: 'No test payload available'
    };
  }

  return await executeDatasourceTest(systemKey, datasourceKey, payloadTemplate, dataplaneUrl, authConfig, options);
}

module.exports = {
  executeDatasourceTest,
  testSingleDatasourceIntegration
};

