/**
 * AI Fabrix Builder Deployment JSON Split Functions
 *
 * Helper functions for splitting deployment JSON files into component files
 *
 * @fileoverview Split functions for deployment JSON reverse conversion
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { parseImageReference } = require('./parse-image');
const { generateReadmeFromDeployJson } = require('./split-readme');
const { extractVariablesYaml, getExternalDatasourceFileName } = require('./split-variables');

/**
 * Converts configuration array back to env.template format
 * @function extractEnvTemplate
 * @param {Array} configuration - Configuration array from deployment JSON
 * @returns {string} env.template content
 */
function extractEnvTemplate(configuration) {
  if (!Array.isArray(configuration) || configuration.length === 0) {
    return '';
  }

  const lines = [];

  // Generate env.template lines
  for (const config of configuration) {
    if (!config.name || !config.value) {
      continue;
    }

    let value = config.value;
    // Add kv:// prefix if location is keyvault
    if (config.location === 'keyvault') {
      value = `kv://${value}`;
    }

    lines.push(`${config.name}=${value}`);
  }

  return lines.join('\n');
}

/**
 * Extracts roles and permissions from deployment JSON
 * @function extractRbacYaml
 * @param {Object} deployment - Deployment JSON object
 * @returns {Object|null} RBAC YAML structure or null if no roles/permissions
 */
function extractRbacYaml(deployment) {
  if (!deployment || typeof deployment !== 'object') {
    return null;
  }

  const hasRoles = deployment.roles && Array.isArray(deployment.roles) && deployment.roles.length > 0;
  const hasPermissions = deployment.permissions && Array.isArray(deployment.permissions) && deployment.permissions.length > 0;

  if (!hasRoles && !hasPermissions) {
    return null;
  }

  const rbac = {};
  if (hasRoles) {
    rbac.roles = deployment.roles;
  }
  if (hasPermissions) {
    rbac.permissions = deployment.permissions;
  }

  return rbac;
}

/**
 * Validates deployment JSON path
 * @function validateDeployJsonPath
 * @param {string} deployJsonPath - Deployment JSON path
 * @throws {Error} If path is invalid
 */
function validateDeployJsonPath(deployJsonPath) {
  if (!deployJsonPath || typeof deployJsonPath !== 'string') {
    throw new Error('Deployment JSON path is required and must be a string');
  }
  const fsSync = require('fs');
  if (!fsSync.existsSync(deployJsonPath)) {
    throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
  }
}

/**
 * Prepares output directory
 * @async
 * @function prepareOutputDirectory
 * @param {string} deployJsonPath - Deployment JSON path
 * @param {string|null} outputDir - Optional output directory
 * @returns {Promise<string>} Final output directory path
 */
async function prepareOutputDirectory(deployJsonPath, outputDir) {
  const finalOutputDir = outputDir || path.dirname(deployJsonPath);
  const fsSync = require('fs');
  if (!fsSync.existsSync(finalOutputDir)) {
    await fs.mkdir(finalOutputDir, { recursive: true });
  }
  return finalOutputDir;
}

/**
 * Loads and parses deployment JSON
 * @async
 * @function loadDeploymentJson
 * @param {string} deployJsonPath - Deployment JSON path
 * @returns {Promise<Object>} Parsed deployment object
 */
async function loadDeploymentJson(deployJsonPath) {
  try {
    const jsonContent = await fs.readFile(deployJsonPath, 'utf8');
    return JSON.parse(jsonContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
    }
    throw new Error(`Invalid JSON syntax in deployment file: ${error.message}`);
  }
}

/**
 * Writes a component file
 * @async
 * @function writeComponentFile
 * @param {string} filePath - File path
 * @param {string} content - File content
 * @returns {Promise<void>}
 */
async function writeComponentFile(filePath, content) {
  await fs.writeFile(filePath, content, { mode: 0o644, encoding: 'utf8' });
}

/**
 * Builds key -> line map from configuration array (for env.template merge).
 * @param {Array} configuration - Configuration array from deployment
 * @returns {Map<string, string>} Key to full line map
 */
