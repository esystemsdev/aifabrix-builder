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
const yaml = require('js-yaml');
const { detectAppType } = require('./paths');

/**
 * Resolves schemaBasePath from application variables.yaml
 * Supports both absolute and relative paths
 *
 * @async
 * @function resolveSchemaBasePath
 * @param {string} appName - Application name
 * @returns {Promise<string>} Resolved absolute path to schema base directory
 * @throws {Error} If variables.yaml not found, externalIntegration missing, or path invalid
 *
 * @example
 * const basePath = await resolveSchemaBasePath('myapp');
 * // Returns: '/path/to/builder/myapp/schemas'
 */
async function resolveSchemaBasePath(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  if (!fs.existsSync(variablesPath)) {
    throw new Error(`variables.yaml not found: ${variablesPath}`);
  }

  const content = fs.readFileSync(variablesPath, 'utf8');
  let variables;

  try {
    variables = yaml.load(content);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in variables.yaml: ${error.message}`);
  }

  // Check if externalIntegration block exists
  if (!variables.externalIntegration) {
    throw new Error(`externalIntegration block not found in variables.yaml for app: ${appName}`);
  }

  if (!variables.externalIntegration.schemaBasePath) {
    throw new Error(`schemaBasePath not found in externalIntegration block for app: ${appName}`);
  }

  const schemaBasePath = variables.externalIntegration.schemaBasePath;
  const variablesDir = path.dirname(variablesPath);

  // Resolve path (absolute or relative to variables.yaml location)
  let resolvedPath;
  if (path.isAbsolute(schemaBasePath)) {
    resolvedPath = schemaBasePath;
  } else {
    resolvedPath = path.resolve(variablesDir, schemaBasePath);
  }

  // Normalize path
  resolvedPath = path.normalize(resolvedPath);

  // Validate path exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Schema base path does not exist: ${resolvedPath}`);
  }

  if (!fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`Schema base path is not a directory: ${resolvedPath}`);
  }

  return resolvedPath;
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
async function resolveExternalFiles(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  if (!fs.existsSync(variablesPath)) {
    throw new Error(`variables.yaml not found: ${variablesPath}`);
  }

  const content = fs.readFileSync(variablesPath, 'utf8');
  let variables;

  try {
    variables = yaml.load(content);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in variables.yaml: ${error.message}`);
  }

  // Check if externalIntegration block exists
  if (!variables.externalIntegration) {
    return []; // No external integration, return empty array
  }

  // Resolve schema base path
  const schemaBasePath = await resolveSchemaBasePath(appName);
  const resolvedFiles = [];

  // Resolve systems files
  if (variables.externalIntegration.systems && Array.isArray(variables.externalIntegration.systems)) {
    for (const systemFile of variables.externalIntegration.systems) {
      const systemPath = path.join(schemaBasePath, systemFile);
      const normalizedPath = path.normalize(systemPath);

      if (!fs.existsSync(normalizedPath)) {
        throw new Error(`External system file not found: ${normalizedPath}`);
      }

      resolvedFiles.push({
        path: normalizedPath,
        type: 'system',
        fileName: systemFile
      });
    }
  }

  // Resolve datasources files
  if (variables.externalIntegration.dataSources && Array.isArray(variables.externalIntegration.dataSources)) {
    for (const datasourceFile of variables.externalIntegration.dataSources) {
      const datasourcePath = path.join(schemaBasePath, datasourceFile);
      const normalizedPath = path.normalize(datasourcePath);

      if (!fs.existsSync(normalizedPath)) {
        throw new Error(`External datasource file not found: ${normalizedPath}`);
      }

      resolvedFiles.push({
        path: normalizedPath,
        type: 'datasource',
        fileName: datasourceFile
      });
    }
  }

  return resolvedFiles;
}

module.exports = {
  resolveSchemaBasePath,
  resolveExternalFiles
};

