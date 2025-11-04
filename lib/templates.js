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
function generateVariablesYaml(appName, config) {
  const displayName = appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  // Parse image name to separate name and tag
  let imageName = appName;
  let imageTag = 'latest';
  const imageNameWithTag = `${appName}:latest`;
  const colonIndex = imageNameWithTag.lastIndexOf(':');
  if (colonIndex !== -1) {
    imageName = imageNameWithTag.substring(0, colonIndex);
    imageTag = imageNameWithTag.substring(colonIndex + 1);
  }

  const variables = {
    app: {
      key: appName,
      displayName: displayName,
      description: `${appName.replace(/-/g, ' ')} application`,
      type: 'webapp'
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
      context: `../${appName}`,
      dockerfile: '',
      secrets: null
    },
    repository: {
      enabled: false,
      repositoryUrl: ''
    },
    deployment: {
      controllerUrl: '',
      environment: 'dev',
      clientId: '',
      clientSecret: ''
    }
  };

  // Add databases array when database is enabled
  if (config.database) {
    // Database names must match schema pattern: ^[a-z0-9_]+$ (no hyphens)
    const dbName = appName.replace(/-/g, '_');
    variables.requires.databases = [
      { name: dbName }
    ];
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

  return yaml.dump(variables, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });
}

/**
 * Builds core application environment variables
 * @param {Object} config - Configuration options
 * @returns {Object} Core environment variables
 */
function buildCoreEnv(config) {
  return {
    'NODE_ENV': 'development',
    'PORT': config.port || 3000,
    'APP_NAME': config.appName || 'myapp',
    'LOG_LEVEL': 'info'
  };
}

/**
 * Builds database environment variables
 * @param {Object} config - Configuration options
 * @returns {Object} Database environment variables
 */
function buildDatabaseEnv(config) {
  if (!config.database) {
    return {};
  }

  const appName = config.appName || 'myapp';
  // Database names must use underscores (PostgreSQL doesn't allow hyphens)
  const dbName = appName.replace(/-/g, '_');

  return {
    'DATABASE_URL': `kv://databases-${appName}-0-urlKeyVault`,
    'DB_HOST': '${DB_HOST}',
    'DB_PORT': '5432',
    'DB_NAME': dbName,
    'DB_USER': `${dbName}_user`,
    'DB_PASSWORD': `kv://databases-${appName}-0-passwordKeyVault`
  };
}

/**
 * Builds Redis environment variables
 * @param {Object} config - Configuration options
 * @returns {Object} Redis environment variables
 */
function buildRedisEnv(config) {
  if (!config.redis) {
    return {};
  }

  return {
    'REDIS_URL': 'kv://redis-url',
    'REDIS_HOST': '${REDIS_HOST}',
    'REDIS_PORT': '6379',
    'REDIS_PASSWORD': 'kv://redis-password'
  };
}

/**
 * Builds storage environment variables
 * @param {Object} config - Configuration options
 * @returns {Object} Storage environment variables
 */
function buildStorageEnv(config) {
  if (!config.storage) {
    return {};
  }

  return {
    'STORAGE_TYPE': 'local',
    'STORAGE_PATH': '/app/storage',
    'STORAGE_URL': 'kv://storage-url',
    'STORAGE_KEY': 'kv://storage-key',
    'STORAGE_SECRET': 'kv://storage-secret'
  };
}

/**
 * Builds authentication environment variables
 * @param {Object} config - Configuration options
 * @returns {Object} Authentication environment variables
 */
function buildAuthEnv(config) {
  if (!config.authentication) {
    return {};
  }

  return {
    'JWT_SECRET': 'kv://jwt-secret',
    'JWT_EXPIRES_IN': '24h',
    'AUTH_PROVIDER': 'local',
    'SESSION_SECRET': 'kv://session-secret'
  };
}

/**
 * Builds MISO Controller environment variables
 * @param {Object} config - Configuration options
 * @returns {Object} MISO Controller environment variables
 */
function buildMonitoringEnv(config) {
  if (!config.controller) {
    return {};
  }

  return {
    'MISO_CONTROLLER_URL': config.controllerUrl || 'https://controller.aifabrix.ai',
    'MISO_ENVIRONMENT': 'dev',
    'MISO_CLIENTID': 'kv://miso-clientid',
    'MISO_CLIENTSECRET': 'kv://miso-clientsecret'
  };
}

/**
 * Adds core variables section to template lines
 * @param {Array<string>} lines - Template lines array
 * @param {Object} envVars - Environment variables
 */
function addCoreVariables(lines, envVars) {
  Object.entries(envVars).forEach(([key, value]) => {
    if (key.startsWith('NODE_ENV') || key.startsWith('PORT') ||
        key.startsWith('APP_NAME') || key.startsWith('LOG_LEVEL')) {
      lines.push(`${key}=${value}`);
    }
  });
}

/**
 * Adds MISO Controller section to template lines
 * @param {Array<string>} lines - Template lines array
 * @param {Object} envVars - Environment variables
 */
function addMonitoringSection(lines, envVars) {
  lines.push('', '# MISO Controller Configuration', '');
  lines.push(`MISO_CONTROLLER_URL=${envVars['MISO_CONTROLLER_URL']}`);
  lines.push(`MISO_ENVIRONMENT=${envVars['MISO_ENVIRONMENT']}`);
  lines.push(`MISO_CLIENTID=${envVars['MISO_CLIENTID']}`);
  lines.push(`MISO_CLIENTSECRET=${envVars['MISO_CLIENTSECRET']}`);
}

