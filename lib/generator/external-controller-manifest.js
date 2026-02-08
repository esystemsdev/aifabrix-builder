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
async function resolveAppPath(appName, options) {
  if (options.appPath) {
    return options.appPath;
  }
  const detected = await detectAppType(appName, { type: 'external' });
  return detected.appPath;
}

/**
 * Extracts app metadata from variables
 * @function extractAppMetadata
 * @param {Object} variables - Parsed variables.yaml
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
  const rbacPath = path.join(appPath, 'rbac.yaml');
  const rbac = loadRbac(rbacPath);
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
 * @returns {Promise<Object>} Controller manifest object
 * @throws {Error} If generation fails
 *
 * @example
 * const manifest = await generateControllerManifest('my-hubspot');
 * // Returns: { key, displayName, description, type: "external", system: {...}, dataSources: [...] }
 */
async function generateControllerManifest(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const appPath = await resolveAppPath(appName, options);
  const variablesPath = path.join(appPath, 'variables.yaml');
  const { parsed: variables } = loadVariables(variablesPath);

  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in variables.yaml');
  }

  const metadata = extractAppMetadata(variables, appName);
  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const systemFiles = variables.externalIntegration.systems || [];

  if (systemFiles.length === 0) {
    throw new Error('No system files specified in externalIntegration.systems');
  }

  const systemJson = await loadSystemWithRbac(appPath, schemaBasePath, systemFiles[0]);
  const datasourceFiles = variables.externalIntegration.dataSources || [];
  const datasourceJsons = await loadDatasourceFiles(appPath, schemaBasePath, datasourceFiles);

  const appVersion = variables.app?.version || variables.externalIntegration?.version || '1.0.0';

  // Build externalIntegration block (required by application schema for type: "external")
  const externalIntegration = {
    schemaBasePath: schemaBasePath,
    systems: systemFiles,
    dataSources: datasourceFiles,
    autopublish: variables.externalIntegration.autopublish !== false, // default true
    version: appVersion
  };

  const manifest = {
    key: metadata.appKey,
    displayName: metadata.displayName,
    description: metadata.description,
    type: 'external',
    version: appVersion,
    externalIntegration: externalIntegration,
    // Inline system and dataSources for atomic deployment (optional but recommended)
    system: systemJson,
    dataSources: datasourceJsons,
    // Explicitly set to false to satisfy conditional schema requirements
    requiresDatabase: false,
    requiresRedis: false,
    requiresStorage: false
  };

  return manifest;
}

module.exports = {
  generateControllerManifest
};
