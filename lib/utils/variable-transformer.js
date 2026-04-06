/**
 * Variable Transformation Utilities
 *
 * Transforms nested application config structure to flat schema format
 * Converts app.*, image.*, requires.* to schema-compatible structure
 *
 * @fileoverview Variable transformation utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getContainerPort } = require('./port-resolver');

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
 * Builds base result object from variables
 * @function buildBaseResult
 * @param {Object} variables - Raw variables from YAML
 * @param {string} appName - Application name (fallback)
 * @returns {Object} Base result object
 */
function buildBaseResult(variables, appName) {
  return {
    key: variables.key || appName,
    displayName: variables.displayName || appName,
    description: variables.description || '',
    type: variables.type || 'webapp',
    image: variables.image,
    registryMode: variables.registryMode || 'external',
    port: getContainerPort(variables, 3000),
    requiresDatabase: variables.requiresDatabase || false,
    requiresRedis: variables.requiresRedis || false,
    requiresStorage: variables.requiresStorage || false,
    databases: variables.databases || [],
    ...variables
  };
}

/**
 * Handles authentication type sanitization
 * @function sanitizeAuthenticationType
 * @param {Object} authentication - Authentication object
 * @returns {Object} Sanitized authentication object
 */
function sanitizeAuthenticationType(authentication) {
  if (!authentication || !authentication.type) {
    return authentication;
  }
  return {
    ...authentication,
    type: sanitizeAuthType(authentication.type)
  };
}

/**
 * Handles partial authentication objects with enableSSO
 * @function handlePartialAuthentication
 * @param {Object} authentication - Authentication object
 * @returns {Object} Processed authentication object
 */
function handlePartialAuthentication(authentication) {
  if (!authentication || authentication.enableSSO === undefined) {
    return authentication;
  }

  const auth = {
    ...authentication,
    enableSSO: authentication.enableSSO
  };

  // When enableSSO is false, default type to 'none' and requiredRoles to []
  // When enableSSO is true, default type to 'azure' if not provided
  if (auth.enableSSO === false) {
    auth.type = sanitizeAuthType(authentication.type || 'none');
    auth.requiredRoles = authentication.requiredRoles || [];
  } else {
    auth.type = sanitizeAuthType(authentication.type || 'azure');
    auth.requiredRoles = authentication.requiredRoles || [];
  }

  return auth;
}

/**
 * Transforms flat structure to schema-compatible format
 * @function transformFlatStructure
 * @param {Object} variables - Raw variables from YAML
 * @param {string} appName - Application name (fallback)
 * @returns {Object} Transformed variables matching schema
 */
function transformFlatStructure(variables, appName) {
  const result = buildBaseResult(variables, appName);

  // Sanitize authentication if present
  if (result.authentication) {
    result.authentication = sanitizeAuthenticationType(result.authentication);
    result.authentication = handlePartialAuthentication(result.authentication);
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
 * Validates and transforms deployment configuration.
 * Manifest is generic: deployment URL/env are resolved outside the manifest (user/config).
 * @function validateDeploymentConfig
 * @param {Object} _deployment - Deployment configuration (unused; manifest is generic)
 * @returns {null} No deployment block emitted from variables
 */
function validateDeploymentConfig(_deployment) {
  return null;
}

/**
 * Transforms authentication configuration
 * @function transformAuthentication
 * @param {Object} authentication - Authentication configuration
 * @returns {Object} Transformed authentication object
 */
function transformAuthentication(authentication) {
  const auth = {
    ...authentication,
    enableSSO: authentication.enableSSO !== undefined ? authentication.enableSSO : true
  };

  // When enableSSO is false, default type to 'none' and requiredRoles to []
  // When enableSSO is true, default type to 'azure' if not provided
  if (auth.enableSSO === false) {
    auth.type = sanitizeAuthType(authentication.type || 'none');
    auth.requiredRoles = authentication.requiredRoles || [];
  } else {
    auth.type = sanitizeAuthType(authentication.type || 'azure');
    auth.requiredRoles = authentication.requiredRoles || [];
  }

  return auth;
}

/**
 * Transforms configuration sections (repository, build, deployment)
 * @function transformConfigSections
 * @param {Object} variables - Raw variables from YAML
 * @param {Object} transformed - Base transformed object
 */
function transformConfigSections(variables, transformed) {
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
}

/**
 * Transforms simple optional fields
 * @function transformSimpleOptionalFields
 * @param {Object} variables - Raw variables from YAML
 * @param {Object} transformed - Base transformed object
 */
function transformSimpleOptionalFields(variables, transformed) {
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
  if (variables.externalIntegration) {
    transformed.externalIntegration = variables.externalIntegration;
  }
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
    transformed.authentication = transformAuthentication(variables.authentication);
  }

  transformConfigSections(variables, transformed);
  transformSimpleOptionalFields(variables, transformed);

  return transformed;
}

/**
 * Transforms nested application config structure to flat schema format
 * Converts app.*, image.*, requires.* to schema-compatible structure
 * Handles both flat and nested structures
 *
 * @function transformVariablesForValidation
 * @param {Object} variables - Raw variables from YAML
 * @param {string} appName - Application name (fallback)
 * @returns {Object} Transformed variables matching schema
 */
/**
 * Builds base transformed structure from nested variables
 * @function buildBaseTransformedStructure
 * @param {Object} variables - Variables object
 * @param {string} appName - Application name
 * @returns {Object} Base transformed structure
 */
function buildBaseTransformedStructure(variables, appName) {
  const requires = variables.requires || {};
  const imageRef = buildImageReference(variables, appName);

  return {
    key: variables.app?.key || appName,
    displayName: variables.app?.displayName || appName,
    description: variables.app?.description || '',
    type: variables.app?.type || 'webapp',
    image: imageRef,
    registryMode: variables.image?.registryMode || 'external',
    port: getContainerPort(variables, 3000),
    requiresDatabase: requires.database || false,
    requiresRedis: requires.redis || false,
    requiresStorage: requires.storage || false,
    databases: requires.databases || (requires.database ? [{ name: variables.app?.key || appName }] : [])
  };
}

function transformVariablesForValidation(variables, appName) {
  // Check if structure is already flat
  const isFlat = variables.key && variables.image && typeof variables.image === 'string';

  if (isFlat) {
    return transformFlatStructure(variables, appName);
  }

  // Nested structure - transform it
  const transformed = buildBaseTransformedStructure(variables, appName);
  return transformOptionalFields(variables, transformed);
}

module.exports = {
  transformVariablesForValidation
};

