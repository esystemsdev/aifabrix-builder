/**
 * @fileoverview Resolve datasource file path + parsed config for unified validation.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getIntegrationPath } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile } = require('../utils/config-format');
const {
  datasourceIdentifierMatchesFile,
  resolveDatasourceFilePath
} = require('./datasource-identifier');

/**
 * @param {string} appPath
 * @param {string} schemaBasePath
 * @param {string[]} datasourceFiles
 * @param {string} identifier
 * @returns {string|null}
 */
function findDatasourceFileByIdentifier(appPath, schemaBasePath, datasourceFiles, identifier) {
  const fsSync = require('fs');
  for (const fileRef of datasourceFiles) {
    if (!fileRef || typeof fileRef !== 'string') {
      continue;
    }
    const fullPath = resolveDatasourceFilePath(appPath, schemaBasePath, fileRef);
    if (!fsSync.existsSync(fullPath)) {
      continue;
    }
    try {
      const parsed = loadConfigFile(fullPath);
      if (datasourceIdentifierMatchesFile(identifier, fileRef, parsed)) {
        return fileRef;
      }
    } catch {
      // skip unreadable or invalid files
    }
  }
  return null;
}

/**
 * @param {string} appKey
 * @param {string} datasourceKey
 * @param {Function} findDatasourceFileByKey - From integration-context
 * @returns {{ datasource: Object, datasourcePath: string, datasourceKey: string }}
 */
function loadDatasourceForApp(appKey, datasourceKey, findDatasourceFileByKey) {
  const appPath = getIntegrationPath(appKey);
  const config = loadConfigFile(resolveApplicationConfigPath(appPath));
  const schemaBasePath = config.externalIntegration?.schemaBasePath || './';
  const datasourceFiles = config.externalIntegration?.dataSources || [];
  let datasourceFile = findDatasourceFileByIdentifier(
    appPath,
    schemaBasePath,
    datasourceFiles,
    datasourceKey
  );
  if (!datasourceFile) {
    datasourceFile = findDatasourceFileByKey(appPath, schemaBasePath, datasourceFiles, datasourceKey);
  }
  if (!datasourceFile) {
    throw new Error(`Datasource '${datasourceKey}' not found in application config`);
  }
  const datasourcePath = resolveDatasourceFilePath(appPath, schemaBasePath, datasourceFile);
  const datasource = loadConfigFile(datasourcePath);
  const canonicalKey = datasource.key;
  if (!canonicalKey || typeof canonicalKey !== 'string') {
    throw new Error(`Datasource file is missing a valid key: ${datasourcePath}`);
  }
  return { datasource, datasourcePath, datasourceKey: canonicalKey };
}

module.exports = { loadDatasourceForApp };
