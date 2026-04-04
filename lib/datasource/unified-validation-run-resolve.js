/**
 * @fileoverview Resolve datasource file path + parsed config for unified validation.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const { getIntegrationPath } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile } = require('../utils/config-format');

/**
 * @param {string} appKey
 * @param {string} datasourceKey
 * @param {Function} findDatasourceFileByKey - From integration-context
 * @returns {{ datasource: Object, datasourcePath: string }}
 */
function loadDatasourceForApp(appKey, datasourceKey, findDatasourceFileByKey) {
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
  return { datasource, datasourcePath };
}

module.exports = { loadDatasourceForApp };
