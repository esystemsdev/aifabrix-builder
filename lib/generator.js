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
 * Filters configuration based on registry mode
 * When registryMode is "external", only DOCKER_REGISTRY_SERVER_* variables are allowed
 * @function filterConfigurationByRegistryMode
 * @param {Array} configuration - Environment configuration
 * @param {string} registryMode - Registry mode ('external' or 'internal')
 * @returns {Array} Filtered configuration
 */
function filterConfigurationByRegistryMode(configuration, registryMode) {
  if (registryMode !== 'external') {
    return configuration;
  }

  const allowedDockerRegistryVars = [
    'DOCKER_REGISTRY_SERVER_URL',
    'DOCKER_REGISTRY_SERVER_USERNAME',
    'DOCKER_REGISTRY_SERVER_PASSWORD'
  ];
  return configuration.filter(config => allowedDockerRegistryVars.includes(config.name));
}

/**
 * Builds base deployment structure
 * @function buildBaseDeployment
 * @param {string} appName - Application name
 * @param {Object} variables - Variables configuration
 * @param {Array} filteredConfiguration - Filtered environment configuration
 * @returns {Object} Base deployment structure
 */
function buildBaseDeployment(appName, variables, filteredConfiguration) {
  const requires = variables.requires || {};
  return {
    key: variables.app?.key || appName,
    displayName: variables.app?.displayName || appName,
    description: variables.app?.description || '',
    type: variables.app?.type || 'webapp',
    image: buildImageReference(variables),
    registryMode: variables.image?.registryMode || 'external',
    port: variables.port || 3000,
    requiresDatabase: requires.database || false,
    requiresRedis: requires.redis || false,
    requiresStorage: requires.storage || false,
    databases: requires.databases || (requires.database ? [{ name: variables.app?.key || 'app' }] : []),
    configuration: filteredConfiguration
  };
}

/**
 * Builds authentication configuration from variables or RBAC
 * @function buildAuthenticationConfig
 * @param {Object} variables - Variables configuration
 * @param {Object|null} rbac - RBAC configuration
 * @returns {Object} Authentication configuration
 */
function buildAuthenticationConfig(variables, rbac) {
  if (variables.authentication) {
    const auth = {
      enableSSO: variables.authentication.enableSSO !== undefined ? variables.authentication.enableSSO : true
    };

    // When enableSSO is false, default type to 'none' and requiredRoles to []
    // When enableSSO is true, require type and requiredRoles
    if (auth.enableSSO === false) {
      auth.type = variables.authentication.type || 'none';
      auth.requiredRoles = variables.authentication.requiredRoles || [];
    } else {
      auth.type = variables.authentication.type || 'azure';
      auth.requiredRoles = variables.authentication.requiredRoles || [];
    }

    if (variables.authentication.endpoints) {
      auth.endpoints = variables.authentication.endpoints;
    }
    return auth;
  }
  return buildAuthentication(rbac);
}

/**
 * Validates and transforms repository configuration
 * @function validateRepositoryConfig
 * @param {Object} repository - Repository configuration
 * @returns {Object|null} Validated repository config or null
 */
function validateRepositoryConfig(repository) {
  if (!repository || (!repository.enabled && !repository.repositoryUrl)) {
    return null;
  }

  if (repository.repositoryUrl && repository.repositoryUrl.trim()) {
    return {
      enabled: repository.enabled || false,
      repositoryUrl: repository.repositoryUrl
    };
  }

  if (repository.enabled) {
    return { enabled: true };
  }

  return null;
}

/**
 * Validates and transforms build fields
 * @function validateBuildFields
 * @param {Object} build - Build configuration
 * @returns {Object|null} Validated build config or null
 */
function validateBuildFields(build) {
  if (!build) {
    return null;
  }

  const buildConfig = {};
  if (build.envOutputPath) {
    buildConfig.envOutputPath = build.envOutputPath;
  }
  if (build.dockerfile && build.dockerfile.trim()) {
    buildConfig.dockerfile = build.dockerfile;
  }

  return Object.keys(buildConfig).length > 0 ? buildConfig : null;
}

/**
 * Validates and transforms deployment fields
 * @function validateDeploymentFields
 * @param {Object} deployment - Deployment configuration
 * @returns {Object|null} Validated deployment config or null
 */
function validateDeploymentFields(deployment) {
  if (!deployment) {
    return null;
  }

  const deploymentConfig = {};
  if (deployment.controllerUrl && deployment.controllerUrl.trim() && deployment.controllerUrl.startsWith('https://')) {
    deploymentConfig.controllerUrl = deployment.controllerUrl;
  }

  return Object.keys(deploymentConfig).length > 0 ? deploymentConfig : null;
}

/**
 * Adds optional fields to deployment manifest
 * @function buildOptionalFields
 * @param {Object} deployment - Deployment manifest
 * @param {Object} variables - Variables configuration
 * @param {Object|null} rbac - RBAC configuration
 * @returns {Object} Deployment manifest with optional fields
 */
