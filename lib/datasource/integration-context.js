/**
 * @fileoverview Shared integration app resolution (system key, datasource file lookup).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs').promises;
const { getIntegrationPath } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile } = require('../utils/config-format');

/**
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
 * Find a datasource filename by matching the key inside the file.
 * @param {string} appPath
 * @param {string} schemaBasePath
 * @param {string[]} datasourceFiles
 * @param {string} datasourceKey
 * @returns {string|null}
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

module.exports = {
  getSystemKeyFromAppKey,
  findDatasourceFileByKey
};
