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
const { getContainerPort } = require('../utils/port-resolver');
const { buildEnvVarMap } = require('../utils/env-map');

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

/** Placeholder replaced with application port from application.yaml */
const PORT_PLACEHOLDER = '${PORT}';

/**
 * Returns the numeric port to use when substituting ${PORT} in the manifest.
 * When application.yaml has port: "${PORT}", uses defaultPort (e.g. 3000).
 *
 * @param {Object} variables - Parsed application config
 * @param {number} [defaultPort=3000] - Default when port is "${PORT}" or invalid
 * @returns {number} Port number for substitution
 */
function getEffectivePortForSubstitution(variables, defaultPort = 3000) {
  const raw = getContainerPort(variables, defaultPort);
  if (raw === PORT_PLACEHOLDER || (typeof raw === 'string' && raw.trim() === PORT_PLACEHOLDER)) {
    return defaultPort;
  }
  if (typeof raw === 'number' && raw > 0) {
    return raw;
  }
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : defaultPort;
}

/**
 * Recursively replaces ${PORT} with the given port number in all string values of obj (in-place).
 *
 * @param {Object} obj - Deployment manifest or any nested object
 * @param {number} portNumber - Port to substitute (e.g. from application.yaml)
 */
function substitutePortInDeployment(obj, portNumber) {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string' && obj[i].includes(PORT_PLACEHOLDER)) {
        obj[i] = obj[i].split(PORT_PLACEHOLDER).join(String(portNumber));
      } else if (typeof obj[i] === 'object' && obj[i] !== null) {
        substitutePortInDeployment(obj[i], portNumber);
      }
    }
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string' && value.includes(PORT_PLACEHOLDER)) {
        obj[key] = value.split(PORT_PLACEHOLDER).join(String(portNumber));
      } else if (typeof value === 'object' && value !== null) {
        substitutePortInDeployment(value, portNumber);
      }
    }
  }
}

/** Regex to find ${VAR} placeholders for env substitution */
const ENV_VAR_PLACEHOLDER_REGEX = /\$\{([^}]+)\}/g;

/**
 * Recursively replaces ${VAR} with envVarMap[VAR] in all string values of obj (in-place).
 * Only substitutes when VAR is a key in envVarMap (from env-config.yaml / config).
 *
 * @param {Object} obj - Deployment manifest or any nested object
 * @param {Object} envVarMap - Flat map of variable names to values (e.g. from buildEnvVarMap('docker'))
 */
function substituteEnvVarsInDeployment(obj, envVarMap) {
  if (!envVarMap || typeof envVarMap !== 'object') return;
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string') {
        obj[i] = obj[i].replace(ENV_VAR_PLACEHOLDER_REGEX, (match, varName) =>
          Object.prototype.hasOwnProperty.call(envVarMap, varName) ? String(envVarMap[varName]) : match);
      } else if (typeof obj[i] === 'object' && obj[i] !== null) {
        substituteEnvVarsInDeployment(obj[i], envVarMap);
      }
    }
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        obj[key] = value.replace(ENV_VAR_PLACEHOLDER_REGEX, (match, varName) =>
          Object.prototype.hasOwnProperty.call(envVarMap, varName) ? String(envVarMap[varName]) : match);
      } else if (typeof value === 'object' && value !== null) {
        substituteEnvVarsInDeployment(value, envVarMap);
      }
    }
  }
}

/**
 * Builds and validates deployment manifest
 * @function buildAndValidateDeployment
 * @param {string} appName - Application name
 * @param {Object} variables - Variables configuration
 * @param {Object} envTemplate - Environment template
 * @param {Object} rbac - RBAC configuration
 * @param {Object} [options] - Optional options
 * @param {Object} [options.envVarMap] - Env vars from env-config (e.g. REDIS_HOST, DB_HOST) to resolve ${VAR} in manifest
 * @returns {Object} Deployment manifest
 * @throws {Error} If validation fails
 */