function buildEnvTemplateExpectedByKey(configuration) {
  const expectedByKey = new Map();
  if (!Array.isArray(configuration)) return expectedByKey;
  const lines = extractEnvTemplate(configuration).split('\n').filter(Boolean);
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const key = line.substring(0, eq).trim();
      expectedByKey.set(key, `${key}=${line.substring(eq + 1)}`);
    }
  }
  return expectedByKey;
}

/**
 * Merges existing env.template with new lines from configuration; preserves comments and unknown keys.
 * @param {string} existingContent - Current env.template content
 * @param {Map<string, string>} expectedByKey - New key -> line from download
 * @returns {string} Merged content
 */
function mergeEnvTemplateWithExisting(existingContent, expectedByKey) {
  const lines = existingContent.split(/\r?\n/);
  const updatedLines = [];
  const keysWritten = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      updatedLines.push(line);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      updatedLines.push(line);
      continue;
    }
    const key = line.substring(0, eq).trim();
    if (expectedByKey.has(key)) {
      updatedLines.push(expectedByKey.get(key));
      keysWritten.add(key);
    } else {
      updatedLines.push(line);
    }
  }
  for (const key of expectedByKey.keys()) {
    if (!keysWritten.has(key)) updatedLines.push(expectedByKey.get(key));
  }
  return updatedLines.join('\n') + (updatedLines.length > 0 ? '\n' : '');
}

/**
 * Writes all component files
 * @async
 * @function writeComponentFiles
 * @param {string} outputDir - Output directory
 * @param {string} envTemplate - Environment template content
 * @param {Object} variables - Variables object
 * @param {Object|null} rbac - RBAC object or null
 * @param {string} readme - README content
 * @param {Object} [options] - Options
 * @param {boolean} [options.mergeEnvTemplate] - If true and env.template exists, merge instead of overwrite
 * @param {Array} [options.configuration] - Configuration array for merge (required when mergeEnvTemplate)
 * @param {boolean} [options.overwriteReadme] - If false and README.md exists, skip writing README
 * @returns {Promise<Object>} Results object with file paths
 */
async function writeComponentFiles(outputDir, envTemplate, variables, rbac, readme, options = {}) {
  const results = {};
  const envTemplatePath = path.join(outputDir, 'env.template');
  const fsSync = require('fs');

  if (options.mergeEnvTemplate && options.configuration && fsSync.existsSync(envTemplatePath)) {
    const expectedByKey = buildEnvTemplateExpectedByKey(options.configuration);
    const existingContent = await fs.readFile(envTemplatePath, 'utf8');
    const merged = mergeEnvTemplateWithExisting(existingContent, expectedByKey);
    await writeComponentFile(envTemplatePath, merged);
  } else {
    await writeComponentFile(envTemplatePath, envTemplate);
  }
  results.envTemplate = envTemplatePath;

  // Write application.yaml
  const variablesPath = path.join(outputDir, 'application.yaml');
  const variablesYaml = yaml.dump(variables, { indent: 2, lineWidth: -1 });
  await writeComponentFile(variablesPath, variablesYaml);
  results.variables = variablesPath;

  // Write rbac.yaml (only if roles/permissions exist)
  if (rbac) {
    const rbacPath = path.join(outputDir, 'rbac.yaml');
    const rbacYaml = yaml.dump(rbac, { indent: 2, lineWidth: -1 });
    await writeComponentFile(rbacPath, rbacYaml);
    results.rbac = rbacPath;
  }

  // Write README.md (skip if overwriteReadme is false and file exists)
  const readmePath = path.join(outputDir, 'README.md');
  if (options.overwriteReadme === false && fsSync.existsSync(readmePath)) {
    results.readmeSkipped = readmePath;
  } else {
    await writeComponentFile(readmePath, readme);
    results.readme = readmePath;
  }

  return results;
}

/**
 * Writes external system and datasource YAML files when deployment has system (external format).
 * @async
 * @param {string} outputDir - Output directory
 * @param {Object} deployment - Deployment with system and dataSources
 * @returns {Promise<{ systemFile?: string, datasourceFiles?: string[] }>} Paths to written files
 */
