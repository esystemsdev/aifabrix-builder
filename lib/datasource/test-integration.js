/**
 * Datasource integration test - run config test for one datasource via pipeline
 * @fileoverview Datasource integration test logic
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-lines-per-function,max-statements,complexity -- Load config, resolve datasource, call pipeline test */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile } = require('../utils/config-format');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { getConfig } = require('../core/config');
const { testDatasourceViaPipeline } = require('../api/pipeline.api');
const { writeTestLog } = require('../utils/test-log-writer');
const testHelpers = require('../utils/external-system-test-helpers');
const fs = require('fs').promises;

/**
 * Get systemKey for an integration app (from application config and first system file)
 * @param {string} appKey - Integration app key
 * @returns {Promise<string>} systemKey
 */
async function getSystemKeyFromAppKey(appKey) {
  const appPath = getIntegrationPath(appKey);
  const configPath = resolveApplicationConfigPath(appPath);
  const config = loadConfigFile(configPath);
  if (!config.externalIntegration || !config.externalIntegration.systems || config.externalIntegration.systems.length === 0) {
    throw new Error(`No externalIntegration.systems found in ${configPath}`);
  }
  const systemFile = config.externalIntegration.systems[0];
  const systemPath = path.isAbsolute(systemFile)
    ? systemFile
    : path.join(appPath, systemFile);
  const systemContent = await fs.readFile(systemPath, 'utf8');
  const yaml = require('js-yaml');
  const systemConfig = yaml.load(systemContent);
  return systemConfig?.key || path.basename(systemFile, '-system.yaml').replace('-system', '');
}

/**
 * Find a datasource filename by matching the key inside the file (fallback when filename-base match fails).
 * @param {string} appPath - Integration app directory path
 * @param {string} schemaBasePath - Schema base path (relative or absolute)
 * @param {string[]} datasourceFiles - List of datasource filenames from application config
 * @param {string} datasourceKey - Datasource key to find
 * @returns {string|null} Filename if found, null otherwise
 */
function findDatasourceFileByKey(appPath, schemaBasePath, datasourceFiles, datasourceKey) {
  const fsSync = require('fs');
  for (const f of datasourceFiles) {
    if (!f || typeof f !== 'string') continue;
    const fullPath = path.isAbsolute(schemaBasePath)
      ? path.join(schemaBasePath, f)
      : path.join(appPath, schemaBasePath, f);
    if (!fsSync.existsSync(fullPath)) continue;
    try {
      const parsed = loadConfigFile(fullPath);
      if (parsed && parsed.key === datasourceKey) return f;
    } catch {
      // skip unreadable or invalid files
    }
  }
  return null;
}

/**
 * Run integration test for one datasource
 * @async
 * @param {string} datasourceKey - Datasource key
 * @param {Object} options - Options
 * @param {string} [options.app] - App key (or resolve from cwd)
 * @param {string} [options.payload] - Path to custom payload file
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {boolean} [options.debug] - Include debug, write log file
 * @param {number} [options.timeout] - Request timeout ms
 * @returns {Promise<Object>} Test result
 */
async function runDatasourceTestIntegration(datasourceKey, options = {}) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  const systemKey = await getSystemKeyFromAppKey(appKey);
  const appPath = getIntegrationPath(appKey);
  const config = loadConfigFile(resolveApplicationConfigPath(appPath));
  const schemaBasePath = config.externalIntegration?.schemaBasePath || './';
  const datasourceFiles = config.externalIntegration?.dataSources || [];
  let datasourceFile = datasourceFiles.find(f => {
    const base = path.basename(f, path.extname(f));
    return base === datasourceKey || base.includes(datasourceKey);
  });
  if (!datasourceFile) {
    datasourceFile = findDatasourceFileByKey(appPath, schemaBasePath, datasourceFiles, datasourceKey);
  }
  if (!datasourceFile) {
    throw new Error(`Datasource '${datasourceKey}' not found in application config`);
  }
  const datasourcePath = path.isAbsolute(schemaBasePath)
    ? path.join(schemaBasePath, datasourceFile)
    : path.join(appPath, schemaBasePath, datasourceFile);
  const datasource = loadConfigFile(datasourcePath);
  if (datasource.key !== datasourceKey) {
    throw new Error(`Datasource key mismatch: file has '${datasource.key}', expected '${datasourceKey}'`);
  }

  const configObj = await getConfig();
  const { authConfig, dataplaneUrl } = await setupIntegrationTestAuth(appKey, options, configObj);
  const customPayload = await testHelpers.loadCustomPayload(options.payload);
  const payloadTemplate = testHelpers.determinePayloadTemplate(datasource, datasourceKey, customPayload);
  if (!payloadTemplate) {
    throw new Error(`No test payload found for datasource '${datasourceKey}'`);
  }

  logger.log(chalk.blue(`\n📡 Testing datasource: ${datasourceKey} (system: ${systemKey})`));

  const testData = { payloadTemplate };
  if (options.debug) {
    testData.includeDebug = true;
  }
  const timeout = parseInt(options.timeout, 10) || 30000;

  let response;
  try {
    response = await testDatasourceViaPipeline({
      dataplaneUrl,
      systemKey,
      datasourceKey,
      authConfig,
      testData,
      options: { timeout }
    });
  } catch (error) {
    const result = { key: datasourceKey, success: false, error: error.message };
    if (options.debug) {
      await writeTestLog(appKey, { request: { systemKey, datasourceKey }, error: error.message }, 'test-integration');
    }
    return result;
  }

  const data = response.data || response;
  const success = data.success !== false;
  const result = {
    key: datasourceKey,
    systemKey,
    success,
    skipped: false,
    validationResults: data.validationResults || {},
    fieldMappingResults: data.fieldMappingResults || {},
    endpointTestResults: data.endpointTestResults || {}
  };
  if (data.error) {
    result.error = data.error;
  }

  if (options.debug) {
    const logPath = await writeTestLog(appKey, {
      request: { systemKey, datasourceKey, includeDebug: true },
      response: data
    }, 'test-integration');
    logger.log(chalk.gray(`  Debug log: ${logPath}`));
  }

  return result;
}

module.exports = {
  runDatasourceTestIntegration,
  getSystemKeyFromAppKey
};
