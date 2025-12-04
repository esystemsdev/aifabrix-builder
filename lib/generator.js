/**
 * AI Fabrix Builder Deployment JSON Generator
 *
 * This module generates deployment JSON manifests for Miso Controller.
 * Combines variables.yaml, env.template, and rbac.yaml into deployment configuration.
 *
 * @fileoverview Deployment JSON generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const _secrets = require('./secrets');
const _keyGenerator = require('./key-generator');
const _validator = require('./validator');
const builders = require('./generator-builders');
const { detectAppType, getDeployJsonPath } = require('./utils/paths');

/**
 * Loads variables.yaml file
 * @param {string} variablesPath - Path to variables.yaml
 * @returns {Object} Parsed variables
 * @throws {Error} If file not found or invalid YAML
 */
function loadVariables(variablesPath) {
  if (!fs.existsSync(variablesPath)) {
    throw new Error(`variables.yaml not found: ${variablesPath}`);
  }

  const variablesContent = fs.readFileSync(variablesPath, 'utf8');
  try {
    return { content: variablesContent, parsed: yaml.load(variablesContent) };
  } catch (error) {
    throw new Error(`Invalid YAML syntax in variables.yaml: ${error.message}`);
  }
}

/**
 * Loads env.template file
 * @param {string} templatePath - Path to env.template
 * @returns {string} Template content
 * @throws {Error} If file not found
 */
function loadEnvTemplate(templatePath) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`env.template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Loads rbac.yaml file if it exists
 * @param {string} rbacPath - Path to rbac.yaml
 * @returns {Object|null} Parsed RBAC configuration or null
 * @throws {Error} If file exists but has invalid YAML
 */
function loadRbac(rbacPath) {
  if (!fs.existsSync(rbacPath)) {
    return null;
  }

  const rbacContent = fs.readFileSync(rbacPath, 'utf8');
  try {
    return yaml.load(rbacContent);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in rbac.yaml: ${error.message}`);
  }
}

/**
 * Generates external system <app-name>-deploy.json by loading the system JSON file
 * For external systems, the system JSON file is already created and we just need to reference it
 * @async
 * @function generateExternalSystemDeployJson
 * @param {string} appName - Name of the application
 * @param {string} appPath - Path to application directory (integration or builder)
 * @returns {Promise<string>} Path to generated <app-name>-deploy.json file
 * @throws {Error} If generation fails
 */
async function generateExternalSystemDeployJson(appName, appPath) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const variablesPath = path.join(appPath, 'variables.yaml');
  const { parsed: variables } = loadVariables(variablesPath);

  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in variables.yaml');
  }

  // For external systems, the system JSON file should be in the same folder
  // Check if it already exists (should be <app-name>-deploy.json)
  const deployJsonPath = getDeployJsonPath(appName, 'external', true);
  const systemFileName = variables.externalIntegration.systems && variables.externalIntegration.systems.length > 0
    ? variables.externalIntegration.systems[0]
    : `${appName}-deploy.json`;

  // Resolve system file path (schemaBasePath is usually './' for same folder)
  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const systemFilePath = path.isAbsolute(schemaBasePath)
    ? path.join(schemaBasePath, systemFileName)
    : path.join(appPath, schemaBasePath, systemFileName);

  // If system file doesn't exist, throw error (it should be created manually or via external-system-generator)
  if (!fs.existsSync(systemFilePath)) {
    throw new Error(`External system file not found: ${systemFilePath}. Please create it first.`);
  }

  // Read the system JSON file
  const systemContent = await fs.promises.readFile(systemFilePath, 'utf8');
  const systemJson = JSON.parse(systemContent);

  // Write it as <app-name>-deploy.json (consistent naming)
  const jsonContent = JSON.stringify(systemJson, null, 2);
  await fs.promises.writeFile(deployJsonPath, jsonContent, { mode: 0o644, encoding: 'utf8' });

  return deployJsonPath;
}