async function writeExternalSystemAndDatasourceFiles(outputDir, deployment) {
  if (!deployment || !deployment.system) {
    return {};
  }
  const system = deployment.system;
  const systemKey = system.key || 'external-system';
  const dataSourcesList = deployment.dataSources || deployment.datasources || [];
  const results = {};

  // Roles and permissions live in rbac.yaml only; omit from system file
  const { roles, permissions, ...systemWithoutRbac } = system;
  const systemPath = path.join(outputDir, `${systemKey}-system.yaml`);
  const systemYaml = yaml.dump(systemWithoutRbac, { indent: 2, lineWidth: -1 });
  await writeComponentFile(systemPath, systemYaml);
  results.systemFile = systemPath;

  const datasourcePaths = [];
  for (let i = 0; i < dataSourcesList.length; i++) {
    const ds = dataSourcesList[i];
    const fileName = getExternalDatasourceFileName(systemKey, ds, i);
    const dsPath = path.join(outputDir, fileName);
    const dsYaml = yaml.dump(ds, { indent: 2, lineWidth: -1 });
    await writeComponentFile(dsPath, dsYaml);
    datasourcePaths.push(dsPath);
  }
  results.datasourceFiles = datasourcePaths;

  return results;
}

/**
 * Normalizes deployment for split: for external format (deployment.system),
 * lifts configuration and roles/permissions to top level so extractors work.
 * @param {Object} deployment - Raw deployment object
 * @returns {Object} Deployment (mutated) with configuration/roles/permissions at top level when from system
 */
function normalizeDeploymentForSplit(deployment) {
  if (!deployment || !deployment.system) {
    return deployment;
  }
  const system = deployment.system;
  if (system.configuration && !deployment.configuration) {
    deployment.configuration = system.configuration;
  }
  if (system.roles && !deployment.roles) {
    deployment.roles = system.roles;
  }
  if (system.permissions && !deployment.permissions) {
    deployment.permissions = system.permissions;
  }
  return deployment;
}

/**
 * Splits a deployment JSON file into component files.
 * @async
 * @function splitDeployJson
 * @param {string} deployJsonPath - Path to deployment JSON file
 * @param {string} [outputDir] - Directory to write component files (defaults to same directory as JSON)
 * @returns {Promise<Object>} Object with paths to generated files
 * @throws {Error} If JSON file not found or invalid
 */
/**
 * @param {string} deployJsonPath - Path to deployment JSON file
 * @param {string} [outputDir] - Directory to write component files
 * @param {Object} [splitOptions] - Options for split behavior
 * @param {boolean} [splitOptions.mergeEnvTemplate] - If true and env.template exists, merge download config into it
 * @param {boolean} [splitOptions.overwriteReadme] - If false and README.md exists, do not overwrite
 */
async function splitDeployJson(deployJsonPath, outputDir = null, splitOptions = {}) {
  validateDeployJsonPath(deployJsonPath);
  const finalOutputDir = await prepareOutputDirectory(deployJsonPath, outputDir);
  const deployment = await loadDeploymentJson(deployJsonPath);
  normalizeDeploymentForSplit(deployment);

  const configArray = deployment.configuration || [];
  const envTemplate = extractEnvTemplate(configArray);
  const variables = extractVariablesYaml(deployment);
  const rbac = extractRbacYaml(deployment);
  const readme = generateReadmeFromDeployJson(deployment);

  const writeOptions = {};
  if (splitOptions.mergeEnvTemplate) {
    writeOptions.mergeEnvTemplate = true;
    writeOptions.configuration = configArray;
  }
  if (splitOptions.overwriteReadme === false) {
    writeOptions.overwriteReadme = false;
  }
  const result = await writeComponentFiles(finalOutputDir, envTemplate, variables, rbac, readme, writeOptions);

  if (deployment.system && typeof deployment.system === 'object') {
    const externalFiles = await writeExternalSystemAndDatasourceFiles(finalOutputDir, deployment);
    if (externalFiles.systemFile) result.systemFile = externalFiles.systemFile;
    if (externalFiles.datasourceFiles && externalFiles.datasourceFiles.length > 0) {
      result.datasourceFiles = externalFiles.datasourceFiles;
    }
  }

  return result;
}

module.exports = {
  splitDeployJson,
  extractEnvTemplate,
  extractVariablesYaml,
  extractRbacYaml,
  parseImageReference,
  generateReadmeFromDeployJson
};

