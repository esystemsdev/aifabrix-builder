/**
 * YAML Template Generation Module
 *
 * Generates configuration files for AI Fabrix applications
 * following ISO 27001 security standards
 */

const yaml = require('js-yaml');

/**
 * Generate variables.yaml content for an application
 * Matches application-schema.json structure
 * @param {string} appName - Application name
 * @param {Object} config - Configuration options
 * @returns {string} YAML content
 */
/**
 * Generates external system variables
 * @function generateExternalSystemVariables
 * @param {string} appName - Application name
 * @param {string} displayName - Display name
 * @param {Object} config - Configuration
 * @returns {Object} Variables object
 */
function generateExternalSystemVariables(appName, displayName, config) {
  const systemKey = config.systemKey || appName;
  const systemDisplayName = config.systemDisplayName || displayName;
  const systemDescription = config.systemDescription || `External system integration for ${appName}`;

  return {
    app: {
      key: systemKey,
      displayName: systemDisplayName,
      description: systemDescription,
      type: 'external'
    },
    deployment: {
      controllerUrl: '',
      environment: 'dev'
    },
    externalIntegration: {
      schemaBasePath: './',
      systems: [],
      dataSources: [],
      autopublish: true,
      version: '1.0.0'
    }
  };
}

/**
 * Parses image name and tag
 * @function parseImageNameAndTag
 * @param {string} appName - Application name
 * @returns {Object} Object with imageName and imageTag
 */
function parseImageNameAndTag(appName) {
  const imageNameWithTag = `${appName}:latest`;
  const colonIndex = imageNameWithTag.lastIndexOf(':');
  if (colonIndex !== -1) {
    return {
      imageName: imageNameWithTag.substring(0, colonIndex),
      imageTag: imageNameWithTag.substring(colonIndex + 1)
    };
  }
  return { imageName: appName, imageTag: 'latest' };
}

/**
 * Builds base variables object for webapp
 * @function buildWebappVariables
 * @param {string} appName - Application name
 * @param {string} displayName - Display name
 * @param {Object} config - Configuration
 * @param {string} imageName - Image name
 * @param {string} imageTag - Image tag
 * @returns {Object} Variables object
 */
function buildWebappVariables(appName, displayName, config, imageName, imageTag) {
  const appType = config.type || 'webapp';
  return {
    app: {
      key: appName,
      displayName: displayName,
      description: `${appName.replace(/-/g, ' ')} application`,
      type: appType,
      version: config.version || '1.0.0'
    },
    image: {
      name: imageName,
      tag: imageTag,
      registry: '',
      registryMode: 'external'
    },
    port: parseInt(config.port, 10) || 3000,
    requires: {
      database: config.database || false,
      redis: config.redis || false,
      storage: config.storage || false
    },
    build: {
      language: config.language || 'typescript',
      envOutputPath: null,
      context: null, // Defaults to dev directory in build process
      dockerfile: ''
    },
    repository: {
      enabled: false,
      repositoryUrl: ''
    },
    deployment: {
      controllerUrl: '',
      environment: 'dev'
    }
  };
}

/**
 * Adds optional fields to variables
 * @function addOptionalFieldsToVariables
 * @param {Object} variables - Variables object
 * @param {Object} config - Configuration
 * @param {string} appName - Application name
 */
function addOptionalFieldsToVariables(variables, config, appName) {
  // Add databases array when database is enabled
  if (config.database) {
    // Database names must match schema pattern: ^[a-z0-9_]+$ (no hyphens)
    const dbName = appName.replace(/-/g, '_');
    variables.requires.databases = [{ name: dbName }];
  }

  // Add optional healthCheck at top level
  if (config.healthCheck !== false) {
    variables.healthCheck = {
      path: '/health',
      interval: 30
    };
  }

  // Add optional authentication at top level
  if (config.authentication) {
    variables.authentication = {
      type: 'azure',
      enableSSO: true,
      requiredRoles: ['aifabrix-user']
    };
  }
}

/**
 * Dumps variables to YAML string
 * @function dumpVariablesToYaml
 * @param {Object} variables - Variables object
 * @returns {string} YAML string
 */
function dumpVariablesToYaml(variables) {
  return yaml.dump(variables, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });
}

function generateVariablesYaml(appName, config) {
  const displayName = appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const appType = config.type || 'webapp';

  // For external type, create minimal variables.yaml
  if (appType === 'external') {
    const variables = generateExternalSystemVariables(appName, displayName, config);
    return dumpVariablesToYaml(variables);
  }

  // Parse image name to separate name and tag
  const { imageName, imageTag } = parseImageNameAndTag(appName);
  const variables = buildWebappVariables(appName, displayName, config, imageName, imageTag);
  addOptionalFieldsToVariables(variables, config, appName);

  return dumpVariablesToYaml(variables);
}

const { generateEnvTemplate } = require('./templates-env');

function generateRbacYaml(appName, config) {
  if (!config.authentication) {
    return null;
  }

  // Format roles with name, value, and description
  const roles = [
    {
      name: 'AI Fabrix Admin',
      value: 'aifabrix-admin',
      description: 'Full access to all application features and configurations'
    },
    {
      name: 'AI Fabrix User',
      value: 'aifabrix-user',
      description: 'Basic user access to the application'
    },
    {
      name: 'AI Fabrix Developer',
      value: 'aifabrix-developer',
      description: 'Developer access for testing and debugging'
    }
  ];

  // Format permissions with name, roles array, and description
  const permissions = [
    {
      name: `${appName}:read`,
      roles: ['aifabrix-user', 'aifabrix-admin', 'aifabrix-developer'],
      description: 'Read access to application data'
    },
    {
      name: `${appName}:write`,
      roles: ['aifabrix-admin', 'aifabrix-developer'],
      description: 'Create and edit application data'
    },
    {
      name: `${appName}:delete`,
      roles: ['aifabrix-admin'],
      description: 'Delete application data'
    },
    {
      name: `${appName}:admin`,
      roles: ['aifabrix-admin'],
      description: 'Administrative access to application configuration'
    }
  ];

  const rbac = {
    roles: roles,
    permissions: permissions
  };

  return yaml.dump(rbac, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });
}

function generateSecretsYaml(config, existingSecrets = {}) {
  const secrets = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: 'app-secrets', namespace: 'default' },
    type: 'Opaque',
    data: {}
  };
  if (config.database) {
    secrets.data['database-password'] = 'base64-encoded-password';
    secrets.data['database-user'] = 'base64-encoded-user';
  }
  if (config.redis) {
    secrets.data['redis-passwordKeyVault'] = 'base64-encoded-redis-password';
  }
  if (config.storage) {
    secrets.data['storage-key'] = 'base64-encoded-storage-key';
    secrets.data['storage-secret'] = 'base64-encoded-storage-secret';
  }
  if (config.authentication) {
    secrets.data['miso-controller-jwt-secretKeyVault'] = 'base64-encoded-miso-controller-jwt-secretKeyVault';
  }
  Object.entries(existingSecrets).forEach(([key, value]) => {
    secrets.data[key] = Buffer.from(value).toString('base64');
  });
  return yaml.dump(secrets, { indent: 2, lineWidth: 120, noRefs: true, sortKeys: false });
}

module.exports = {
  generateVariablesYaml,
  generateEnvTemplate,
  generateRbacYaml,
  generateSecretsYaml
};
