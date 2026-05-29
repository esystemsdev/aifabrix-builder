/**
 * @fileoverview Shared context resolution for datasource load/export (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { getConfig } = require('../core/config');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { applyLabDataplaneApiKeyBearer } = require('../utils/token-manager');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const { getSystemKeyFromAppKey } = require('./integration-context');
const { loadDatasourceForApp } = require('./unified-validation-run-resolve');
const { findDatasourceFileByKey } = require('./integration-context');
const { getIntegrationPath } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { computeEntitySuffix } = require('./local-data-paths');

/**
 * @param {string} appKey
 * @throws {Error}
 */
async function assertExternalIntegrationApp(appKey) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(appKey).catch(() => null);
  if (!appType || appType.baseDir !== 'integration') {
    throw new Error(
      'datasource load/export apply to external integration folders only (integration/<systemKey>/).'
    );
  }
}

/**
 * @async
 * @param {string} datasourceKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function resolveLoadExportContext(datasourceKey, options = {}) {
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  await assertExternalIntegrationApp(appKey);
  const systemKey = await getSystemKeyFromAppKey(appKey);
  const {
    datasource,
    datasourcePath,
    datasourceKey: canonicalDatasourceKey
  } = loadDatasourceForApp(appKey, datasourceKey, findDatasourceFileByKey);
  const appPath = getIntegrationPath(appKey);
  const manifestPath = resolveApplicationConfigPath(appPath);
  const entitySuffix = computeEntitySuffix(systemKey, canonicalDatasourceKey);

  let authConfig = options.authConfig;
  let dataplaneUrl = options.dataplaneUrl || options.dataplane;
  if (!authConfig || !dataplaneUrl) {
    const configObj = await getConfig();
    const auth = await setupIntegrationTestAuth(
      appKey,
      { environment: options.environment || options.env, dataplane: options.dataplane },
      configObj
    );
    authConfig = auth.authConfig;
    dataplaneUrl = auth.dataplaneUrl;
  }

  authConfig = applyLabDataplaneApiKeyBearer(authConfig);

  return {
    appKey,
    systemKey,
    datasourceKey: canonicalDatasourceKey,
    datasource,
    datasourcePath,
    manifestPath,
    entitySuffix,
    authConfig,
    dataplaneUrl,
    environment: options.environment || options.env
  };
}

/**
 * Gray manifest label segment for TTY (integration/<appKey>).
 * @param {string} appKey
 * @returns {string}
 */
function integrationManifestLabel(appKey) {
  return `integration/${appKey}`;
}

module.exports = {
  assertExternalIntegrationApp,
  resolveLoadExportContext,
  integrationManifestLabel
};
