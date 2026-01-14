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
const config = require('../core/config');
const buildCopy = require('./build-copy');

// Register commonly used helpers
handlebars.registerHelper('eq', (a, b) => a === b);

// Register Handlebars helper for quoting PostgreSQL identifiers
// PostgreSQL requires identifiers with hyphens or special characters to be quoted
handlebars.registerHelper('pgQuote', (identifier) => {
  if (!identifier) {
    return '';
  }
  // Always quote identifiers to handle hyphens and special characters
  // Return SafeString to prevent HTML escaping
  return new handlebars.SafeString(`"${String(identifier).replace(/"/g, '""')}"`);
});

// Helper to generate quoted PostgreSQL user name from database name
// User names must use underscores (not hyphens) for PostgreSQL compatibility
handlebars.registerHelper('pgUser', (dbName) => {
  if (!dbName) {
    return '';
  }
  // Replace hyphens with underscores in user name (database names can have hyphens, but user names should not)
  const userName = `${String(dbName).replace(/-/g, '_')}_user`;
  // Return SafeString to prevent HTML escaping
  return new handlebars.SafeString(`"${userName.replace(/"/g, '""')}"`);
});

// Helper to generate old user name format (for migration - drops old users with hyphens)
// This is used to drop legacy users that were created with hyphens before the fix
// Returns unquoted name (quotes should be added in template where needed)
handlebars.registerHelper('pgUserOld', (dbName) => {
  if (!dbName) {
    return '';
  }
  // Old format: database name + _user (preserving hyphens)
  const userName = `${String(dbName)}_user`;
  // Return unquoted name - template will add quotes where needed
  return new handlebars.SafeString(userName);
});

// Helper to generate unquoted PostgreSQL user name (for SQL WHERE clauses)
// Returns the user name without quotes for use in SQL queries
handlebars.registerHelper('pgUserName', (dbName) => {
  if (!dbName) {
    return '';
  }
  // Replace hyphens with underscores in user name
  const userName = `${String(dbName).replace(/-/g, '_')}_user`;
  // Return unquoted name for SQL queries
  return new handlebars.SafeString(userName);
});

/**
 * Loads and compiles Docker Compose template
 * @param {string} language - Language type
 * @returns {Function} Compiled Handlebars template
 * @throws {Error} If template not found
 */
