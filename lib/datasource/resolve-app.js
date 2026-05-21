/**
 * Resolve app key for datasource commands from explicit --app, cwd, scan, or key parse.
 * @fileoverview App resolution for datasource test-e2e, test-integration, log-e2e, log-integration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const {
  getIntegrationPath,
  listIntegrationAppNames,
  resolveIntegrationAppKeyFromCwd
} = require('../utils/paths');
const {
  appHasDatasourceIdentifier,
  pickIntegrationAppForDatasourceIdentifier
} = require('./datasource-identifier');

/** @deprecated Use appHasDatasourceIdentifier — kept for tests and backward compatibility */
function appHasDatasourceKey(appKey, datasourceKey) {
  return appHasDatasourceIdentifier(appKey, datasourceKey);
}

/**
 * @param {string} key
 * @param {string} [explicitApp]
 * @returns {{ appKey: string }|null}
 */
function resolveFromExplicitApp(key, explicitApp) {
  if (!explicitApp || typeof explicitApp !== 'string' || !explicitApp.trim()) {
    return null;
  }
  const appKey = explicitApp.trim();
  if (fs.existsSync(getIntegrationPath(appKey))) {
    return { appKey };
  }
  return null;
}

/**
 * @param {string} key
 * @param {string[]} appNames
 * @returns {{ appKey: string }|null}
 * @throws {Error}
 */
function resolveFromAppScan(key, appNames) {
  const matches = appNames.filter(appName => appHasDatasourceIdentifier(appName, key));
  if (matches.length === 1) {
    return { appKey: matches[0] };
  }
  if (matches.length > 1) {
    throw new Error(
      `More than one app has this datasource; add --app <app>. Apps: ${matches.join(', ')}`
    );
  }
  return null;
}

/**
 * @param {string} key
 * @param {string[]} appNames
 * @returns {{ appKey: string }|null}
 */
function resolveFromPrefixOrSegments(key, appNames) {
  const prefixApp = pickIntegrationAppForDatasourceIdentifier(key, appNames);
  if (prefixApp && appHasDatasourceIdentifier(prefixApp, key)) {
    return { appKey: prefixApp };
  }
  const segments = key.split('-');
  if (segments.length < 2) {
    return null;
  }
  const candidate = segments.slice(0, -1).join('-');
  const candidatePath = getIntegrationPath(candidate);
  if (fs.existsSync(candidatePath) && appHasDatasourceIdentifier(candidate, key)) {
    return { appKey: candidate };
  }
  return null;
}

const RESOLVE_APP_HINT =
  'Could not determine app context. Use --app <app>, a datasource key, a datasource JSON filename (e.g. myapp-datasource-contacts), or run from integration/<systemKey>/ directory.';

/**
 * Resolve app key for a datasource: explicit --app, cwd, scan by key, or parse key convention.
 * @async
 * @param {string} datasourceKey - Datasource key (e.g. hubspot-test-company)
 * @param {string} [explicitApp] - Explicit integration folder from --app
 * @returns {Promise<{appKey: string}>} Resolved app key
 * @throws {Error} When app cannot be determined or multiple apps match
 */
async function resolveAppKeyForDatasource(datasourceKey, explicitApp) {
  if (!datasourceKey || typeof datasourceKey !== 'string') {
    throw new Error('Datasource key is required');
  }
  const key = String(datasourceKey).trim();
  if (key.length === 0) {
    throw new Error('Datasource key cannot be empty');
  }

  const explicit = resolveFromExplicitApp(key, explicitApp);
  if (explicit) {
    return explicit;
  }

  const fromCwd = resolveIntegrationAppKeyFromCwd();
  if (fromCwd && appHasDatasourceIdentifier(fromCwd, key)) {
    return { appKey: fromCwd };
  }

  const appNames = listIntegrationAppNames();
  const scanned = resolveFromAppScan(key, appNames);
  if (scanned) {
    return scanned;
  }

  const inferred = resolveFromPrefixOrSegments(key, appNames);
  if (inferred) {
    return inferred;
  }

  throw new Error(RESOLVE_APP_HINT);
}

module.exports = {
  resolveAppKeyForDatasource,
  appHasDatasourceKey
};
