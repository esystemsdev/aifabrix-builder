/**
 * AI Fabrix Builder Deployment JSON Builder Helpers
 *
 * Helper functions for building deployment manifest structures
 *
 * @fileoverview Builder helper functions for deployment JSON generation
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

/**
 * Builds base deployment structure
 * @function buildBaseDeployment
 * @param {string} appName - Application name
 * @param {Object} variables - Variables configuration
 * @param {Array} filteredConfiguration - Filtered environment configuration
 * @returns {Object} Base deployment structure
 */
/**
 * Builds app metadata from variables
 * @function buildAppMetadata
 * @param {string} appName - Application name
 * @param {Object} variables - Variables configuration
 * @returns {Object} App metadata
 */
function buildAppMetadata(appName, variables) {
  return {
    key: variables.app?.key || appName,
    displayName: variables.app?.displayName || appName,
    description: variables.app?.description || '',
    type: variables.app?.type || 'webapp'
  };
}

/**
 * Builds image and registry configuration
 * @function buildImageConfig
 * @param {Object} variables - Variables configuration
 * @returns {Object} Image and registry configuration
 */
function buildImageConfig(variables) {
  return {
    image: buildImageReference(variables),
    registryMode: variables.image?.registryMode || 'external'
  };
}

/**
 * Builds requirements configuration
 * @function buildRequirementsConfig
 * @param {Object} variables - Variables configuration
 * @returns {Object} Requirements configuration
 */
function buildRequirementsConfig(variables) {
  const requires = variables.requires || {};
  return {
    requiresDatabase: requires.database || false,
    requiresRedis: requires.redis || false,
    requiresStorage: requires.storage || false,
    databases: requires.databases || (requires.database ? [{ name: variables.app?.key || 'app' }] : [])
  };
}

function buildBaseDeployment(appName, variables, filteredConfiguration) {
  const appMetadata = buildAppMetadata(appName, variables);
  const imageConfig = buildImageConfig(variables);
  const requirementsConfig = buildRequirementsConfig(variables);

  return {
    ...appMetadata,
    ...imageConfig,
    port: variables.port || 3000,
    ...requirementsConfig,
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
    // Sanitize auth type (e.g., map keycloak to azure)
    if (auth.enableSSO === false) {
      auth.type = sanitizeAuthType(variables.authentication.type || 'none');
      auth.requiredRoles = variables.authentication.requiredRoles || [];
    } else {
      auth.type = sanitizeAuthType(variables.authentication.type || 'azure');
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
/**
 * Adds health check to deployment
 * @function addHealthCheckToDeployment
 * @param {Object} deployment - Deployment object
 * @param {Object} variables - Variables configuration
 */
function addHealthCheckToDeployment(deployment, variables) {
  if (variables.healthCheck) {
    deployment.healthCheck = buildHealthCheck(variables);
  }
}

/**
 * Adds roles and permissions to deployment
 * @function addRolesAndPermissions
 * @param {Object} deployment - Deployment object
 * @param {Object} variables - Variables configuration
 * @param {Object|null} rbac - RBAC configuration
 */
function addRolesAndPermissions(deployment, variables, rbac) {
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
}

/**
 * Adds validated configuration sections
 * @function addValidatedConfigSections
 * @param {Object} deployment - Deployment object
 * @param {Object} variables - Variables configuration
 */
function addValidatedConfigSections(deployment, variables) {
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
}

/**
 * Adds simple optional fields
 * @function addSimpleOptionalFields
 * @param {Object} deployment - Deployment object
 * @param {Object} variables - Variables configuration
 */
function addSimpleOptionalFields(deployment, variables) {
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
}

function buildOptionalFields(deployment, variables, rbac) {
  addHealthCheckToDeployment(deployment, variables);
  deployment.authentication = buildAuthenticationConfig(variables, rbac);
  addRolesAndPermissions(deployment, variables, rbac);
  addValidatedConfigSections(deployment, variables);
  addSimpleOptionalFields(deployment, variables);

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

module.exports = {
  buildImageReference,
  buildHealthCheck,
  buildRequirements,
  buildAuthentication,
  buildBaseDeployment,
  buildAuthenticationConfig,
  buildOptionalFields,
  buildManifestStructure,
  filterConfigurationByRegistryMode,
  sanitizeAuthType
};

