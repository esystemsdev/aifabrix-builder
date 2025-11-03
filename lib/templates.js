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

  const variables = {
    app: {
      key: appName,
      displayName: displayName,
      description: `${appName.replace(/-/g, ' ')} application`,
      type: 'webapp',
      version: '1.0.0'
    },
    image: {
      name: `${appName}:latest`,
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
      envOutputPath: `../${appName}`,
      context: `../${appName}`,
      dockerfile: ''
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

  // Only add optional sections if enabled
  if (config.authentication) {
    variables.security = {
      enableRBAC: true,
      requireAuth: true,
      auditLogging: true
    };
  }

  if (config.healthCheck !== false) {
    variables.monitoring = {
      healthCheck: true,
      metrics: true,
      logging: true
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

  return {
    'DATABASE_URL': `kv://databases-${appName}-0-urlKeyVault`,
    'DB_HOST': 'localhost',
    'DB_PORT': '5432',
    'DB_NAME': appName,
    'DB_USER': `${appName}_user`,
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
    'REDIS_HOST': 'localhost',
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
 * Adds service-specific section to template lines
 * @param {Array<string>} lines - Template lines array
 * @param {Object} envVars - Environment variables
 * @param {string} prefix - Variable name prefix
 * @param {string} sectionName - Section name
 */
function addServiceSection(lines, envVars, prefix, sectionName) {
  lines.push('', `# ${sectionName}`, '');
  Object.entries(envVars).forEach(([key, value]) => {
    if (key.startsWith(prefix)) {
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
    '# AI Fabrix Environment Template',
    '# Copy this file to .env and fill in the actual values',
    '# Values marked with kv:// are secrets stored in Azure Key Vault',
    '',
    '# Core Application Settings',
    ''
  ];

  // Add core variables
  addCoreVariables(lines, envVars);

  // Add service-specific sections
  if (config.database) {
    addServiceSection(lines, envVars, 'DB_', 'Database Configuration');
    addServiceSection(lines, envVars, 'DATABASE_', '');
  }

  if (config.redis) {
    addServiceSection(lines, envVars, 'REDIS_', 'Redis Configuration');
  }

  if (config.storage) {
    addServiceSection(lines, envVars, 'STORAGE_', 'Storage Configuration');
  }

  if (config.authentication) {
    lines.push('', '# Authentication Configuration', '');
    addServiceSection(lines, envVars, 'JWT_', '');
    addServiceSection(lines, envVars, 'AUTH_', '');
    addServiceSection(lines, envVars, 'SESSION_', '');
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

  const rbac = {
    apiVersion: 'v1',
    kind: 'RBACConfig',
    metadata: {
      name: `${appName}-rbac`,
      namespace: 'default'
    },
    spec: {
      roles: [
        {
          name: 'admin',
          description: 'Full administrative access',
          permissions: ['*']
        },
        {
          name: 'user',
          description: 'Standard user access',
          permissions: ['read', 'write']
        },
        {
          name: 'viewer',
          description: 'Read-only access',
          permissions: ['read']
        }
      ],
      policies: [
        {
          name: 'admin-policy',
          role: 'admin',
          resources: ['*'],
          actions: ['*']
        },
        {
          name: 'user-policy',
          role: 'user',
          resources: ['data', 'profile'],
          actions: ['read', 'write']
        },
        {
          name: 'viewer-policy',
          role: 'viewer',
          resources: ['data'],
          actions: ['read']
        }
      ],
      bindings: [
        {
          name: 'admin-binding',
          role: 'admin',
          subjects: [
            {
              kind: 'User',
              name: 'admin@example.com'
            }
          ]
        }
      ]
    }
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
