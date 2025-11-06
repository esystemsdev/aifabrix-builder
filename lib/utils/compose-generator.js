/**
 * Docker Compose Generation Utilities
 *
 * This module handles Docker Compose configuration generation for application running.
 * Separated from app-run.js to maintain file size limits.
 *
 * @fileoverview Docker Compose generation utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

// Register Handlebars helper for quoting PostgreSQL identifiers
// PostgreSQL requires identifiers with hyphens or special characters to be quoted
handlebars.registerHelper('pgQuote', (identifier) => {
  if (!identifier) {
    return '';
  }
  // Always quote identifiers to handle hyphens and special characters
  return `"${String(identifier).replace(/"/g, '""')}"`;
});

// Helper to generate quoted PostgreSQL user name from database name
handlebars.registerHelper('pgUser', (dbName) => {
  if (!dbName) {
    return '';
  }
  const userName = `${String(dbName)}_user`;
  return `"${userName.replace(/"/g, '""')}"`;
});

/**
 * Loads and compiles Docker Compose template
 * @param {string} language - Language type
 * @returns {Function} Compiled Handlebars template
 * @throws {Error} If template not found
 */
function loadDockerComposeTemplate(language) {
  const templatePath = path.join(__dirname, '..', '..', 'templates', language, 'docker-compose.hbs');
  if (!fsSync.existsSync(templatePath)) {
    throw new Error(`Docker Compose template not found for language: ${language}`);
  }

  const templateContent = fsSync.readFileSync(templatePath, 'utf8');
  return handlebars.compile(templateContent);
}

/**
 * Extracts image name from configuration (same logic as build.js)
 * @param {Object} config - Application configuration
 * @param {string} appName - Application name (fallback)
 * @returns {string} Image name
 */
function getImageName(config, appName) {
  if (typeof config.image === 'string') {
    return config.image.split(':')[0];
  } else if (config.image?.name) {
    return config.image.name;
  } else if (config.app?.key) {
    return config.app.key;
  }
  return appName;
}

/**
 * Builds app configuration section
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @returns {Object} App configuration
 */
function buildAppConfig(appName, config) {
  return {
    key: appName,
    name: config.displayName || appName
  };
}

/**
 * Builds image configuration section
 * @param {Object} config - Application configuration
 * @param {string} appName - Application name
 * @returns {Object} Image configuration
 */
function buildImageConfig(config, appName) {
  const imageName = getImageName(config, appName);
  const imageTag = config.image?.tag || 'latest';
  return {
    name: imageName,
    tag: imageTag
  };
}

/**
 * Builds health check configuration section
 * @param {Object} config - Application configuration
 * @returns {Object} Health check configuration
 */
function buildHealthCheckConfig(config) {
  return {
    path: config.healthCheck?.path || '/health',
    interval: config.healthCheck?.interval || 30
  };
}

/**
 * Builds requires configuration section
 * @param {Object} config - Application configuration
 * @returns {Object} Requires configuration
 */
function buildRequiresConfig(config) {
  const hasDatabases = config.requires?.databases || config.databases;
  return {
    requiresDatabase: config.requires?.database || config.services?.database || !!hasDatabases || false,
    requiresStorage: config.requires?.storage || config.services?.storage || false,
    requiresRedis: config.requires?.redis || config.services?.redis || false
  };
}

/**
 * Builds service configuration for template data
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {number} port - Application port
 * @returns {Object} Service configuration
 */
function buildServiceConfig(appName, config, port) {
  // Container port: build.containerPort > config.port
  const containerPortValue = config.build?.containerPort || config.port || port;

  // Host port: use port parameter (already calculated from CLI --port or config.port in generateDockerCompose)
  // Note: build.localPort is ONLY used for .env file PORT variable (for local PC dev), NOT for Docker Compose
  const hostPort = port;

  return {
    app: buildAppConfig(appName, config),
    image: buildImageConfig(config, appName),
    port: containerPortValue, // Container port (for health check and template)
    containerPort: containerPortValue, // Container port (always set, equals containerPort if exists, else port)
    hostPort: hostPort, // Host port (options.port if provided, else config.port)
    build: {
      localPort: config.build?.localPort || null // Only used for .env file PORT variable, not for Docker Compose
    },
    healthCheck: buildHealthCheckConfig(config),
    ...buildRequiresConfig(config)
  };
}

