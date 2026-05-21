/**
 * @fileoverview Match datasource CLI identifiers to integration files (key or filename stem).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { getIntegrationPath } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile } = require('../utils/config-format');

/**
 * @param {string} fileRef
 * @returns {string}
 */
function datasourceFileStem(fileRef) {
  return path.basename(String(fileRef || ''), path.extname(String(fileRef || '')));
}

/**
 * True when identifier matches parsed `key` or the datasource JSON filename (with or without .json).
 * @param {string} identifier
 * @param {string} fileRef - Manifest-relative datasource path
 * @param {Object|null} parsed
 * @returns {boolean}
 */
function datasourceIdentifierMatchesFile(identifier, fileRef, parsed) {
  const id = String(identifier || '').trim();
  if (!id || !parsed || typeof parsed !== 'object') {
    return false;
  }
  if (parsed.key === id) {
    return true;
  }
  const stem = datasourceFileStem(fileRef);
  if (stem === id) {
    return true;
  }
  if (`${stem}.json` === id.toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Pick integration app folder for a datasource identifier (longest matching prefix wins).
 * @param {string} identifier
 * @param {string[]} appNames
 * @returns {string|null}
 */
function pickIntegrationAppForDatasourceIdentifier(identifier, appNames) {
  const id = String(identifier || '').trim();
  if (!id) {
    return null;
  }
  const matches = appNames.filter(app => id === app || id.startsWith(`${app}-`));
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => b.length - a.length);
  return matches[0];
}

/**
 * List manifest datasource files for an integration app.
 * @param {string} appKey
 * @returns {{ appPath: string, schemaBasePath: string, datasourceFiles: string[] }|null}
 */
function listDatasourceFilesForApp(appKey) {
  const appPath = getIntegrationPath(appKey);
  let config;
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    config = loadConfigFile(configPath);
  } catch {
    return null;
  }
  const schemaBasePath = config.externalIntegration?.schemaBasePath || './';
  const datasourceFiles = config.externalIntegration?.dataSources || [];
  return { appPath, schemaBasePath, datasourceFiles };
}

/**
 * @param {string} appPath
 * @param {string} schemaBasePath
 * @param {string} fileRef
 * @returns {string}
 */
function resolveDatasourceFilePath(appPath, schemaBasePath, fileRef) {
  if (path.isAbsolute(schemaBasePath)) {
    return path.join(schemaBasePath, fileRef);
  }
  return path.join(appPath, schemaBasePath, fileRef);
}

/**
 * Collect datasource file refs in one app that match the identifier.
 * @param {string} appKey
 * @param {string} identifier
 * @returns {string[]}
 */
function collectDatasourceFileRefsMatchingIdentifier(appKey, identifier) {
  const listed = listDatasourceFilesForApp(appKey);
  if (!listed) {
    return [];
  }
  const fsSync = require('fs');
  const hits = [];
  for (const fileRef of listed.datasourceFiles) {
    if (!fileRef || typeof fileRef !== 'string') {
      continue;
    }
    const fullPath = resolveDatasourceFilePath(listed.appPath, listed.schemaBasePath, fileRef);
    if (!fsSync.existsSync(fullPath)) {
      continue;
    }
    try {
      const parsed = loadConfigFile(fullPath);
      if (datasourceIdentifierMatchesFile(identifier, fileRef, parsed)) {
        hits.push(fileRef);
      }
    } catch {
      // skip unreadable or invalid files
    }
  }
  return hits;
}

/**
 * @param {string} appKey
 * @param {string} identifier
 * @returns {boolean}
 */
function appHasDatasourceIdentifier(appKey, identifier) {
  return collectDatasourceFileRefsMatchingIdentifier(appKey, identifier).length > 0;
}

module.exports = {
  datasourceFileStem,
  datasourceIdentifierMatchesFile,
  pickIntegrationAppForDatasourceIdentifier,
  listDatasourceFilesForApp,
  resolveDatasourceFilePath,
  collectDatasourceFileRefsMatchingIdentifier,
  appHasDatasourceIdentifier
};
