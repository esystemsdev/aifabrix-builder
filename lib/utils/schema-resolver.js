/**
 * Schema Resolution Utilities
 *
 * Resolves paths for external integration schemas from application configuration.
 * Handles schemaBasePath resolution and external file discovery.
 *
 * @fileoverview Schema path resolution utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { detectAppType } = require('./paths');
const { resolveApplicationConfigPath } = require('./app-config-resolver');
const { loadConfigFile } = require('./config-format');

/**
 * Resolves schemaBasePath from application config
 * Supports both absolute and relative paths
 *
 * @async
 * @function resolveSchemaBasePath
 * @param {string} appName - Application name
 * @returns {Promise<string>} Resolved absolute path to schema base directory
 * @throws {Error} If application config not found, externalIntegration missing, or path invalid
 *
 * @example
 * const basePath = await resolveSchemaBasePath('myapp');
 * // Returns: '/path/to/builder/myapp/schemas'
 */
/**
 * Loads and validates application config for schema resolution
 * @async
 * @function loadAndValidateVariablesForSchema
 * @param {string} appName - Application name
 * @param {string} appPath - Application path
 * @returns {Promise<{ variables: Object, configPath: string }>} Variables object and config path
 * @throws {Error} If file not found or invalid
 */
async function loadAndValidateVariablesForSchema(appName, appPath) {
  const configPath = resolveApplicationConfigPath(appPath);
  try {
    const variables = loadConfigFile(configPath);
    return { variables, configPath };
  } catch (error) {
    throw new Error(`Application config error: ${error.message}`);
  }
}

/**
 * Validates externalIntegration block
 * @function validateExternalIntegrationBlock
 * @param {Object} variables - Variables object
 * @param {string} appName - Application name
 * @returns {string} Schema base path
 * @throws {Error} If block is missing or invalid
 */
function validateExternalIntegrationBlock(variables, appName) {
  if (!variables.externalIntegration) {
    throw new Error(`externalIntegration block not found in application config for app: ${appName}`);
  }
  if (!variables.externalIntegration.schemaBasePath) {
    throw new Error(`schemaBasePath not found in externalIntegration block for app: ${appName}`);
  }
  return variables.externalIntegration.schemaBasePath;
}

/**
 * Resolves and validates schema base path
 * @function resolveAndValidateSchemaPath
 * @param {string} schemaBasePath - Schema base path from config
 * @param {string} variablesPath - Path to application config
 * @returns {string} Resolved and validated path
 * @throws {Error} If path is invalid
 */
function resolveAndValidateSchemaPath(schemaBasePath, variablesPath) {
  const variablesDir = path.dirname(variablesPath);
  let resolvedPath = path.isAbsolute(schemaBasePath)
    ? schemaBasePath
    : path.resolve(variablesDir, schemaBasePath);

  resolvedPath = path.normalize(resolvedPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Schema base path does not exist: ${resolvedPath}`);
  }
  if (!fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`Schema base path is not a directory: ${resolvedPath}`);
  }

  return resolvedPath;
}

async function resolveSchemaBasePath(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const { appPath } = await detectAppType(appName, options);
  const { variables, configPath } = await loadAndValidateVariablesForSchema(appName, appPath);
  const schemaBasePath = validateExternalIntegrationBlock(variables, appName);

  return resolveAndValidateSchemaPath(schemaBasePath, configPath);
}

/**
 * Resolves all external system and datasource files from application configuration
 * Returns array of file paths with metadata
 *
 * @async
 * @function resolveExternalFiles
 * @param {string} appName - Application name
 * @returns {Promise<Array<{path: string, type: 'system'|'datasource', fileName: string}>>} Array of resolved file paths with metadata
 * @throws {Error} If files cannot be resolved or do not exist
 *
 * @example
 * const files = await resolveExternalFiles('myapp');
 * // Returns: [
 * //   { path: '/path/to/hubspot.json', type: 'system', fileName: 'hubspot.json' },
 * //   { path: '/path/to/hubspot-deal.json', type: 'datasource', fileName: 'hubspot-deal.json' }
 * // ]
 */
/**
 * Resolves a single external file
 * @function resolveSingleExternalFile
 * @param {string} schemaBasePath - Schema base path
 * @param {string} fileName - File name
 * @param {string} type - File type ('system' or 'datasource')
 * @returns {Object} Resolved file object
 * @throws {Error} If file not found
 */
function resolveSingleExternalFile(schemaBasePath, fileName, type) {
  const filePath = path.join(schemaBasePath, fileName);
  const normalizedPath = path.normalize(filePath);

  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`External ${type} file not found: ${normalizedPath}`);
  }

  return {
    path: normalizedPath,
    type: type,
    fileName: fileName
  };
}

/**
 * Resolves system files
 * @function resolveSystemFiles
 * @param {string} schemaBasePath - Schema base path
 * @param {string[]} systemFiles - Array of system file names
 * @returns {Object[]} Array of resolved file objects
 */
function resolveSystemFiles(schemaBasePath, systemFiles) {
  if (!systemFiles || !Array.isArray(systemFiles)) {
    return [];
  }

  return systemFiles.map(fileName => resolveSingleExternalFile(schemaBasePath, fileName, 'system'));
}

/**
 * Resolves datasource files
 * @function resolveDatasourceFiles
 * @param {string} schemaBasePath - Schema base path
 * @param {string[]} datasourceFiles - Array of datasource file names
 * @returns {Object[]} Array of resolved file objects
 */
function resolveDatasourceFiles(schemaBasePath, datasourceFiles) {
  if (!datasourceFiles || !Array.isArray(datasourceFiles)) {
    return [];
  }

  return datasourceFiles.map(fileName => resolveSingleExternalFile(schemaBasePath, fileName, 'datasource'));
}

/**
 * Loads and validates application config
 * @async
 * @function loadAndValidateVariables
 * @param {string} appPath - Application path
 * @returns {Promise<Object>} Variables object
 * @throws {Error} If file not found or invalid
 */
async function loadAndValidateVariables(appPath) {
  const configPath = resolveApplicationConfigPath(appPath);
  try {
    return loadConfigFile(configPath);
  } catch (error) {
    throw new Error(`Application config: ${error.message}`);
  }
}

async function resolveExternalFiles(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const { appPath } = await detectAppType(appName, options);
  const variables = await loadAndValidateVariables(appPath);

  if (!variables.externalIntegration) {
    return [];
  }

  const schemaBasePath = await resolveSchemaBasePath(appName, options);
  const systemFiles = resolveSystemFiles(schemaBasePath, variables.externalIntegration.systems);
  const datasourceFiles = resolveDatasourceFiles(schemaBasePath, variables.externalIntegration.dataSources);

  return [...systemFiles, ...datasourceFiles];
}

module.exports = {
  resolveSchemaBasePath,
  resolveExternalFiles
};

