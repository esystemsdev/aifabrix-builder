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
 * Builds deployment manifest structure
 * @param {string} appName - Application name
 * @param {Object} variables - Variables configuration
 * @param {string} deploymentKey - Deployment key
 * @param {Array} configuration - Environment configuration
 * @param {Object|null} rbac - RBAC configuration
 * @returns {Object} Deployment manifest
 */
function buildManifestStructure(appName, variables, deploymentKey, configuration, rbac) {
  const requires = variables.requires || {};
  const registryMode = variables.image?.registryMode || 'external';

  // Filter configuration based on registryMode
  // When registryMode is "external", only DOCKER_REGISTRY_SERVER_* variables are allowed
  let filteredConfiguration = configuration;
  if (registryMode === 'external') {
    const allowedDockerRegistryVars = [
      'DOCKER_REGISTRY_SERVER_URL',
      'DOCKER_REGISTRY_SERVER_USERNAME',
      'DOCKER_REGISTRY_SERVER_PASSWORD'
    ];
    filteredConfiguration = configuration.filter(config => 
      allowedDockerRegistryVars.includes(config.name)
    );
  }

  // Transform nested requires structure to flat schema format
  const deployment = {
    key: variables.app?.key || appName,
    displayName: variables.app?.displayName || appName,
    description: variables.app?.description || '',
    type: variables.app?.type || 'webapp',
    image: buildImageReference(variables),
    registryMode: registryMode,
    port: variables.port || 3000,
    requiresDatabase: requires.database || false,
    requiresRedis: requires.redis || false,
    requiresStorage: requires.storage || false,
    databases: requires.databases || (requires.database ? [{ name: variables.app?.key || 'app' }] : []),
    configuration: filteredConfiguration
  };

  // Add healthCheck if present
  if (variables.healthCheck) {
    deployment.healthCheck = buildHealthCheck(variables);
  }

  // Add authentication from variables or RBAC
  if (variables.authentication) {
    // Ensure required fields are present from variables.yaml
    deployment.authentication = {
      type: variables.authentication.type || 'azure',
      enableSSO: variables.authentication.enableSSO !== undefined ? variables.authentication.enableSSO : true,
      requiredRoles: variables.authentication.requiredRoles || []
    };
    // Add optional endpoints if present
    if (variables.authentication.endpoints) {
      deployment.authentication.endpoints = variables.authentication.endpoints;
    }
  } else {
    deployment.authentication = buildAuthentication(rbac);
  }

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

  // Add optional fields from variables if present (only if valid)
  if (variables.repository && (variables.repository.enabled || variables.repository.repositoryUrl)) {
    // Only include repository if enabled or has a valid URL
    if (variables.repository.repositoryUrl && variables.repository.repositoryUrl.trim()) {
      deployment.repository = {
        enabled: variables.repository.enabled || false,
        repositoryUrl: variables.repository.repositoryUrl
      };
    } else if (variables.repository.enabled) {
      deployment.repository = {
        enabled: true
      };
    }
  }
  if (variables.build) {
    // Only include build fields that have valid values
    const buildConfig = {};
    if (variables.build.envOutputPath) {
      buildConfig.envOutputPath = variables.build.envOutputPath;
    }
    if (variables.build.secrets && typeof variables.build.secrets === 'string') {
      buildConfig.secrets = variables.build.secrets;
    }
    if (variables.build.dockerfile && variables.build.dockerfile.trim()) {
      buildConfig.dockerfile = variables.build.dockerfile;
    }
    if (Object.keys(buildConfig).length > 0) {
      deployment.build = buildConfig;
    }
  }
  if (variables.deployment) {
    // Only include deployment if it has valid values
    // Schema only allows: controllerUrl, clientId, clientSecret
    const deploymentConfig = {};
    if (variables.deployment.controllerUrl && variables.deployment.controllerUrl.trim() && variables.deployment.controllerUrl.startsWith('https://')) {
      deploymentConfig.controllerUrl = variables.deployment.controllerUrl;
    }
    if (variables.deployment.clientId && variables.deployment.clientId.trim()) {
      deploymentConfig.clientId = variables.deployment.clientId;
    }
    if (variables.deployment.clientSecret && variables.deployment.clientSecret.trim()) {
      deploymentConfig.clientSecret = variables.deployment.clientSecret;
    }
    // Only add deployment if it has at least one valid field
    if (Object.keys(deploymentConfig).length > 0) {
      deployment.deployment = deploymentConfig;
    }
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

/**
 * Parses environment variables from env.template
 * Converts kv:// references to KeyVault configuration
 *
 * @function parseEnvironmentVariables
 * @param {string} envTemplate - Environment template content
 * @returns {Array} Array of configuration objects
 */
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

/**
 * Builds image reference from variables configuration
 * Handles registry, name, and tag formatting
 *
 * @function buildImageReference
 * @param {Object} variables - Variables configuration
 * @returns {string} Complete image reference
 */
function buildImageReference(variables) {
  const imageName = variables.image?.name || variables.app?.key || 'app';
  const registry = variables.image?.registry;
  const tag = variables.image?.tag || 'latest';

  if (registry) {
    return `${registry}/${imageName}:${tag}`;
  }

  return `${imageName}:${tag}`;
}

/**
 * Builds health check configuration from variables
 * Provides default health check settings
 *
 * @function buildHealthCheck
 * @param {Object} variables - Variables configuration
 * @returns {Object} Health check configuration
 */
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

/**
 * Builds requirements configuration from variables
 * Maps database, Redis, and storage requirements
 *
 * @function buildRequirements
 * @param {Object} variables - Variables configuration
 * @returns {Object} Requirements configuration
 */
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

/**
 * Builds authentication configuration from RBAC
 * Configures authentication settings for the application
 *
 * @function buildAuthentication
 * @param {Object} rbac - RBAC configuration (optional)
 * @returns {Object} Authentication configuration
 */
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

/**
 * Generates deployment JSON with validation
 * Validates configuration before writing the file
 *
 * @async
 * @function generateDeployJsonWithValidation
 * @param {string} appName - Name of the application
 * @returns {Promise<Object>} Generation result with validation info
 * @throws {Error} If generation fails
 *
 * @example
 * const result = await generateDeployJsonWithValidation('myapp');
 * // Returns: { success: true, path: './builder/myapp/aifabrix-deploy.json', validation: {...} }
 */
async function generateDeployJsonWithValidation(appName) {
  const jsonPath = await generateDeployJson(appName);

  // Read back the generated file for validation
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
  buildAuthentication
};
