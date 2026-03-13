/**
 * System-level pipeline test - single API call for all datasources
 * @fileoverview System-level test execution for integration tests
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-statements,complexity -- Map response to datasource results */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { testSystemViaPipeline } = require('../api/pipeline.api');
const { writeTestLog } = require('../utils/test-log-writer');
const { getIntegrationPath } = require('../utils/paths');

/**
 * Run system-level pipeline test and map response to datasource results
 * @async
 * @param {Object} params - Parameters
 * @param {string} params.appName - Application name
 * @param {string} params.systemKey - System key
 * @param {Object} params.authConfig - Auth config
 * @param {string} params.dataplaneUrl - Dataplane URL
 * @param {boolean} [params.debug] - Write debug log
 * @param {number} [params.timeout] - Request timeout
 * @returns {Promise<{success: boolean, datasourceResults: Object[]}>}
 */
async function runSystemLevelTest({ appName, systemKey, authConfig, dataplaneUrl, debug, timeout }) {
  const testData = { includeDebug: !!debug };
  const response = await testSystemViaPipeline(dataplaneUrl, systemKey, authConfig, testData, { timeout });
  const data = response.data || response;

  if (debug) {
    const appPath = getIntegrationPath(appName);
    const integrationDir = path.dirname(appPath);
    const logPath = await writeTestLog(appName, { request: { systemKey, includeDebug: true }, response: data }, 'test-integration', integrationDir);
    logger.log(chalk.gray(`  Debug log: ${logPath}`));
  }

  const rawResults = data.datasourceResults || data.results || data.data?.datasourceResults || (Array.isArray(data) ? data : []);
  const datasourceResults = [];
  let success = true;

  for (const r of rawResults) {
    const dsKey = r.key || r.sourceKey || r.name || r.datasourceKey;
    const dsResult = {
      key: dsKey,
      success: r.success !== false,
      skipped: !!r.skipped,
      reason: r.reason,
      validationResults: r.validationResults || {},
      fieldMappingResults: r.fieldMappingResults || {},
      endpointTestResults: r.endpointTestResults || {}
    };
    if (r.error) dsResult.error = r.error;
    if (!dsResult.success && !dsResult.skipped) success = false;
    datasourceResults.push(dsResult);
  }

  if (rawResults.length === 0 && data.success === false) {
    success = false;
    datasourceResults.push({
      key: 'system',
      success: false,
      skipped: false,
      error: data.error || data.formattedError || 'System test failed'
    });
  }

  return { success, datasourceResults };
}

module.exports = { runSystemLevelTest };
