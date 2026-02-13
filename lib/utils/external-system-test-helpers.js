/**
 * External System Test Helper Functions
 *
 * Helper functions for external system testing.
 * Separated from external-system-test.js to maintain file size limits.
 *
 * @fileoverview External system test helper functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { testDatasourceViaPipeline } = require('../api/pipeline.api');
const { requireBearerForDataplanePipeline } = require('./token-manager');

/**
 * Retry API call with exponential backoff
 * @async
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} backoffMs - Initial backoff delay in milliseconds
 * @returns {Promise<any>} Function result
 * @throws {Error} Last error if all retries fail
 */
async function retryApiCall(fn, maxRetries = 3, backoffMs = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Calls pipeline test endpoint using centralized API client
 * @async
 * @param {Object} params - Function parameters
 * @param {string} params.systemKey - System key
 * @param {string} params.datasourceKey - Datasource key
 * @param {Object} params.payloadTemplate - Test payload template
 * @param {string} params.dataplaneUrl - Dataplane URL
 * @param {Object} params.authConfig - Authentication configuration
 * @param {number} [params.timeout] - Request timeout in milliseconds (default: 30000)
 * @returns {Promise<Object>} Test response
 */
async function callPipelineTestEndpoint({ systemKey, datasourceKey, payloadTemplate, dataplaneUrl, authConfig, timeout = 30000 }) {
  requireBearerForDataplanePipeline(authConfig);
  const response = await retryApiCall(async() => {
    return await testDatasourceViaPipeline({
      dataplaneUrl,
      systemKey,
      datasourceKey,
      authConfig,
      testData: { payloadTemplate },
      options: { timeout }
    });
  });

  if (!response.success || !response.data) {
    throw new Error(`Test endpoint failed: ${response.error || response.formattedError || 'Unknown error'}`);
  }

  return response.data.data || response.data;
}

/**
 * Load custom payload from file if provided
 * @async
 * @param {string} [payloadPath] - Path to custom payload file
 * @returns {Promise<Object|null>} Custom payload or null
 */
async function loadCustomPayload(payloadPath) {
  if (!payloadPath) {
    return null;
  }

  const absolutePath = path.isAbsolute(payloadPath) ? payloadPath : path.join(process.cwd(), payloadPath);
  const payloadContent = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(payloadContent);
}

/**
 * Determine payload template for a datasource
 * @param {Object} datasource - Datasource configuration
 * @param {string} datasourceKey - Datasource key
 * @param {Object|null} customPayload - Custom payload if provided
 * @returns {Object|null} Payload template or null
 */
function determinePayloadTemplate(datasource, datasourceKey, customPayload) {
  if (customPayload) {
    return customPayload;
  }
  if (datasource.testPayload && datasource.testPayload.payloadTemplate) {
    return datasource.testPayload.payloadTemplate;
  }
  return null;
}

/**
 * Test a single datasource via pipeline
 * @async
 * @param {Object} params - Test parameters
 * @param {string} params.systemKey - System key
 * @param {string} params.datasourceKey - Datasource key
 * @param {Object} params.payloadTemplate - Payload template
 * @param {string} params.dataplaneUrl - Dataplane URL
 * @param {Object} params.authConfig - Authentication configuration
 * @param {number} params.timeout - Request timeout
 * @returns {Promise<Object>} Test result
 */
async function testSingleDatasource({ systemKey, datasourceKey, payloadTemplate, dataplaneUrl, authConfig, timeout }) {
  const testResponse = await callPipelineTestEndpoint({
    systemKey,
    datasourceKey,
    payloadTemplate,
    dataplaneUrl,
    authConfig,
    timeout
  });

  return {
    key: datasourceKey,
    skipped: false,
    success: testResponse.success !== false,
    validationResults: testResponse.validationResults || {},
    fieldMappingResults: testResponse.fieldMappingResults || {},
    endpointTestResults: testResponse.endpointTestResults || {}
  };
}

module.exports = {
  retryApiCall,
  callPipelineTestEndpoint,
  loadCustomPayload,
  determinePayloadTemplate,
  testSingleDatasource
};

