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
const { formatMissingDbPasswordError } = require('./error-formatter');
const { getContainerPort } = require('./port-resolver');
const { parseImageOverride } = require('./parse-image-ref');
const { registerComposeHelpers } = require('./compose-handlebars-helpers');
const { isVectorDatabaseName } = require('./compose-vector-helper');

registerComposeHelpers();

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
 * @param {string} [imageOverride] - Optional full image reference (registry/name:tag) to use instead of config
 * @returns {Object} Image configuration
 */
function buildImageConfig(config, appName, imageOverride) {
  const parsed = imageOverride ? parseImageOverride(imageOverride) : null;
  if (parsed) {
    return { name: parsed.name, tag: parsed.tag };
  }
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
 * Derives base path from routing pattern by removing trailing wildcards
 * @param {string} pattern - URL pattern (e.g., '/app/*', '/api/v1/*')
 * @returns {string} Base path for routing
 */
function derivePathFromPattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return '/';
  }
  const trimmed = pattern.trim();
  if (trimmed === '/' || trimmed === '') {
    return '/';
  }
  const withoutWildcards = trimmed.replace(/\*+$/g, '');
  const withoutTrailingSlashes = withoutWildcards.replace(/\/+$/g, '');
  return withoutTrailingSlashes || '/';
}

/**
 * Builds developer username from developer ID
 * @param {string|number} devId - Developer ID
 * @returns {string} Developer username (dev, dev01, dev02, ...)
 */
function buildDevUsername(devId) {
  if (devId === undefined || devId === null) {
    return 'dev';
  }
  const devIdString = String(devId);
  if (devIdString === '0') {
    return 'dev';
  }
  const paddedId = devIdString.length === 1 ? devIdString.padStart(2, '0') : devIdString;
  return `dev${paddedId}`;
}

/**
 * Builds Traefik ingress configuration from frontDoorRouting
 * Resolves ${DEV_USERNAME} variable interpolation in host field
 * @param {Object} config - Application configuration
 * @param {string|number} devId - Developer ID
 * @returns {Object} Traefik configuration object
 */
