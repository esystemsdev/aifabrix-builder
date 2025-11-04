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

  // Database names are kept as-is (schema allows hyphens: ^[a-z0-9-_]+$)

  // Sanitize authentication type - map keycloak to azure (schema allows: azure, local, none)
  const sanitizeAuthType = (authType) => {
    if (authType === 'keycloak') {
      return 'azure';
    } else if (authType && !['azure', 'local', 'none'].includes(authType)) {
      return 'azure'; // Default to azure if invalid type
    }
    return authType;
  };

  if (isFlat) {
    // Already flat structure, just ensure required fields exist
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
    
    return result;
  }

  // Nested structure - transform it
  const requires = variables.requires || {};

  // Build image reference string
  const imageName = variables.image?.name || variables.app?.key || appName;
  const registry = variables.image?.registry;
  const tag = variables.image?.tag || 'latest';
  const imageRef = registry ? `${registry}/${imageName}:${tag}` : `${imageName}:${tag}`;

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

  // Add optional fields if present
  if (variables.healthCheck) {
    transformed.healthCheck = variables.healthCheck;
  }
  if (variables.authentication) {
    transformed.authentication = {
      ...variables.authentication,
      type: sanitizeAuthType(variables.authentication.type)
    };
  }
  if (variables.repository) {
    // Only include repository if enabled, or if repositoryUrl is valid
    const repo = { enabled: variables.repository.enabled || false };
    if (variables.repository.repositoryUrl &&
        variables.repository.repositoryUrl.trim() !== '' &&
        /^(https:\/\/github\.com\/[^/]+\/[^/]+|https:\/\/gitlab\.com\/[^/]+\/[^/]+|https:\/\/dev\.azure\.com\/[^/]+\/[^/]+\/[^/]+)$/.test(variables.repository.repositoryUrl)) {
      repo.repositoryUrl = variables.repository.repositoryUrl;
    }
    if (repo.enabled || repo.repositoryUrl) {
      transformed.repository = repo;
    }
  }
  if (variables.build) {
    const build = {};
    if (variables.build.envOutputPath) {
      build.envOutputPath = variables.build.envOutputPath;
    }
    if (variables.build.secrets !== null && variables.build.secrets !== undefined && variables.build.secrets !== '') {
      build.secrets = variables.build.secrets;
    }
    if (variables.build.localPort) {
      build.localPort = variables.build.localPort;
    }
    if (variables.build.language) {
      build.language = variables.build.language;
    }
    if (variables.build.context) {
      build.context = variables.build.context;
    }
    if (variables.build.dockerfile && variables.build.dockerfile.trim() !== '') {
      build.dockerfile = variables.build.dockerfile;
    }
    if (Object.keys(build).length > 0) {
      transformed.build = build;
    }
  }
  if (variables.deployment) {
    const deployment = {};
    if (variables.deployment.controllerUrl &&
        variables.deployment.controllerUrl.trim() !== '' &&
        /^https:\/\/.*$/.test(variables.deployment.controllerUrl)) {
      deployment.controllerUrl = variables.deployment.controllerUrl;
    }
    if (variables.deployment.clientId &&
        variables.deployment.clientId.trim() !== '' &&
        /^[a-z0-9-]+$/.test(variables.deployment.clientId)) {
      deployment.clientId = variables.deployment.clientId;
    }
    if (variables.deployment.clientSecret &&
        variables.deployment.clientSecret.trim() !== '' &&
        /^(kv:\/\/.*|.+)$/.test(variables.deployment.clientSecret)) {
      deployment.clientSecret = variables.deployment.clientSecret;
    }
    if (Object.keys(deployment).length > 0) {
      transformed.deployment = deployment;
    }
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

module.exports = {
  transformVariablesForValidation
};