/**
 * Builds volumes configuration for template data
 * @param {string} appName - Application name
 * @returns {Object} Volumes configuration
 */
function buildVolumesConfig(appName) {
  // Use forward slashes for Docker paths (works on both Windows and Unix)
  const volumePath = path.join(process.cwd(), 'data', appName);
  return {
    mountVolume: volumePath.replace(/\\/g, '/')
  };
}

/**
 * Builds networks configuration for template data
 * @param {Object} config - Application configuration
 * @returns {Object} Networks configuration
 */
function buildNetworksConfig(config) {
  // Get databases from requires.databases or top-level databases
  const databases = config.requires?.databases || config.databases || [];
  return {
    databases: databases
  };
}

/**
 * Reads database passwords from .env file
 * Requires DB_0_PASSWORD, DB_1_PASSWORD, etc. to be set in .env file
 * @async
 * @param {string} envPath - Path to .env file
 * @param {Array<Object>} databases - Array of database configurations
 * @param {string} appKey - Application key (fallback for single database)
 * @returns {Promise<Object>} Object with passwords array and lookup map
 * @throws {Error} If required password variables are missing
 */
async function readDatabasePasswords(envPath, databases, appKey) {
  const passwords = {};
  const passwordsArray = [];

  // Read .env file
  const envVars = {};
  if (!fsSync.existsSync(envPath)) {
    throw new Error(`.env file not found: ${envPath}`);
  }

  try {
    const envContent = await fs.readFile(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        envVars[key] = value;
      }
    }
  } catch (error) {
    throw new Error(`Failed to read .env file: ${error.message}`);
  }

  // Process each database
  if (databases && databases.length > 0) {
    for (let i = 0; i < databases.length; i++) {
      const db = databases[i];
      const dbName = db.name || appKey;
      const passwordKey = `DB_${i}_PASSWORD`;

      if (!(passwordKey in envVars)) {
        throw new Error(`Missing required password variable ${passwordKey} in .env file`);
      }

      const password = envVars[passwordKey].trim();
      if (!password || password.length === 0) {
        throw new Error(`Password variable ${passwordKey} is empty in .env file`);
      }

      passwords[dbName] = password;
      passwordsArray.push(password);
    }
  } else {
    // Single database case - use DB_0_PASSWORD or DB_PASSWORD
    const passwordKey = ('DB_0_PASSWORD' in envVars) ? 'DB_0_PASSWORD' : 'DB_PASSWORD';

    if (!(passwordKey in envVars)) {
      throw new Error(`Missing required password variable ${passwordKey} in .env file. Add DB_0_PASSWORD or DB_PASSWORD to your .env file.`);
    }

    const password = envVars[passwordKey].trim();
    if (!password || password.length === 0) {
      throw new Error(`Password variable ${passwordKey} is empty in .env file`);
    }

    passwords[appKey] = password;
    passwordsArray.push(password);
  }

  return {
    map: passwords,
    array: passwordsArray
  };
}

/**
 * Generates Docker Compose configuration from template
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} options - Run options
 * @returns {Promise<string>} Generated compose content
 */
async function generateDockerCompose(appName, config, options) {
  const language = config.build?.language || config.language || 'typescript';
  const template = loadDockerComposeTemplate(language);

  // Use options.port if provided, otherwise use config.port
  // (localPort will be handled in buildServiceConfig)
  const port = options.port || config.port || 3000;

  const serviceConfig = buildServiceConfig(appName, config, port);
  const volumesConfig = buildVolumesConfig(appName);
  const networksConfig = buildNetworksConfig(config);

  // Get absolute path to .env file for docker-compose
  const envFilePath = path.join(process.cwd(), 'builder', appName, '.env');
  const envFileAbsolutePath = envFilePath.replace(/\\/g, '/'); // Use forward slashes for Docker

  // Read database passwords from .env file
  const databases = networksConfig.databases || [];
  const databasePasswords = await readDatabasePasswords(envFilePath, databases, appName);

  const templateData = {
    ...serviceConfig,
    ...volumesConfig,
    ...networksConfig,
    envFile: envFileAbsolutePath,
    databasePasswords: databasePasswords
  };

  return template(templateData);
}

module.exports = {
  generateDockerCompose,
  getImageName
};