/**
 * Generates deployment JSON from application configuration files
 * Creates <app-name>-deploy.json for all apps (consistent naming)
 * For external systems, loads the system JSON file
 * For regular apps, generates deployment manifest from variables.yaml, env.template, rbac.yaml
 *
 * @async
 * @function generateDeployJson
 * @param {string} appName - Name of the application
 * @returns {Promise<string>} Path to generated deployment JSON file
 * @throws {Error} If generation fails or configuration is invalid
 *
 * @example
 * const jsonPath = await generateDeployJson('myapp');
 * // Returns: './builder/myapp/myapp-deploy.json' or './integration/hubspot/hubspot-deploy.json'
 */
async function generateDeployJson(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Detect app type and get correct path (integration or builder)
  const { isExternal, appPath, appType } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  // Check if app type is external
  if (isExternal) {
    return await generateExternalSystemDeployJson(appName, appPath);
  }

  // Regular app: generate deployment manifest
  const templatePath = path.join(appPath, 'env.template');
  const rbacPath = path.join(appPath, 'rbac.yaml');
  const jsonPath = getDeployJsonPath(appName, appType, true); // Use new naming

  // Load configuration files
  const { parsed: variables } = loadVariables(variablesPath);
  const envTemplate = loadEnvTemplate(templatePath);
  const rbac = loadRbac(rbacPath);

  // Parse environment variables from template
  const configuration = parseEnvironmentVariables(envTemplate);

  // Build deployment manifest WITHOUT deploymentKey initially
  const deployment = builders.buildManifestStructure(appName, variables, null, configuration, rbac);

  // Generate deploymentKey from the manifest object (excluding deploymentKey field)
  const deploymentKey = _keyGenerator.generateDeploymentKeyFromJson(deployment);

  // Add deploymentKey to manifest
  deployment.deploymentKey = deploymentKey;

  // Validate deployment JSON against schema
  const validation = _validator.validateDeploymentJson(deployment);
  if (!validation.valid) {
    const errorMessages = validation.errors.join('\n');
    throw new Error(`Generated deployment JSON does not match schema:\n${errorMessages}`);
  }

  // Write deployment JSON
  const jsonContent = JSON.stringify(deployment, null, 2);
  fs.writeFileSync(jsonPath, jsonContent, { mode: 0o644 });

  return jsonPath;
}

function parseEnvironmentVariables(envTemplate) {
  const configuration = [];
  const lines = envTemplate.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE format
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();

    if (!key || !value) {
      continue;
    }

    // Determine location and required status
    let location = 'variable';
    let required = false;

    if (value.startsWith('kv://')) {
      location = 'keyvault';
      required = true;
    }

    // Check if it's a sensitive variable
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'auth'];
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      required = true;
    }

    configuration.push({
      name: key,
      value: value.replace('kv://', ''), // Remove kv:// prefix for KeyVault
      location,
      required
    });
  }

  return configuration;
}

async function generateDeployJsonWithValidation(appName) {
  const jsonPath = await generateDeployJson(appName);
  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const deployment = JSON.parse(jsonContent);

  // Detect if this is an external system
  const { isExternal } = await detectAppType(appName);

  // For external systems, skip deployment JSON validation (they use external system JSON structure)
  if (isExternal) {
    return {
      success: true,
      path: jsonPath,
      validation: { valid: true, errors: [], warnings: [] },
      deployment
    };
  }

  const validation = _validator.validateDeploymentJson(deployment);
  return {
    success: validation.valid,
    path: jsonPath,
    validation,
    deployment
  };
}

module.exports = {
  generateDeployJson,
  generateDeployJsonWithValidation,
  parseEnvironmentVariables,
  buildImageReference: builders.buildImageReference,
  buildHealthCheck: builders.buildHealthCheck,
  buildRequirements: builders.buildRequirements,
  buildAuthentication: builders.buildAuthentication,
  buildAuthenticationConfig: builders.buildAuthenticationConfig
};
