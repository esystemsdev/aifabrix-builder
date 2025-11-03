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
  const deployment = {
    key: variables.app?.key || appName,
    displayName: variables.app?.displayName || appName,
    description: variables.app?.description || '',
    type: variables.app?.type || 'webapp',
    image: buildImageReference(variables),
    port: variables.port || 3000,
    deploymentKey,
    configuration,
    healthCheck: buildHealthCheck(variables),
    requires: buildRequirements(variables),
    authentication: buildAuthentication(rbac)
  };

  // Add roles and permissions if RBAC is configured
  if (rbac) {
    deployment.roles = rbac.roles || [];
    deployment.permissions = rbac.permissions || [];
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
  return {
    path: variables.healthCheck?.path || '/health',
    interval: variables.healthCheck?.interval || 30,
    timeout: variables.healthCheck?.timeout || 10,
    retries: variables.healthCheck?.retries || 3
  };
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
      enabled: false,
      type: 'none'
    };
  }

  return {
    enabled: true,
    type: 'keycloak', // Default to Keycloak
    sso: true,
    requiredRoles: rbac.roles?.map(role => role.value) || [],
    permissions: rbac.permissions?.map(perm => perm.name) || []
  };
}

/**
 * Validates required fields in deployment manifest
 * @param {Object} deployment - Deployment configuration
 * @returns {Array<string>} Array of error messages
 */
function validateRequiredFields(deployment) {
  const errors = [];

  if (!deployment.key) {
    errors.push('Missing required field: key');
  }

  if (!deployment.displayName) {
    errors.push('Missing required field: displayName');
  }

  if (!deployment.image) {
    errors.push('Missing required field: image');
  }

  if (!deployment.port || deployment.port < 1 || deployment.port > 65535) {
    errors.push('Invalid port: must be between 1 and 65535');
  }

  if (!deployment.deploymentKey) {
    errors.push('Missing required field: deploymentKey');
  }

  if (deployment.deploymentKey && !_keyGenerator.validateDeploymentKey(deployment.deploymentKey)) {
    errors.push('Invalid deployment key format');
  }

  if (!deployment.configuration || !Array.isArray(deployment.configuration)) {
    errors.push('Missing or invalid configuration array');
  }

  return errors;
}

/**
 * Validates health check configuration
 * @param {Object} healthCheck - Health check configuration
 * @returns {Array<string>} Array of warning messages
 */
function validateHealthCheck(healthCheck) {
  const warnings = [];

  if (healthCheck?.path && !healthCheck.path.startsWith('/')) {
    warnings.push('Health check path should start with /');
  }

  if (healthCheck?.interval && (healthCheck.interval < 5 || healthCheck.interval > 300)) {
    warnings.push('Health check interval should be between 5 and 300 seconds');
  }

  return warnings;
}

/**
 * Validates authentication configuration
 * @param {Object} deployment - Deployment configuration
 * @returns {Array<string>} Array of warning messages
 */
function validateAuthentication(deployment) {
  const warnings = [];

  if (deployment.authentication?.enabled) {
    if (!deployment.roles || deployment.roles.length === 0) {
      warnings.push('Authentication enabled but no roles defined');
    }

    if (!deployment.permissions || deployment.permissions.length === 0) {
      warnings.push('Authentication enabled but no permissions defined');
    }
  }

  return warnings;
}

/**
 * Validates deployment JSON before writing
 * Ensures all required fields are present and valid
 *
 * @function validateDeploymentJson
 * @param {Object} deployment - Deployment configuration object
 * @returns {Object} Validation result
 */
function validateDeploymentJson(deployment) {
  const errors = validateRequiredFields(deployment);
  const warnings = [
    ...validateHealthCheck(deployment.healthCheck),
    ...validateAuthentication(deployment)
  ];

  return {
    valid: errors.length === 0,
    errors,
    warnings
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

  const validation = validateDeploymentJson(deployment);

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
  validateDeploymentJson
};
