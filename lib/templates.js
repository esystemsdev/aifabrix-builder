/**
 * YAML Template Generation Module
 *
 * Generates configuration files for AI Fabrix applications
 * following ISO 27001 security standards
 */

const yaml = require('js-yaml');

/**
 * Generate variables.yaml content for an application
 * @param {string} appName - Application name
 * @param {Object} config - Configuration options
 * @returns {string} YAML content
 */
function generateVariablesYaml(appName, config) {
  const variables = {
    app: {
      key: appName,
      name: appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `${appName.replace(/-/g, ' ')} application`,
      version: '1.0.0'
    },
    build: {
      language: config.language || 'typescript',
      port: parseInt(config.port, 10) || 3000,
      environment: 'development'
    },
    services: {
      database: config.database || false,
      redis: config.redis || false,
      storage: config.storage || false,
      authentication: config.authentication || false
    },
    security: {
      enableRBAC: config.authentication || false,
      requireAuth: config.authentication || false,
      auditLogging: true
    },
    monitoring: {
      healthCheck: true,
      metrics: true,
      logging: true
    }
  };

  return yaml.dump(variables, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });
}

/**
 * Generate env.template content with conditional variables
 * @param {Object} config - Configuration options
 * @param {Object} existingEnv - Existing environment variables
 * @returns {string} Environment template content
 */
function generateEnvTemplate(config, existingEnv = {}) {
  const envVars = {
    // Core application settings
    'NODE_ENV': 'development',
    'PORT': config.port || 3000,
    'APP_NAME': config.appName || 'myapp',
    'LOG_LEVEL': 'info'
  };

  // Add database variables if enabled
  if (config.database) {
    envVars['DATABASE_URL'] = 'kv://database-url';
    envVars['DB_HOST'] = 'localhost';
    envVars['DB_PORT'] = '5432';
    envVars['DB_NAME'] = config.appName || 'myapp';
    envVars['DB_USER'] = 'kv://database-user';
    envVars['DB_PASSWORD'] = 'kv://database-password';
  }

  // Add Redis variables if enabled
  if (config.redis) {
    envVars['REDIS_URL'] = 'kv://redis-url';
    envVars['REDIS_HOST'] = 'localhost';
    envVars['REDIS_PORT'] = '6379';
    envVars['REDIS_PASSWORD'] = 'kv://redis-password';
  }

  // Add storage variables if enabled
  if (config.storage) {
    envVars['STORAGE_TYPE'] = 'local';
    envVars['STORAGE_PATH'] = '/app/storage';
    envVars['STORAGE_URL'] = 'kv://storage-url';
    envVars['STORAGE_KEY'] = 'kv://storage-key';
    envVars['STORAGE_SECRET'] = 'kv://storage-secret';
  }

  // Add authentication variables if enabled
  if (config.authentication) {
    envVars['JWT_SECRET'] = 'kv://jwt-secret';
    envVars['JWT_EXPIRES_IN'] = '24h';
    envVars['AUTH_PROVIDER'] = 'local';
    envVars['SESSION_SECRET'] = 'kv://session-secret';
  }

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
  Object.entries(envVars).forEach(([key, value]) => {
    if (key.startsWith('NODE_ENV') || key.startsWith('PORT') ||
        key.startsWith('APP_NAME') || key.startsWith('LOG_LEVEL')) {
      lines.push(`${key}=${value}`);
    }
  });

  // Add service-specific sections
  if (config.database) {
    lines.push('', '# Database Configuration', '');
    Object.entries(envVars).forEach(([key, value]) => {
      if (key.startsWith('DB_') || key.startsWith('DATABASE_')) {
        lines.push(`${key}=${value}`);
      }
    });
  }

  if (config.redis) {
    lines.push('', '# Redis Configuration', '');
    Object.entries(envVars).forEach(([key, value]) => {
      if (key.startsWith('REDIS_')) {
        lines.push(`${key}=${value}`);
      }
    });
  }

  if (config.storage) {
    lines.push('', '# Storage Configuration', '');
    Object.entries(envVars).forEach(([key, value]) => {
      if (key.startsWith('STORAGE_')) {
        lines.push(`${key}=${value}`);
      }
    });
  }

  if (config.authentication) {
    lines.push('', '# Authentication Configuration', '');
    Object.entries(envVars).forEach(([key, value]) => {
      if (key.startsWith('JWT_') || key.startsWith('AUTH_') || key.startsWith('SESSION_')) {
        lines.push(`${key}=${value}`);
      }
    });
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