function buildAndValidateDeployment(appName, variables, envTemplate, rbac, options = null) {
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

  // Replace ${PORT} with port from application.yaml so manifest deploys correctly
  const effectivePort = getEffectivePortForSubstitution(variables, 3000);
  substitutePortInDeployment(deployment, effectivePort);
  if (deployment.port !== undefined) {
    deployment.port = typeof deployment.port === 'string' && /^\d+$/.test(deployment.port)
      ? parseInt(deployment.port, 10) : (typeof deployment.port === 'number' ? deployment.port : effectivePort);
  }

  // Resolve ${REDIS_HOST}, ${DB_HOST}, etc. from env-config.yaml so manifest has no unresolved vars
  const envVarMap = options && options.envVarMap;
  if (envVarMap) {
    substituteEnvVarsInDeployment(deployment, envVarMap);
  }

  // Ensure no other ${...} placeholders remain in manifest
  _validator.validateNoUnresolvedVariablesInDeployment(deployment);

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

  const effectivePort = getEffectivePortForSubstitution(variablesWithVersion, 3000);
  substitutePortInDeployment(deployment, effectivePort);
  if (deployment.port !== undefined) {
    deployment.port = typeof deployment.port === 'string' && /^\d+$/.test(deployment.port)
      ? parseInt(deployment.port, 10) : (typeof deployment.port === 'number' ? deployment.port : effectivePort);
  }
  const envVarMap = await buildEnvVarMap('docker', null, null, { appPort: effectivePort });
  substituteEnvVarsInDeployment(deployment, envVarMap);
  _validator.validateNoUnresolvedVariablesInDeployment(deployment);
  return { deployment, appPath };
}

/**
 * Writes external system deploy JSON (manifest + ${PORT} substitution + validation).
 * @async
 * @param {string} appName - Application name
 * @param {string} appPath - Application path
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Path to written deploy JSON
 */
async function writeExternalDeployJson(appName, appPath, options) {
  const manifest = await generateControllerManifest(appName, {
    ...options,
    skipMissingDatasourceFiles: true
  });
  let effectivePort = 3000;
  try {
    const variablesPath = resolveApplicationConfigPath(appPath);
    const { parsed: variables } = loadVariables(variablesPath);
    effectivePort = getEffectivePortForSubstitution(variables, 3000);
    substitutePortInDeployment(manifest, effectivePort);
  } catch {
    substitutePortInDeployment(manifest, 3000);
  }
  const envVarMap = await buildEnvVarMap('docker', null, null, { appPort: effectivePort });
  substituteEnvVarsInDeployment(manifest, envVarMap);
  _validator.validateNoUnresolvedVariablesInDeployment(manifest);
  const systemKey = manifest.key || appName;
  const deployJsonPath = path.join(appPath, `${systemKey}-deploy.json`);
  await fs.promises.writeFile(deployJsonPath, JSON.stringify(manifest, null, 2), { mode: 0o644, encoding: 'utf8' });
  return deployJsonPath;
}

/**
 * Writes regular app deploy JSON (build + validate + write).
 * @async
 * @param {string} appName - Application name
 * @param {string} appPath - Application path
 * @param {string} appType - Application type
 * @returns {Promise<string>} Path to written deploy JSON
 */
async function writeRegularDeployJson(appName, appPath, appType) {
  const { variables, envTemplate, rbac, jsonPath } = loadDeploymentConfigFiles(appPath, appType, appName);
  const resolved = await resolveVersionForApp(appName, variables, { updateBuilder: false });
  const variablesWithVersion = {
    ...variables,
    app: { ...variables.app, version: resolved.version }
  };
  const effectivePort = getEffectivePortForSubstitution(variablesWithVersion, 3000);
  const envVarMap = await buildEnvVarMap('docker', null, null, { appPort: effectivePort });
  const deployment = buildAndValidateDeployment(appName, variablesWithVersion, envTemplate, rbac, { envVarMap });
  const jsonContent = JSON.stringify(deployment, null, 2);
  fs.writeFileSync(jsonPath, jsonContent, { mode: 0o644 });
  return jsonPath;
}

async function generateDeployJson(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const { isExternal, appPath, appType } = await detectAppType(appName);
  logOfflinePathWhenType(appPath);
  if (isExternal) {
    return writeExternalDeployJson(appName, appPath, options);
  }
  return await writeRegularDeployJson(appName, appPath, appType);
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
  getEffectivePortForSubstitution,
  substitutePortInDeployment,
  substituteEnvVarsInDeployment,
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