function loadDockerComposeTemplate(language) {
  // Use getProjectRoot to reliably find templates in all environments
  const { getProjectRoot } = require('./paths');
  const projectRoot = getProjectRoot();
  const templatePath = path.join(projectRoot, 'templates', language, 'docker-compose.hbs');

  if (!fsSync.existsSync(templatePath)) {
    // Provide helpful error message with actual paths checked
    const errorMessage = `Docker Compose template not found for language: ${language}\n` +
      `  Expected path: ${templatePath}\n` +
      `  Project root: ${projectRoot}\n` +
      `  Templates directory: ${path.join(projectRoot, 'templates', language)}\n` +
      `  Global PROJECT_ROOT: ${typeof global !== 'undefined' && global.PROJECT_ROOT ? global.PROJECT_ROOT : 'not set'}`;
    throw new Error(errorMessage);
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
  // Container port: build.containerPort > config.port (NEVER use host port parameter)
  // Container port should remain unchanged regardless of developer ID
  const containerPortValue = config.build?.containerPort || config.port || 3000;

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
/**
 * Reads and parses .env file
 * @async
 * @function readEnvFile
 * @param {string} envPath - Path to .env file
 * @returns {Promise<Object>} Object with environment variables
 * @throws {Error} If file not found or read fails
 */
async function readEnvFile(envPath) {
  if (!fsSync.existsSync(envPath)) {
    throw new Error(`.env file not found: ${envPath}`);
  }

  try {
    const envContent = await fs.readFile(envPath, 'utf8');
    const lines = envContent.split('\n');
    const envVars = {};

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

    return envVars;
  } catch (error) {
    throw new Error(`Failed to read .env file: ${error.message}`);
  }
}

/**
 * Validates and extracts password from environment variables
 * @function extractPassword
 * @param {Object} envVars - Environment variables
 * @param {string} passwordKey - Password key to look up
 * @returns {string} Password value
 * @throws {Error} If password is missing or empty
 */
function extractPassword(envVars, passwordKey) {
  if (!(passwordKey in envVars)) {
    throw new Error(`Missing required password variable ${passwordKey} in .env file`);
  }

  const password = envVars[passwordKey].trim();
  if (!password || password.length === 0) {
    throw new Error(`Password variable ${passwordKey} is empty in .env file`);
  }

  return password;
}

/**
 * Processes multiple databases
 * @function processMultipleDatabases
 * @param {Array} databases - Array of database configurations
 * @param {Object} envVars - Environment variables
 * @param {string} appKey - Application key
 * @returns {Object} Object with passwords map and array
 */
function processMultipleDatabases(databases, envVars, appKey) {
  const passwords = {};
  const passwordsArray = [];

  for (let i = 0; i < databases.length; i++) {
    const db = databases[i];
    const dbName = db.name || appKey;
    const passwordKey = `DB_${i}_PASSWORD`;
    const password = extractPassword(envVars, passwordKey);

    passwords[dbName] = password;
    passwordsArray.push(password);
  }

  return { passwords, passwordsArray };
}

/**
 * Processes single database case
 * @function processSingleDatabase
 * @param {Object} envVars - Environment variables
 * @param {string} appKey - Application key
 * @returns {Object} Object with passwords map and array
 */
function processSingleDatabase(envVars, appKey) {
  const passwords = {};
  const passwordsArray = [];

  // Single database case - use DB_0_PASSWORD or DB_PASSWORD
  const passwordKey = ('DB_0_PASSWORD' in envVars) ? 'DB_0_PASSWORD' : 'DB_PASSWORD';

  if (!(passwordKey in envVars)) {
    throw new Error(`Missing required password variable ${passwordKey} in .env file. Add DB_0_PASSWORD or DB_PASSWORD to your .env file.`);
  }

  const password = extractPassword(envVars, passwordKey);
  passwords[appKey] = password;
  passwordsArray.push(password);

  return { passwords, passwordsArray };
}

async function readDatabasePasswords(envPath, databases, appKey) {
  const envVars = await readEnvFile(envPath);

  // Process each database
  if (databases && databases.length > 0) {
    const { passwords, passwordsArray } = processMultipleDatabases(databases, envVars, appKey);
    return {
      map: passwords,
      array: passwordsArray
    };
  }

  const { passwords, passwordsArray } = processSingleDatabase(envVars, appKey);
  return {
    map: passwords,
    array: passwordsArray
  };
}

/**
 * Generates Docker Compose configuration from template
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {Object} options - Run options
 * @returns {Promise<string>} Generated compose content
 */
/**
 * Gets developer ID and calculates numeric ID
 * @async
 * @function getDeveloperIdAndNumeric
 * @returns {Promise<Object>} Object with devId and idNum
 */
async function getDeveloperIdAndNumeric() {
  const devId = await config.getDeveloperId();
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  return { devId, idNum };
}

/**
 * Builds network and container names
 * @function buildNetworkAndContainerNames
 * @param {string} appName - Application name
 * @param {string|number} devId - Developer ID
 * @param {number} idNum - Numeric developer ID
 * @returns {Object} Object with networkName and containerName
 */
function buildNetworkAndContainerNames(appName, devId, idNum) {
  const networkName = idNum === 0 ? 'infra-aifabrix-network' : `infra-dev${devId}-aifabrix-network`;
  const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${devId}-${appName}`;
  return { networkName, containerName };
}

/**
 * Reads database passwords if needed
 * @async
 * @function readDatabasePasswordsIfNeeded
 * @param {boolean} requiresDatabase - Whether database is required
 * @param {Array} databases - Array of databases
 * @param {string} envFilePath - Environment file path
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Database passwords object
 */
async function readDatabasePasswordsIfNeeded(requiresDatabase, databases, envFilePath, appName) {
  if (requiresDatabase || databases.length > 0) {
    return await readDatabasePasswords(envFilePath, databases, appName);
  }
  return { map: {}, array: [] };
}

async function generateDockerCompose(appName, appConfig, options) {
  const language = appConfig.build?.language || appConfig.language || 'typescript';
  const template = loadDockerComposeTemplate(language);
  const port = options.port || appConfig.port || 3000;

  const { devId, idNum } = await getDeveloperIdAndNumeric();
  const { networkName, containerName } = buildNetworkAndContainerNames(appName, devId, idNum);

  const serviceConfig = buildServiceConfig(appName, appConfig, port);
  const volumesConfig = buildVolumesConfig(appName);
  const networksConfig = buildNetworksConfig(appConfig);

  const devDir = buildCopy.getDevDirectory(appName, devId);
  const envFilePath = path.join(devDir, '.env');
  const envFileAbsolutePath = envFilePath.replace(/\\/g, '/');

  const databasePasswords = await readDatabasePasswordsIfNeeded(
    serviceConfig.requiresDatabase || false,
    networksConfig.databases || [],
    envFilePath,
    appName
  );

  const templateData = {
    ...serviceConfig,
    ...volumesConfig,
    ...networksConfig,
    envFile: envFileAbsolutePath,
    databasePasswords: databasePasswords,
    devId: idNum,
    networkName: networkName,
    containerName: containerName
  };

  return template(templateData);
}

module.exports = {
  generateDockerCompose,
  getImageName
};

