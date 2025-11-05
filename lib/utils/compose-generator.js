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
const path = require('path');
const handlebars = require('handlebars');

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
  return {
    requiresDatabase: config.requires?.database || config.services?.database || false,
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

  // Host port logic:
  // - If containerPort is specified: use options.port or build.localPort
  // - If containerPort is NOT specified: use options.port if provided, otherwise config.port (same as container port)
  const hostPort = config.build?.containerPort
    ? (port || config.build?.localPort || config.port || 3000)  // If containerPort exists, use options.port or localPort
    : (port !== config.port ? port : config.port || port);  // If no containerPort, use options.port if different, else config.port

  return {
    app: buildAppConfig(appName, config),
    image: buildImageConfig(config, appName),
    port: containerPortValue, // Container port (for health check and template)
    containerPort: config.build?.containerPort || null, // Explicit containerPort if specified, null otherwise
    build: {
      localPort: hostPort // Host port
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
 * Generates Docker Compose configuration from template
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} options - Run options
 * @returns {Promise<string>} Generated compose content
 */
async function generateDockerCompose(appName, config, options) {
  const language = config.build?.language || config.language || 'typescript';
  const template = loadDockerComposeTemplate(language);

  // Determine port: use options.port if provided, otherwise use config.port (ignore build.localPort when no containerPort)
  const port = options.port || (config.build?.containerPort ? config.build?.localPort : null) || config.port || 3000;

  const serviceConfig = buildServiceConfig(appName, config, port);
  const volumesConfig = buildVolumesConfig(appName);
  const networksConfig = buildNetworksConfig(config);

  // Get absolute path to .env file for docker-compose
  const envFilePath = path.join(process.cwd(), 'builder', appName, '.env');
  const envFileAbsolutePath = envFilePath.replace(/\\/g, '/'); // Use forward slashes for Docker

  const templateData = {
    ...serviceConfig,
    ...volumesConfig,
    ...networksConfig,
    envFile: envFileAbsolutePath
  };

  return template(templateData);
}

module.exports = {
  generateDockerCompose,
  getImageName
};