function buildOptionalFields(deployment, variables, rbac) {
  if (variables.healthCheck) {
    deployment.healthCheck = buildHealthCheck(variables);
  }

  deployment.authentication = buildAuthenticationConfig(variables, rbac);

  // Add roles and permissions (from variables.yaml or rbac.yaml)
  // Priority: variables.yaml > rbac.yaml
  if (variables.roles) {
    deployment.roles = variables.roles;
  } else if (rbac && rbac.roles) {
    deployment.roles = rbac.roles;
  }

  if (variables.permissions) {
    deployment.permissions = variables.permissions;
  } else if (rbac && rbac.permissions) {
    deployment.permissions = rbac.permissions;
  }

  const repository = validateRepositoryConfig(variables.repository);
  if (repository) {
    deployment.repository = repository;
  }

  const build = validateBuildFields(variables.build);
  if (build) {
    deployment.build = build;
  }

  const deploymentConfig = validateDeploymentFields(variables.deployment);
  if (deploymentConfig) {
    deployment.deployment = deploymentConfig;
  }

  if (variables.startupCommand) {
    deployment.startupCommand = variables.startupCommand;
  }
  if (variables.runtimeVersion) {
    deployment.runtimeVersion = variables.runtimeVersion;
  }
  if (variables.scaling) {
    deployment.scaling = variables.scaling;
  }
  if (variables.frontDoorRouting) {
    deployment.frontDoorRouting = variables.frontDoorRouting;
  }

  return deployment;
}

/**
 * Builds deployment manifest structure
 * @param {string} appName - Application name
 * @param {Object} variables - Variables configuration
 * @param {string} deploymentKey - Deployment key
 * @param {Array} configuration - Environment configuration
 * @param {Object|null} rbac - RBAC configuration
 * @returns {Object} Deployment manifest
 */
function buildManifestStructure(appName, variables, deploymentKey, configuration, rbac) {
  const registryMode = variables.image?.registryMode || 'external';
  const filteredConfiguration = filterConfigurationByRegistryMode(configuration, registryMode);
  const deployment = buildBaseDeployment(appName, variables, filteredConfiguration);
  return buildOptionalFields(deployment, variables, rbac);
}

/**
 * Generates deployment JSON from application configuration files
 * Creates aifabrix-deploy.json for Miso Controller deployment
 *
 * @async
 * @function generateDeployJson
 * @param {string} appName - Name of the application
 * @returns {Promise<string>} Path to generated deployment JSON file
 * @throws {Error} If generation fails or configuration is invalid
 *
 * @example
 * const jsonPath = await generateDeployJson('myapp');
 * // Returns: './builder/myapp/aifabrix-deploy.json'
 */
async function generateDeployJson(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const builderPath = path.join(process.cwd(), 'builder', appName);
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const templatePath = path.join(builderPath, 'env.template');
  const rbacPath = path.join(builderPath, 'rbac.yaml');
  const jsonPath = path.join(builderPath, 'aifabrix-deploy.json');

  // Load configuration files
  const { content: variablesContent, parsed: variables } = loadVariables(variablesPath);
  const envTemplate = loadEnvTemplate(templatePath);
  const rbac = loadRbac(rbacPath);

  // Generate deployment key
  const deploymentKey = _keyGenerator.generateDeploymentKeyFromContent(variablesContent);

  // Parse environment variables from template
  const configuration = parseEnvironmentVariables(envTemplate);

  // Build deployment manifest
  const deployment = buildManifestStructure(appName, variables, deploymentKey, configuration, rbac);

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

function buildImageReference(variables) {
  const imageName = variables.image?.name || variables.app?.key || 'app';
  const registry = variables.image?.registry;
  const tag = variables.image?.tag || 'latest';

  if (registry) {
    return `${registry}/${imageName}:${tag}`;
  }

  return `${imageName}:${tag}`;
}

function buildHealthCheck(variables) {
  const healthCheck = {
    path: variables.healthCheck?.path || '/health',
    interval: variables.healthCheck?.interval || 30
  };

  // Add optional probe fields if present
  if (variables.healthCheck?.probePath) {
    healthCheck.probePath = variables.healthCheck.probePath;
  }
  if (variables.healthCheck?.probeRequestType) {
    healthCheck.probeRequestType = variables.healthCheck.probeRequestType;
  }
  if (variables.healthCheck?.probeProtocol) {
    healthCheck.probeProtocol = variables.healthCheck.probeProtocol;
  }
  if (variables.healthCheck?.probeIntervalInSeconds) {
    healthCheck.probeIntervalInSeconds = variables.healthCheck.probeIntervalInSeconds;
  }

  return healthCheck;
}

function buildRequirements(variables) {
  const requires = variables.requires || {};

  return {
    database: requires.database || false,
    databases: requires.databases || (requires.database ? [{ name: variables.app?.key || 'app' }] : []),
    redis: requires.redis || false,
    storage: requires.storage || false,
    storageSize: requires.storageSize || '1Gi'
  };
}

function buildAuthentication(rbac) {
  if (!rbac) {
    return {
      type: 'none',
      enableSSO: false,
      requiredRoles: []
    };
  }

  return {
    type: 'azure', // Default to azure (enum: azure, local, none)
    enableSSO: true,
    requiredRoles: rbac.roles?.map(role => role.value) || []
  };
}

async function generateDeployJsonWithValidation(appName) {
  const jsonPath = await generateDeployJson(appName);
  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const deployment = JSON.parse(jsonContent);
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
  buildImageReference,
  buildHealthCheck,
  buildRequirements,
  buildAuthentication,
  buildAuthenticationConfig
};
