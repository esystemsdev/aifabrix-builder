/**
 * External System Controller Manifest Generator
 *
 * Generates controller-compatible deployment manifest for external systems.
 * Creates manifest with inline system + dataSources in controller format.
 *
 * @fileoverview Controller manifest generation for external systems
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const { detectAppType } = require('../utils/paths');
const { resolveApplicationConfigPath, resolveRbacPath } = require('../utils/app-config-resolver');
const { orderDatasourceFileNamesBySystemKeys } = require('../utils/schema-resolver');
const { loadSystemFile, loadDatasourceFiles } = require('./external');
const { loadVariables, loadRbac } = require('./helpers');

/**
 * Merges RBAC into system JSON
 * @function mergeRbacIntoSystemJson
 * @param {Object} systemJson - System JSON object
 * @param {Object|null} rbac - RBAC configuration
 */
function mergeRbacIntoSystemJson(systemJson, rbac) {
  if (!rbac) {
    return;
  }

  // Priority: roles/permissions in system JSON > rbac.yaml (if both exist, prefer JSON)
  if (rbac.roles && (!systemJson.roles || systemJson.roles.length === 0)) {
    systemJson.roles = rbac.roles;
  }
  if (rbac.permissions && (!systemJson.permissions || systemJson.permissions.length === 0)) {
    systemJson.permissions = rbac.permissions;
  }
}

/**
 * Resolves application path from options or detection
 * @async
 * @function resolveAppPath
 * @param {string} appName - Application name
 * @param {Object} options - Options with optional appPath
 * @returns {Promise<string>} Application path
 */
async function resolveAppPath(appName, options = {}) {
  if (options && options.appPath) {
    return options.appPath;
  }
  const detected = await detectAppType(appName);
  return detected.appPath;
}

/**
 * Extracts app metadata from variables
 * @function extractAppMetadata
 * @param {Object} variables - Parsed application config
 * @param {string} appName - Application name
 * @returns {Object} App metadata { appKey, displayName, description }
 */
function extractAppMetadata(variables, appName) {
  return {
    appKey: variables.app?.key || appName,
    displayName: variables.app?.displayName || appName,
    description: variables.app?.description || `External system integration for ${appName}`
  };
}

/**
 * Loads and merges system with RBAC
 * @async
 * @function loadSystemWithRbac
 * @param {string} appPath - Application path
 * @param {string} schemaBasePath - Schema base path
 * @param {string} systemFile - System file path
 * @returns {Promise<Object>} System JSON with RBAC merged
 */
async function loadSystemWithRbac(appPath, schemaBasePath, systemFile) {
  const systemJson = await loadSystemFile(appPath, schemaBasePath, systemFile);
  const rbacPath = resolveRbacPath(appPath);
  const rbac = rbacPath ? loadRbac(rbacPath) : null;
  mergeRbacIntoSystemJson(systemJson, rbac);
  return systemJson;
}

/**
 * Generates controller-compatible deployment manifest for external systems
 * Creates manifest with inline system + dataSources in controller format
 *
 * @async
 * @function generateControllerManifest
 * @param {string} appName - Application name
 * @param {Object} [options] - Optional parameters
 * @param {string} [options.appPath] - Application path (if provided, skips detection)
 * @param {boolean} [options.skipMissingDatasourceFiles] - If true, skip datasource files that don't exist (e.g. when generating deploy JSON)
 * @returns {Promise<Object>} Controller manifest object
 * @throws {Error} If generation fails
 *
 * @example
 * const manifest = await generateControllerManifest('my-hubspot');
 * // Returns: { key, displayName, description, type: "external", system: {...}, dataSources: [...] }
 */
function normalizeSchemaBasePath(schemaBasePath, appPath, appName) {
  const base = path.normalize(schemaBasePath || './').replace(/[/\\]+$/, '');
  return base === path.join('integration', appName) ? './' : (schemaBasePath || './');
}

async function generateControllerManifest(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const appPath = await resolveAppPath(appName, options);
  const { parsed: variables } = loadVariables(resolveApplicationConfigPath(appPath));
  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in application.yaml');
  }
  const metadata = extractAppMetadata(variables, appName);
  const schemaBasePath = normalizeSchemaBasePath(
    variables.externalIntegration.schemaBasePath,
    appPath,
    appName
  );
  const systemFiles = variables.externalIntegration.systems || [];
  if (systemFiles.length === 0) {
    throw new Error('No system files specified in externalIntegration.systems');
  }
  const schemaResolved = path.isAbsolute(schemaBasePath)
    ? schemaBasePath
    : path.resolve(appPath, schemaBasePath);
  const rawDatasourceNames = variables.externalIntegration.dataSources || [];
  const orderedDatasourceNames = orderDatasourceFileNamesBySystemKeys(
    schemaResolved,
    systemFiles,
    rawDatasourceNames
  );
  const [systemJson, datasourceJsons] = await Promise.all([
    loadSystemWithRbac(appPath, schemaBasePath, systemFiles[0]),
    loadDatasourceFiles(appPath, schemaBasePath, orderedDatasourceNames, {
      skipMissingDatasourceFiles: options.skipMissingDatasourceFiles
    })
  ]);
  const appVersion = variables.app?.version || variables.externalIntegration?.version || '1.0.0';
  const externalIntegration = {
    schemaBasePath,
    systems: systemFiles,
    dataSources: orderedDatasourceNames,
    autopublish: variables.externalIntegration.autopublish !== false,
    version: appVersion
  };
  return {
    key: metadata.appKey,
    displayName: metadata.displayName,
    description: metadata.description,
    type: 'external',
    version: appVersion,
    externalIntegration,
    system: systemJson,
    dataSources: datasourceJsons,
    requiresDatabase: false,
    requiresRedis: false,
    requiresStorage: false
  };
}

/**
 * Returns deploy-file shape: system + dataSources only (no file-name lists).
 * Use when writing *-deploy.json to disk; file names live in application config only.
 *
 * @function toDeployJsonShape
 * @param {Object} manifest - Full controller manifest from generateControllerManifest
 * @returns {Object} { key, displayName, description, type, version, system, dataSources }
 */
function toDeployJsonShape(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest is required');
  }
  return {
    key: manifest.key,
    displayName: manifest.displayName,
    description: manifest.description,
    type: manifest.type || 'external',
    version: manifest.version || '1.0.0',
    system: manifest.system,
    dataSources: Array.isArray(manifest.dataSources) ? manifest.dataSources : []
  };
}

module.exports = {
  generateControllerManifest,
  toDeployJsonShape
};
