/**
 * Environment Template Generation
 *
 * Generates env.template content with conditional variables
 *
 * @fileoverview Environment template generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Builds core application environment variables
 * @param {Object} config - Configuration options
 * @returns {Object} Core environment variables
 */
function buildCoreEnv(config) {
  return {
    'NODE_ENV': '${NODE_ENV}',
    'PORT': config.port || 3000,
    'APP_NAME': config.appName || 'myapp',
    'LOG_LEVEL': 'info'
  };
}

/**
 * Builds Python-specific environment variables
 * @param {Object} config - Configuration options
 * @returns {Object} Python environment variables
 */
function buildPythonEnv(config) {
  const language = config.language || 'typescript';
  if (language !== 'python') {
    return {};
  }

  return {
    'PYTHONUNBUFFERED': '${PYTHONUNBUFFERED}',
    'PYTHONDONTWRITEBYTECODE': '${PYTHONDONTWRITEBYTECODE}',
    'PYTHONIOENCODING': '${PYTHONIOENCODING}'
  };
}

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
    'DB_PORT': '${DB_PORT}',
    'DB_NAME': dbName,
    'DB_USER': `${dbName}_user`,
    'DB_PASSWORD': `kv://databases-${appName}-0-passwordKeyVault`,
    // Also include DB_0_PASSWORD for compatibility with compose generator
    // (compose generator expects DB_0_PASSWORD when databases array is present)
    'DB_0_PASSWORD': `kv://databases-${appName}-0-passwordKeyVault`
  };
}

function buildRedisEnv(config) {
  if (!config.redis) {
    return {};
  }

  return {
    'REDIS_URL': 'kv://redis-url',
    'REDIS_HOST': '${REDIS_HOST}',
    'REDIS_PORT': '${REDIS_PORT}',
    'REDIS_PASSWORD': 'kv://redis-passwordKeyVault'
  };
}

function buildStorageEnv(config) {
  if (!config.storage) {
    return {};
  }

  return {
    'STORAGE_TYPE': 'local',
    'STORAGE_PATH': '/app/storage'
  };
}

function buildAuthEnv(config) {
  if (!config.authentication) {
    return {};
  }

  return {
    'JWT_SECRET': 'kv://miso-controller-jwt-secretKeyVault',
    'JWT_EXPIRES_IN': '24h',
    'AUTH_PROVIDER': 'local'
  };
}

function buildMonitoringEnv(config) {
  if (!config.controller) {
    return {};
  }

  return {
    'MISO_CONTROLLER_URL': config.controllerUrl || 'https://controller.aifabrix.ai',
    'MISO_ENVIRONMENT': 'dev',
    'MISO_CLIENTID': 'kv://miso-controller-client-idKeyVault',
    'MISO_CLIENTSECRET': 'kv://miso-controller-client-secretKeyVault',
    'MISO_WEB_SERVER_URL': 'kv://miso-controller-web-server-url'
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
        key.startsWith('APP_NAME') || key.startsWith('LOG_LEVEL') ||
        key.startsWith('PYTHON')) {
      lines.push(`${key}=${value}`);
    }
  });

  // Add ALLOWED_ORIGINS and WEB_SERVER_URL after PORT variable
  // ALLOWED_ORIGINS: My application public address
  lines.push('ALLOWED_ORIGINS=http://localhost:*,');
  // WEB_SERVER_URL: Miso public address (uses ${PORT} template variable)
  lines.push('WEB_SERVER_URL=http://localhost:${PORT},');
}

function addMonitoringSection(lines, envVars) {
  lines.push('', '# MISO Controller Configuration', '');
  lines.push(`MISO_CONTROLLER_URL=${envVars['MISO_CONTROLLER_URL']}`);
  lines.push(`MISO_ENVIRONMENT=${envVars['MISO_ENVIRONMENT']}`);
  lines.push(`MISO_CLIENTID=${envVars['MISO_CLIENTID']}`);
  lines.push(`MISO_CLIENTSECRET=${envVars['MISO_CLIENTSECRET']}`);
  // MISO_WEB_SERVER_URL: Miso public address
  if (envVars['MISO_WEB_SERVER_URL']) {
    lines.push(`MISO_WEB_SERVER_URL=${envVars['MISO_WEB_SERVER_URL']}`);
  }
}

function addDatabaseSection(lines, envVars) {
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

function addRedisSection(lines, envVars) {
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

function addStorageSection(lines, envVars) {
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

function addAuthenticationSection(lines, envVars) {
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

/**
 * Generate env.template content with conditional variables
 * @param {Object} config - Configuration options
 * @param {Object} existingEnv - Existing environment variables
 * @returns {string} Environment template content
 */
function generateEnvTemplate(config, existingEnv = {}) {
  const envVars = {
    ...buildCoreEnv(config),
    ...buildPythonEnv(config),
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
    addDatabaseSection(lines, envVars);
  }

  if (config.redis) {
    addRedisSection(lines, envVars);
  }

  if (config.storage) {
    addStorageSection(lines, envVars);
  }

  if (config.authentication) {
    addAuthenticationSection(lines, envVars);
  }

  if (config.controller) {
    addMonitoringSection(lines, envVars);
  }

  return lines.join('\n');
}

module.exports = {
  generateEnvTemplate,
  buildCoreEnv,
  buildPythonEnv,
  buildDatabaseEnv,
  buildRedisEnv,
  buildStorageEnv,
  buildAuthEnv,
  buildMonitoringEnv
};

