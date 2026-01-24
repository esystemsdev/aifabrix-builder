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
const _keyGenerator = require('../core/key-generator');
const _validator = require('../validation/validator');
const builders = require('./builders');
const { detectAppType, getDeployJsonPath } = require('../utils/paths');
const splitFunctions = require('./split');
const { loadVariables, loadEnvTemplate, loadRbac, parseEnvironmentVariables } = require('./helpers');
const { generateExternalSystemApplicationSchema, splitExternalApplicationSchema } = require('./external');
const { generateControllerManifest } = require('./external-controller-manifest');

/**
 * Generates deployment JSON from application configuration files
 * Creates <app-name>-deploy.json for regular apps (consistent naming)
 * For external systems, generates application-schema.json
 * For regular apps, generates deployment manifest from variables.yaml, env.template, rbac.yaml
 *
 * @async
 * @function generateDeployJson
 * @param {string} appName - Name of the application
 * @param {Object} [options] - Generation options
 * @param {string} [options.type] - Forced application type (external)
 * @returns {Promise<string>} Path to generated deployment JSON file
 * @throws {Error} If generation fails or configuration is invalid
 *
 * @example
 * const jsonPath = await generateDeployJson('myapp');
 * // Returns: './builder/myapp/myapp-deploy.json' or './integration/hubspot/application-schema.json'
 */
/**
 * Loads configuration files for deployment generation
 * @function loadDeploymentConfigFiles
 * @param {string} appPath - Application path
 * @param {string} appType - Application type
 * @returns {Object} Loaded configuration files
 */
function loadDeploymentConfigFiles(appPath, appType, appName) {
  const variablesPath = path.join(appPath, 'variables.yaml');
  const templatePath = path.join(appPath, 'env.template');
  const rbacPath = path.join(appPath, 'rbac.yaml');
  const jsonPath = getDeployJsonPath(appName, appType, true); // Use new naming

  const { parsed: variables } = loadVariables(variablesPath);
  const envTemplate = loadEnvTemplate(templatePath);
  const rbac = loadRbac(rbacPath);

  return { variables, envTemplate, rbac, jsonPath };
}

/**
 * Builds and validates deployment manifest
 * @function buildAndValidateDeployment
 * @param {string} appName - Application name
 * @param {Object} variables - Variables configuration
 * @param {Object} envTemplate - Environment template
 * @param {Object} rbac - RBAC configuration
 * @returns {Object} Deployment manifest with deploymentKey
 * @throws {Error} If validation fails
 */
function buildAndValidateDeployment(appName, variables, envTemplate, rbac) {
  // Parse environment variables from template and merge portalInput from variables.yaml
  const configuration = parseEnvironmentVariables(envTemplate, variables);

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

  return deployment;
}

async function generateDeployJson(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Detect app type and get correct path (integration or builder)
  const { isExternal, appPath, appType } = await detectAppType(appName, options);

  // Check if app type is external
  if (isExternal) {
    // Generate controller-compatible manifest format
    const manifest = await generateControllerManifest(appName);

    // Determine system key for file naming
    const systemKey = manifest.key || appName;
    const deployJsonPath = path.join(appPath, `${systemKey}-deploy.json`);

    await fs.promises.writeFile(deployJsonPath, JSON.stringify(manifest, null, 2), { mode: 0o644, encoding: 'utf8' });
    return deployJsonPath;
  }

  // Regular app: generate deployment manifest
  const { variables, envTemplate, rbac, jsonPath } = loadDeploymentConfigFiles(appPath, appType, appName);
  const deployment = buildAndValidateDeployment(appName, variables, envTemplate, rbac);

  // Write deployment JSON
  const jsonContent = JSON.stringify(deployment, null, 2);
  fs.writeFileSync(jsonPath, jsonContent, { mode: 0o644 });

  return jsonPath;
}

async function generateDeployJsonWithValidation(appName, options = {}) {
  const jsonPath = await generateDeployJson(appName, options);
  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const deployment = JSON.parse(jsonContent);

  // Detect if this is an external system
  const { isExternal } = await detectAppType(appName, options);

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
  generateExternalSystemApplicationSchema,
  splitExternalApplicationSchema,
  parseEnvironmentVariables,
  splitDeployJson: splitFunctions.splitDeployJson,
  extractEnvTemplate: splitFunctions.extractEnvTemplate,
  extractVariablesYaml: splitFunctions.extractVariablesYaml,
  extractRbacYaml: splitFunctions.extractRbacYaml,
  parseImageReference: splitFunctions.parseImageReference,
  generateReadmeFromDeployJson: splitFunctions.generateReadmeFromDeployJson,
  buildImageReference: builders.buildImageReference,
  buildHealthCheck: builders.buildHealthCheck,
  buildRequirements: builders.buildRequirements,
  buildAuthentication: builders.buildAuthentication,
  buildAuthenticationConfig: builders.buildAuthenticationConfig
};
