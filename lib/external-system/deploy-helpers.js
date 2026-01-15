/**
 * External System Deployment Helpers
 *
 * Helper functions for external system deployment validation
 *
 * @fileoverview Deployment helper utilities for external system deployment
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { detectAppType, getDeployJsonPath } = require('../utils/paths');

/**
 * Loads variables.yaml for an application
 * @async
 * @function loadVariablesYaml
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Variables configuration
 * @throws {Error} If file cannot be loaded
 */
async function loadVariablesYaml(appName) {
  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');
  const content = await fs.readFile(variablesPath, 'utf8');
  return yaml.load(content);
}

/**
 * Validates a single system file
 * @async
 * @function validateSingleSystemFile
 * @param {string} systemFile - System file name
 * @param {string} appName - Application name
 * @param {string} schemasPath - Schemas path
 * @returns {Promise<string>} Validated system file path
 * @throws {Error} If file not found
 */
async function validateSingleSystemFile(systemFile, appName, schemasPath) {
  // Try new naming first: <app-name>-deploy.json in same folder
  const newSystemPath = getDeployJsonPath(appName, 'external', true);
  if (fsSync.existsSync(newSystemPath)) {
    return newSystemPath;
  }

  // Fall back to specified path
  const systemPath = path.join(schemasPath, systemFile);
  try {
    await fs.access(systemPath);
    return systemPath;
  } catch {
    throw new Error(`External system file not found: ${systemPath} (also checked: ${newSystemPath})`);
  }
}

/**
 * Validates system files
 * @async
 * @function validateSystemFiles
 * @param {string[]} systemFiles - Array of system file names
 * @param {string} appName - Application name
 * @param {string} schemasPath - Schemas path
 * @returns {Promise<string[]>} Array of validated system file paths
 */
async function validateSystemFiles(systemFiles, appName, schemasPath) {
  const validatedFiles = [];
  for (const systemFile of systemFiles) {
    const validatedPath = await validateSingleSystemFile(systemFile, appName, schemasPath);
    validatedFiles.push(validatedPath);
  }
  return validatedFiles;
}

/**
 * Validates a single datasource file
 * @async
 * @function validateSingleDatasourceFile
 * @param {string} datasourceFile - Datasource file name
 * @param {string} appPath - Application path
 * @param {string} schemasPath - Schemas path
 * @returns {Promise<string>} Validated datasource file path
 * @throws {Error} If file not found
 */
async function validateSingleDatasourceFile(datasourceFile, appPath, schemasPath) {
  // Try same folder first (new structure)
  const datasourcePath = path.join(appPath, datasourceFile);
  try {
    await fs.access(datasourcePath);
    return datasourcePath;
  } catch {
    // Fall back to schemaBasePath
    const fallbackPath = path.join(schemasPath, datasourceFile);
    try {
      await fs.access(fallbackPath);
      return fallbackPath;
    } catch {
      throw new Error(`External datasource file not found: ${datasourcePath} or ${fallbackPath}`);
    }
  }
}

/**
 * Validates datasource files
 * @async
 * @function validateDatasourceFiles
 * @param {string[]} datasourceFiles - Array of datasource file names
 * @param {string} appPath - Application path
 * @param {string} schemasPath - Schemas path
 * @returns {Promise<string[]>} Array of validated datasource file paths
 */
async function validateDatasourceFiles(datasourceFiles, appPath, schemasPath) {
  const validatedFiles = [];
  for (const datasourceFile of datasourceFiles) {
    const validatedPath = await validateSingleDatasourceFile(datasourceFile, appPath, schemasPath);
    validatedFiles.push(validatedPath);
  }
  return validatedFiles;
}

/**
 * Extracts system key from system file path
 * @function extractSystemKey
 * @param {string} systemFilePath - System file path
 * @returns {string} System key
 */
function extractSystemKey(systemFilePath) {
  // Normalize path separators first (handles Windows backslashes)
  const normalizedPath = systemFilePath.replace(/\\/g, '/');
  const systemFileName = path.basename(normalizedPath, '.json');
  return systemFileName.replace(/-deploy$/, '');
}

module.exports = {
  loadVariablesYaml,
  validateSingleSystemFile,
  validateSystemFiles,
  validateSingleDatasourceFile,
  validateDatasourceFiles,
  extractSystemKey
};

