/**
 * Variable Transformation Utilities
 *
 * Transforms nested variables.yaml structure to flat schema format
 * Converts app.*, image.*, requires.* to schema-compatible structure
 *
 * @fileoverview Variable transformation utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Sanitizes authentication type - map keycloak to azure (schema allows: azure, local, none)
 * @function sanitizeAuthType
 * @param {string} authType - Authentication type
 * @returns {string} Sanitized authentication type
 */
function sanitizeAuthType(authType) {
  if (authType === 'keycloak') {
    return 'azure';
  }
  if (authType && !['azure', 'local', 'none'].includes(authType)) {
    return 'azure'; // Default to azure if invalid type
  }
  return authType;
}

/**
 * Transforms flat structure to schema-compatible format
 * @function transformFlatStructure
 * @param {Object} variables - Raw variables from YAML
 * @param {string} appName - Application name (fallback)
 * @returns {Object} Transformed variables matching schema
 */
function transformFlatStructure(variables, appName) {
  const result = {
    key: variables.key || appName,
    displayName: variables.displayName || appName,
    description: variables.description || '',
    type: variables.type || 'webapp',
    image: variables.image,
    registryMode: variables.registryMode || 'external',
    port: variables.port || 3000,
    requiresDatabase: variables.requiresDatabase || false,
    requiresRedis: variables.requiresRedis || false,
    requiresStorage: variables.requiresStorage || false,
    databases: variables.databases || [],
    ...variables
  };

  // Sanitize authentication if present
  if (result.authentication && result.authentication.type) {
    result.authentication = {
      ...result.authentication,
      type: sanitizeAuthType(result.authentication.type)
    };
  }
  // Handle partial authentication objects (when only enableSSO is provided)
  if (result.authentication && result.authentication.enableSSO !== undefined) {
    const auth = {
      ...result.authentication,
      enableSSO: result.authentication.enableSSO
    };
    // When enableSSO is false, default type to 'none' and requiredRoles to []
    // When enableSSO is true, default type to 'azure' if not provided
    if (auth.enableSSO === false) {
      auth.type = sanitizeAuthType(result.authentication.type || 'none');
      auth.requiredRoles = result.authentication.requiredRoles || [];
    } else {
      auth.type = sanitizeAuthType(result.authentication.type || 'azure');
      auth.requiredRoles = result.authentication.requiredRoles || [];
    }
    result.authentication = auth;
  }

  // Add placeholder deploymentKey for validation (will be generated from JSON later)
  // This is a 64-character hex string matching the SHA256 pattern
  if (!result.deploymentKey) {
    result.deploymentKey = '0000000000000000000000000000000000000000000000000000000000000000';
  }

  return result;
}

/**
 * Builds image reference string from variables
 * @function buildImageReference
 * @param {Object} variables - Variables configuration
 * @param {string} appName - Application name (fallback)
 * @returns {string} Image reference string
 */
function buildImageReference(variables, appName) {
  const imageName = variables.image?.name || variables.app?.key || appName;
  const registry = variables.image?.registry;
  const tag = variables.image?.tag || 'latest';
  return registry ? `${registry}/${imageName}:${tag}` : `${imageName}:${tag}`;
}

/**
 * Validates repository URL format
 * @function validateRepositoryUrl
 * @param {string} url - Repository URL
 * @returns {boolean} True if valid
 */
function validateRepositoryUrl(url) {
  if (!url || url.trim() === '') {
    return false;
  }
  const repoPattern = /^(https:\/\/github\.com\/[^/]+\/[^/]+|https:\/\/gitlab\.com\/[^/]+\/[^/]+|https:\/\/dev\.azure\.com\/[^/]+\/[^/]+\/[^/]+)$/;
  return repoPattern.test(url);
}

/**
 * Validates and transforms repository configuration
 * @function validateRepositoryConfig
 * @param {Object} repository - Repository configuration
 * @returns {Object|null} Validated repository config or null
 */
function validateRepositoryConfig(repository) {
  if (!repository) {
    return null;
  }

  const repo = { enabled: repository.enabled || false };
  if (validateRepositoryUrl(repository.repositoryUrl)) {
    repo.repositoryUrl = repository.repositoryUrl;
  }

  if (repo.enabled || repo.repositoryUrl) {
    return repo;
  }

  return null;
}

/**
 * Validates and transforms build configuration
 * @function validateBuildConfig
 * @param {Object} build - Build configuration
 * @returns {Object|null} Validated build config or null
 */
