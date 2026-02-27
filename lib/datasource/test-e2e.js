/**
 * Datasource E2E test - run full E2E test via dataplane external API
 * @fileoverview Datasource E2E test logic (config, credential, sync, data, CIP)
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-statements -- Auth setup, API call, debug log */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath, resolveIntegrationAppKeyFromCwd } = require('../utils/paths');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getDeviceOnlyAuth } = require('../utils/token-manager');
const { testDatasourceE2E } = require('../api/external-test.api');
const { writeTestLog } = require('../utils/test-log-writer');

/**
 * Resolve appKey for datasource test-e2e
 * @param {string} [appKey] - Explicit app key from --app
 * @returns {string}
 */
function resolveAppKey(appKey) {
  if (appKey) return appKey;
  const fromCwd = resolveIntegrationAppKeyFromCwd();
  if (fromCwd) return fromCwd;
  throw new Error(
    'Could not determine app context. Use --app <appKey> or run from integration/<appKey>/ directory.'
  );
}

/**
 * Run E2E test for one datasource (Bearertoken or API key required; no client credentials)
 * @async
 * @param {string} datasourceKey - Datasource key (used as sourceIdOrKey)
 * @param {Object} options - Options
 * @param {string} [options.app] - App key (or resolve from cwd)
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {boolean} [options.debug] - Include debug, write log file
 * @returns {Promise<Object>} E2E test result
 */
async function runDatasourceTestE2E(datasourceKey, options = {}) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const appKey = resolveAppKey(options.app);
  const controllerUrl = await resolveControllerUrl();
  const { resolveEnvironment } = require('../core/config');
  const environment = options.environment || await resolveEnvironment();
  const authConfig = await getDeviceOnlyAuth(controllerUrl);
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);

  logger.log(chalk.blue(`\n🧪 Running E2E test for datasource: ${datasourceKey}`));

  const body = options.debug ? { includeDebug: true } : {};
  let response;
  try {
    response = await testDatasourceE2E(dataplaneUrl, datasourceKey, authConfig, body);
  } catch (error) {
    if (options.debug) {
      const appPath = getIntegrationPath(appKey);
      const integrationDir = path.dirname(appPath);
      await writeTestLog(appKey, {
        request: { sourceIdOrKey: datasourceKey, includeDebug: options.debug },
        error: error.message
      }, 'test-e2e', integrationDir);
    }
    throw error;
  }

  const data = response.data || response;
  if (options.debug) {
    const appPath = getIntegrationPath(appKey);
    const integrationDir = path.dirname(appPath);
    const logPath = await writeTestLog(appKey, {
      request: { sourceIdOrKey: datasourceKey, includeDebug: true },
      response: data
    }, 'test-e2e', integrationDir);
    logger.log(chalk.gray(`  Debug log: ${logPath}`));
  }

  return data;
}

module.exports = {
  runDatasourceTestE2E,
  resolveAppKey
};