function buildTraefikConfig(config, devId) {
  const frontDoor = config.frontDoorRouting;
  if (!frontDoor || frontDoor.enabled !== true) {
    return { enabled: false };
  }

  if (!frontDoor.host || typeof frontDoor.host !== 'string') {
    throw new Error('frontDoorRouting.host is required when frontDoorRouting.enabled is true');
  }

  const devUsername = buildDevUsername(devId);
  const host = frontDoor.host.replace(/\$\{DEV_USERNAME\}/g, devUsername);
  const path = derivePathFromPattern(frontDoor.pattern);

  return {
    enabled: true,
    host,
    path,
    tls: frontDoor.tls !== false,
    certStore: frontDoor.certStore || null
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
 * @param {string|number} devId - Developer ID
 * @param {string} [imageOverride] - Optional full image reference for run (e.g. from --image)
 * @returns {Object} Service configuration
 */
function buildServiceConfig(appName, config, port, devId, imageOverride) {
  const containerPortValue = getContainerPort(config, 3000);
  const hostPort = port;
  return {
    app: buildAppConfig(appName, config),
    image: buildImageConfig(config, appName, imageOverride),
    port: containerPortValue, // Container port (for health check and template)
    containerPort: containerPortValue, // Container port (always set, equals containerPort if exists, else port)
    hostPort: hostPort, // Host port (options.port if provided, else config.port)
    healthCheck: buildHealthCheckConfig(config),
    traefik: buildTraefikConfig(config, devId),
    ...buildRequiresConfig(config)
  };
}

/**
 * Builds volumes configuration for template data
 * @param {string} appName - Application name
 * @returns {Object} Volumes configuration
 */
function buildVolumesConfig(appName) {
  return { mountVolume: path.join(process.cwd(), 'data', appName).replace(/\\/g, '/') };
}

/**
 * Builds networks configuration for template data
 * @param {Object} config - Application configuration
 * @returns {Object} Networks configuration
 */
function buildNetworksConfig(config) {
  return { databases: config.requires?.databases || config.databases || [] };
}

/** Reads and parses .env file. @param {string} envPath - Path to .env file. @returns {Promise<Object>} env vars. @throws {Error} If file not found. */
async function readEnvFile(envPath) {
  if (!fsSync.existsSync(envPath)) {
    throw new Error(`.env file not found: ${envPath}`);
  }

  try {
    const envContent = await fs.readFile(envPath, 'utf8');
    if (envContent === undefined || envContent === null) {
      throw new Error('Failed to read .env file: file content is empty or undefined');
    }
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
 * @param {Object} [context] - Optional: { appKey, multi } for clearer error messages
 * @returns {string} Password value
 * @throws {Error} If password is missing or empty
 */
function extractPassword(envVars, passwordKey, context = {}) {
  const { appKey, multi } = context;
  const appSuffix = appKey ? ` for application '${appKey}'` : '';

  if (!(passwordKey in envVars)) {
    throw new Error(multi && appKey ? formatMissingDbPasswordError(appKey, { multiDb: true, passwordKey }) : 'Missing required password variable ' + passwordKey + ' in .env file' + appSuffix + '. Add ' + passwordKey + '=your_secret to your .env file.');
  }

  const password = envVars[passwordKey].trim();
  if (!password || password.length === 0) {
    throw new Error('Password variable ' + passwordKey + ' is empty in .env file' + appSuffix + '. Set a non-empty value.');
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
    const password = extractPassword(envVars, passwordKey, { appKey, multi: true });
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
  const passwordKey = ('DB_0_PASSWORD' in envVars) ? 'DB_0_PASSWORD' : 'DB_PASSWORD';
  if (!(passwordKey in envVars)) {
    throw new Error(formatMissingDbPasswordError(appKey));
  }
  const password = extractPassword(envVars, passwordKey, { appKey });
  passwords[appKey] = password;
  passwordsArray.push(password);
  return { passwords, passwordsArray };
}

/**
 * Reads database passwords from .env file
 * @async
 * @function readDatabasePasswords
 * @param {string} envPath - Path to .env file
 * @param {Array<Object>} databases - Array of database configurations
 * @param {string} appKey - Application key (fallback for single database)
 * @returns {Promise<Object>} Object with passwords map and array
 * @throws {Error} If required password variables are missing
 */
async function readDatabasePasswords(envPath, databases, appKey) {
  const envVars = await readEnvFile(envPath);
  if (databases && databases.length > 0) {
    const { passwords, passwordsArray } = processMultipleDatabases(databases, envVars, appKey);
    return { map: passwords, array: passwordsArray };
  }
  const { passwords, passwordsArray } = processSingleDatabase(envVars, appKey);
  return { map: passwords, array: passwordsArray };
}

/**
 * Gets developer ID and calculates numeric ID
 * @async
 * @function getDeveloperIdAndNumeric
 * @returns {Promise<Object>} Object with devId and idNum
 */
async function getDeveloperIdAndNumeric() {
  const devId = await config.getDeveloperId();
  return { devId, idNum: typeof devId === 'string' ? parseInt(devId, 10) : devId };
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

/**
 * Resolves image override from options (--image, --tag, or null).
 * @param {Object} options - Run options
 * @param {Object} appConfig - Application configuration
 * @param {string} appName - Application name
 * @returns {string|null} Full image reference or null
 */
function resolveImageOverride(options, appConfig, appName) {
  if (options.image) return options.image;
  if (options.imageOverride) return options.imageOverride;
  if (options.tag) return `${getImageName(appConfig, appName)}:${options.tag}`;
  return null;
}

/**
 * Resolves Miso environment from options (tst, pro, or dev).
 * @param {Object} options - Run options
 * @returns {string} 'dev' | 'tst' | 'pro'
 */
function resolveMisoEnvironment(options) {
  const env = (options.env && typeof options.env === 'string') ? options.env.toLowerCase() : 'dev';
  return (env === 'tst' || env === 'pro') ? env : 'dev';
}

/**
 * Resolves dev mount path from options.
 * @param {Object} options - Run options
 * @returns {string|null} Trimmed path or null
 */
function resolveDevMountPath(options) {
  return (options.devMountPath && typeof options.devMountPath === 'string') ? options.devMountPath.trim() : null;
}

/**
 * Resolves env file path from options or default dev dir (forward slashes).
 * @param {Object} options - Run options
 * @param {string} devDir - Default dev directory
 * @returns {string} Absolute env file path
 */
function resolveEnvFilePath(options, devDir) {
  const envFilePath = (options.envFilePath && typeof options.envFilePath === 'string')
    ? path.resolve(options.envFilePath)
    : path.join(devDir, '.env');
  return envFilePath.replace(/\\/g, '/');
}

/**
 * Generates Docker Compose configuration from template
 * @async
 * @function generateDockerCompose
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {Object} options - Run options
 * @returns {Promise<string>} Generated compose content
 */
async function generateDockerCompose(appName, appConfig, options) {
  const language = appConfig.build?.language || appConfig.language || 'typescript';
  const template = loadDockerComposeTemplate(language);
  const port = options.port || appConfig.port || 3000;
  const imageOverride = resolveImageOverride(options, appConfig, appName);
  const { devId, idNum } = await getDeveloperIdAndNumeric();
  const { networkName, containerName } = buildNetworkAndContainerNames(appName, devId, idNum);
  const serviceConfig = buildServiceConfig(appName, appConfig, port, devId, imageOverride);
  const volumesConfig = buildVolumesConfig(appName);
  const networksConfig = buildNetworksConfig(appConfig);

  const devDir = buildCopy.getDevDirectory(appName, devId);
  const envFileAbsolutePath = resolveEnvFilePath(options, devDir);

  const databasePasswords = await readDatabasePasswordsIfNeeded(
    serviceConfig.requiresDatabase || false,
    networksConfig.databases || [],
    envFileAbsolutePath,
    appName
  );
  const templateData = {
    ...serviceConfig,
    ...volumesConfig,
    ...networksConfig,
    envFile: envFileAbsolutePath,
    databasePasswords,
    devId: idNum,
    networkName,
    containerName,
    misoEnvironment: resolveMisoEnvironment(options),
    devMountPath: resolveDevMountPath(options)
  };
  return template(templateData);
}
module.exports = { generateDockerCompose, getImageName, derivePathFromPattern, buildTraefikConfig, buildDevUsername, isVectorDatabaseName };