function validateBuildConfig(build) {
  if (!build) {
    return null;
  }

  const buildConfig = {};
  if (build.envOutputPath) {
    buildConfig.envOutputPath = build.envOutputPath;
  }
  if (build.localPort) {
    buildConfig.localPort = build.localPort;
  }
  if (build.language) {
    buildConfig.language = build.language;
  }
  if (build.context) {
    buildConfig.context = build.context;
  }
  if (build.dockerfile && build.dockerfile.trim() !== '') {
    buildConfig.dockerfile = build.dockerfile;
  }

  return Object.keys(buildConfig).length > 0 ? buildConfig : null;
}

/**
 * Validates and transforms deployment configuration
 * @function validateDeploymentConfig
 * @param {Object} deployment - Deployment configuration
 * @returns {Object|null} Validated deployment config or null
 */
function validateDeploymentConfig(deployment) {
  if (!deployment) {
    return null;
  }

  const deploymentConfig = {};
  if (deployment.controllerUrl && deployment.controllerUrl.trim() !== '' && /^https:\/\/.*$/.test(deployment.controllerUrl)) {
    deploymentConfig.controllerUrl = deployment.controllerUrl;
  }

  return Object.keys(deploymentConfig).length > 0 ? deploymentConfig : null;
}

/**
 * Transforms optional fields from variables
 * @function transformOptionalFields
 * @param {Object} variables - Raw variables from YAML
 * @param {Object} transformed - Base transformed object
 * @returns {Object} Transformed object with optional fields added
 */
function transformOptionalFields(variables, transformed) {
  if (variables.healthCheck) {
    transformed.healthCheck = variables.healthCheck;
  }

  if (variables.authentication) {
    // Ensure authentication object has enableSSO at minimum
    // Default type and requiredRoles based on enableSSO value
    const auth = {
      ...variables.authentication,
      enableSSO: variables.authentication.enableSSO !== undefined ? variables.authentication.enableSSO : true
    };

    // When enableSSO is false, default type to 'none' and requiredRoles to []
    // When enableSSO is true, default type to 'azure' if not provided
    if (auth.enableSSO === false) {
      auth.type = sanitizeAuthType(variables.authentication.type || 'none');
      auth.requiredRoles = variables.authentication.requiredRoles || [];
    } else {
      auth.type = sanitizeAuthType(variables.authentication.type || 'azure');
      auth.requiredRoles = variables.authentication.requiredRoles || [];
    }

    transformed.authentication = auth;
  }

  const repository = validateRepositoryConfig(variables.repository);
  if (repository) {
    transformed.repository = repository;
  }

  const build = validateBuildConfig(variables.build);
  if (build) {
    transformed.build = build;
  }

  const deployment = validateDeploymentConfig(variables.deployment);
  if (deployment) {
    transformed.deployment = deployment;
  }

  if (variables.startupCommand) {
    transformed.startupCommand = variables.startupCommand;
  }
  if (variables.runtimeVersion) {
    transformed.runtimeVersion = variables.runtimeVersion;
  }
  if (variables.scaling) {
    transformed.scaling = variables.scaling;
  }
  if (variables.frontDoorRouting) {
    transformed.frontDoorRouting = variables.frontDoorRouting;
  }
  if (variables.roles) {
    transformed.roles = variables.roles;
  }
  if (variables.permissions) {
    transformed.permissions = variables.permissions;
  }

  return transformed;
}

/**
 * Transforms nested variables.yaml structure to flat schema format
 * Converts app.*, image.*, requires.* to schema-compatible structure
 * Handles both flat and nested structures
 *
 * @function transformVariablesForValidation
 * @param {Object} variables - Raw variables from YAML
 * @param {string} appName - Application name (fallback)
 * @returns {Object} Transformed variables matching schema
 */
function transformVariablesForValidation(variables, appName) {
  // Check if structure is already flat (has key, displayName, image as string)
  const isFlat = variables.key && variables.image && typeof variables.image === 'string';

  if (isFlat) {
    return transformFlatStructure(variables, appName);
  }

  // Nested structure - transform it
  const requires = variables.requires || {};
  const imageRef = buildImageReference(variables, appName);

  // Transform to flat schema structure
  const transformed = {
    key: variables.app?.key || appName,
    displayName: variables.app?.displayName || appName,
    description: variables.app?.description || '',
    type: variables.app?.type || 'webapp',
    image: imageRef,
    registryMode: variables.image?.registryMode || 'external',
    port: variables.port || 3000,
    requiresDatabase: requires.database || false,
    requiresRedis: requires.redis || false,
    requiresStorage: requires.storage || false,
    databases: requires.databases || (requires.database ? [{ name: variables.app?.key || appName }] : [])
  };

  const result = transformOptionalFields(variables, transformed);

  // Add placeholder deploymentKey for validation (will be generated from JSON later)
  // This is a 64-character hex string matching the SHA256 pattern
  if (!result.deploymentKey) {
    result.deploymentKey = '0000000000000000000000000000000000000000000000000000000000000000';
  }

  return result;
}

module.exports = {
  transformVariablesForValidation
};