/**
 * Generate env.template content with conditional variables
 * @param {Object} config - Configuration options
 * @param {Object} existingEnv - Existing environment variables
 * @returns {string} Environment template content
 */
function generateEnvTemplate(config, existingEnv = {}) {
  const envVars = {
    ...buildCoreEnv(config),
    ...buildDatabaseEnv(config),
    ...buildRedisEnv(config),
    ...buildStorageEnv(config),
    ...buildAuthEnv(config),
    ...buildMonitoringEnv(config)
  };

  // Merge with existing environment variables
  Object.assign(envVars, existingEnv);

  // Generate template content
  const lines = [
    '# Environment Variables Template',
    '# Use kv:// references for secrets (resolved from .aifabrix/secrets.yaml)',
    '# Use ${VAR} for environment-specific values',
    '',
    '# =============================================================================',
    '# APPLICATION ENVIRONMENT',
    '# =============================================================================',
    ''
  ];

  // Add core variables
  addCoreVariables(lines, envVars);

  // Add service-specific sections
  if (config.database) {
    lines.push('', '# =============================================================================');
    lines.push('# DATABASE CONFIGURATION');
    lines.push('# =============================================================================');
    lines.push('# Connects to external postgres from aifabrix-setup');
    lines.push('');
    // Add all DB_* and DATABASE_* variables together (sorted for consistency)
    const dbVars = Object.entries(envVars)
      .filter(([key]) => key.startsWith('DB_') || key.startsWith('DATABASE_'))
      .sort(([a], [b]) => {
        // Sort DB_* before DATABASE_*, then alphabetically
        const aPrefix = a.startsWith('DB_') ? 0 : 1;
        const bPrefix = b.startsWith('DB_') ? 0 : 1;
        if (aPrefix !== bPrefix) return aPrefix - bPrefix;
        return a.localeCompare(b);
      });
    dbVars.forEach(([key, value]) => {
      lines.push(`${key}=${value}`);
    });
  }

  if (config.redis) {
    lines.push('', '# =============================================================================');
    lines.push('# REDIS CONFIGURATION');
    lines.push('# =============================================================================');
    lines.push('# Connects to external redis from aifabrix-setup');
    lines.push('');
    Object.entries(envVars).forEach(([key, value]) => {
      if (key.startsWith('REDIS_')) {
        lines.push(`${key}=${value}`);
      }
    });
  }

  if (config.storage) {
    lines.push('', '# =============================================================================');
    lines.push('# STORAGE CONFIGURATION');
    lines.push('# =============================================================================');
    lines.push('');
    Object.entries(envVars).forEach(([key, value]) => {
      if (key.startsWith('STORAGE_')) {
        lines.push(`${key}=${value}`);
      }
    });
  }

  if (config.authentication) {
    lines.push('', '# =============================================================================');
    lines.push('# AUTHENTICATION CONFIGURATION');
    lines.push('# =============================================================================');
    lines.push('# Connects to external keycloak from aifabrix-setup');
    lines.push('');
    // Add all JWT_*, AUTH_*, and SESSION_* variables together (sorted for consistency)
    const authVars = Object.entries(envVars)
      .filter(([key]) => key.startsWith('JWT_') || key.startsWith('AUTH_') || key.startsWith('SESSION_'))
      .sort(([a], [b]) => {
        // Sort by prefix priority: JWT_ (0), AUTH_ (1), SESSION_ (2), then alphabetically
        const getPrefixPriority = (key) => {
          if (key.startsWith('JWT_')) return 0;
          if (key.startsWith('AUTH_')) return 1;
          if (key.startsWith('SESSION_')) return 2;
          return 3;
        };
        const aPriority = getPrefixPriority(a);
        const bPriority = getPrefixPriority(b);
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.localeCompare(b);
      });
    authVars.forEach(([key, value]) => {
      lines.push(`${key}=${value}`);
    });
  }

  if (config.controller) {
    addMonitoringSection(lines, envVars);
  }

  return lines.join('\n');
}

/**
 * Generate rbac.yaml content for RBAC configuration
 * @param {string} appName - Application name
 * @param {Object} config - Configuration options
 * @returns {string} RBAC YAML content
 */
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

/**
 * Generate secrets.yaml content for sensitive values
 * @param {Object} config - Configuration options
 * @param {Object} existingSecrets - Existing secrets from .env
 * @returns {string} Secrets YAML content
 */
function generateSecretsYaml(config, existingSecrets = {}) {
  const secrets = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: 'app-secrets',
      namespace: 'default'
    },
    type: 'Opaque',
    data: {}
  };

  // Add secrets based on enabled services
  if (config.database) {
    secrets.data['database-password'] = 'base64-encoded-password';
    secrets.data['database-user'] = 'base64-encoded-user';
  }

  if (config.redis) {
    secrets.data['redis-password'] = 'base64-encoded-redis-password';
  }

  if (config.storage) {
    secrets.data['storage-key'] = 'base64-encoded-storage-key';
    secrets.data['storage-secret'] = 'base64-encoded-storage-secret';
  }

  if (config.authentication) {
    secrets.data['jwt-secret'] = 'base64-encoded-jwt-secret';
    secrets.data['session-secret'] = 'base64-encoded-session-secret';
  }

  // Add existing secrets
  Object.entries(existingSecrets).forEach(([key, value]) => {
    secrets.data[key] = Buffer.from(value).toString('base64');
  });

  return yaml.dump(secrets, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });
}

module.exports = {
  generateVariablesYaml,
  generateEnvTemplate,
  generateRbacYaml,
  generateSecretsYaml
};
