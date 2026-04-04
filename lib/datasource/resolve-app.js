/**
 * Resolve app key for datasource commands from explicit --app, cwd, scan, or key parse.
 * @fileoverview App resolution for datasource test-e2e, test-integration, log-e2e, log-integration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const {
  getIntegrationPath,
  listIntegrationAppNames,
  resolveIntegrationAppKeyFromCwd
} = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile } = require('../utils/config-format');

/**
 * For one app, check if any of its datasource files has the given key
 * @param {string} appKey - Integration folder name (system key context)
 * @param {string} datasourceKey - Datasource key to match
 * @returns {boolean} True if this app has a datasource with that key
 */
function appHasDatasourceKey(appKey, datasourceKey) {
  const appPath = getIntegrationPath(appKey);
  let config;
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    config = loadConfigFile(configPath);
  } catch {
    return false;
  }
  const schemaBasePath = config.externalIntegration?.schemaBasePath || './';
  const datasourceFiles = config.externalIntegration?.dataSources || [];
  for (const f of datasourceFiles) {
    if (!f || typeof f !== 'string') continue;
    const fullPath = path.isAbsolute(schemaBasePath)
      ? path.join(schemaBasePath, f)
      : path.join(appPath, schemaBasePath, f);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const parsed = loadConfigFile(fullPath);
      if (parsed && parsed.key === datasourceKey) return true;
    } catch {
      // skip unreadable or invalid files
    }
  }
  return false;
}

/**
 * Resolve app key for a datasource: explicit --app, cwd, scan by key, or parse key convention.
 * @async
 * @param {string} datasourceKey - Datasource key (e.g. hubspot-test-company)
 * @param {string} [explicitApp] - Explicit integration folder from --app
 * @returns {Promise<{appKey: string}>} Resolved app key
 * @throws {Error} When app cannot be determined or multiple apps match
 */
/* eslint-disable-next-line max-statements -- Resolution order: explicit, cwd, scan, parse */
async function resolveAppKeyForDatasource(datasourceKey, explicitApp) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const key = String(datasourceKey).trim();
  if (key.length === 0) {
    throw new Error('Datasource key cannot be empty');
  }

  if (explicitApp && typeof explicitApp === 'string' && explicitApp.trim()) {
    const appPath = getIntegrationPath(explicitApp.trim());
    if (fs.existsSync(appPath)) {
      return { appKey: explicitApp.trim() };
    }
  }

  const fromCwd = resolveIntegrationAppKeyFromCwd();
  if (fromCwd && appHasDatasourceKey(fromCwd, key)) {
    return { appKey: fromCwd };
  }

  const appNames = listIntegrationAppNames();
  const matches = appNames.filter(appName => appHasDatasourceKey(appName, key));
  if (matches.length === 1) {
    return { appKey: matches[0] };
  }
  if (matches.length > 1) {
    throw new Error(
      `More than one app has this datasource; add --app <app>. Apps: ${matches.join(', ')}`
    );
  }

  const segments = key.split('-');
  if (segments.length >= 2) {
    const candidate = segments.slice(0, -1).join('-');
    const candidatePath = getIntegrationPath(candidate);
    if (fs.existsSync(candidatePath) && appHasDatasourceKey(candidate, key)) {
      return { appKey: candidate };
    }
  }

  throw new Error(
    'Could not determine app context. Use --app <app> or run from integration/<systemKey>/ directory.'
  );
}

module.exports = {
  resolveAppKeyForDatasource,
  appHasDatasourceKey
};
