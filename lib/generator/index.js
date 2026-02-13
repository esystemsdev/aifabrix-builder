/**
 * AI Fabrix Builder Deployment JSON Generator
 *
 * This module generates deployment JSON manifests for Miso Controller.
 * Combines application.yaml, env.template, and rbac.yaml into deployment configuration.
 *
 * @fileoverview Deployment JSON generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const _validator = require('../validation/validator');
const builders = require('./builders');
const { detectAppType, getDeployJsonPath, resolveApplicationConfigPath } = require('../utils/paths');
const { logOfflinePathWhenType } = require('../utils/cli-utils');
const splitFunctions = require('./split');
const { loadVariables, loadEnvTemplate, loadRbac, parseEnvironmentVariables } = require('./helpers');
const { generateExternalSystemApplicationSchema, splitExternalApplicationSchema } = require('./external');
const { generateControllerManifest } = require('./external-controller-manifest');
const { resolveVersionForApp } = require('../utils/image-version');

/**
 * Generates deployment JSON from application configuration files
 * Creates <app-name>-deploy.json for regular apps (consistent naming)
 * For external systems, generates application-schema.json
 * For regular apps, generates deployment manifest from application.yaml, env.template, rbac.yaml
 *
 * @async
 * @function generateDeployJson
 * @param {string} appName - Name of the application
 * @param {Object} [options] - Generation options
 *
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
  const variablesPath = resolveApplicationConfigPath(appPath);
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
 * @returns {Object} Deployment manifest
 * @throws {Error} If validation fails
 */
function buildAndValidateDeployment(appName, variables, envTemplate, rbac) {
  // Parse environment variables from template and merge portalInput from application config
  const configuration = parseEnvironmentVariables(envTemplate, variables);

  // Build deployment manifest (Controller computes deploymentKey from schema)
  const deployment = builders.buildManifestStructure(appName, variables, configuration, rbac);

  // Validate deployment JSON against schema
  const validation = _validator.validateDeploymentJson(deployment);
  if (!validation.valid) {
    const errorMessages = validation.errors.join('\n');
    throw new Error(`Generated deployment JSON does not match schema:\n${errorMessages}`);
  }

  return deployment;
}

/**
 * Builds deployment manifest in memory (no file write, no schema validation).
 * Same structure as generateDeployJson output; used by "aifabrix show" offline.
 * @async
 * @function buildDeploymentManifestInMemory
 * @param {string} appName - Application name
 * @param {Object} [options] - Options (e.g. type for external)
 * @returns {Promise<{ deployment: Object, appPath: string }>} Manifest and app path
 * @throws {Error} If application config/env.template missing or generation fails
 */
async function buildDeploymentManifestInMemory(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const { isExternal, appPath, appType } = await detectAppType(appName);

  if (isExternal) {
    const manifest = await generateControllerManifest(appName, options);
    return { deployment: manifest, appPath };
  }

  const { variables, envTemplate, rbac } = loadDeploymentConfigFiles(appPath, appType, appName);
  const resolved = await resolveVersionForApp(appName, variables, { updateBuilder: false });
  const variablesWithVersion = {
    ...variables,
    app: { ...variables.app, version: resolved.version }
  };
  const configuration = parseEnvironmentVariables(envTemplate, variables);
  const deployment = builders.buildManifestStructure(appName, variablesWithVersion, configuration, rbac);

  return { deployment, appPath };
}

async function generateDeployJson(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Detect app type and get correct path (integration first, then builder)
  const { isExternal, appPath, appType } = await detectAppType(appName);
  logOfflinePathWhenType(appPath);

  // Check if app type is external
  if (isExternal) {
    const manifest = await generateControllerManifest(appName, options);

    // Determine system key for file naming
    const systemKey = manifest.key || appName;
    const deployJsonPath = path.join(appPath, `${systemKey}-deploy.json`);

    await fs.promises.writeFile(deployJsonPath, JSON.stringify(manifest, null, 2), { mode: 0o644, encoding: 'utf8' });
    return deployJsonPath;
  }

  // Regular app: generate deployment manifest
  const { variables, envTemplate, rbac, jsonPath } = loadDeploymentConfigFiles(appPath, appType, appName);
  const resolved = await resolveVersionForApp(appName, variables, { updateBuilder: false });
  const variablesWithVersion = {
    ...variables,
    app: { ...variables.app, version: resolved.version }
  };
  const deployment = buildAndValidateDeployment(appName, variablesWithVersion, envTemplate, rbac);

  // Write deployment JSON
  const jsonContent = JSON.stringify(deployment, null, 2);
  fs.writeFileSync(jsonPath, jsonContent, { mode: 0o644 });

  return jsonPath;
}

async function generateDeployJsonWithValidation(appName, options = {}) {
  const jsonPath = await generateDeployJson(appName, options);
  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const deployment = JSON.parse(jsonContent);

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
  buildDeploymentManifestInMemory,
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
