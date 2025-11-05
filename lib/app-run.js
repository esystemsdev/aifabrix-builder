/**
 * AI Fabrix Builder Application Run Management
 *
 * This module handles application running with Docker containers.
 * Includes Docker orchestration, health checking, and port management.
 *
 * @fileoverview Application run management for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const net = require('net');
const chalk = require('chalk');
const yaml = require('js-yaml');
const handlebars = require('handlebars');
const { exec } = require('child_process');
const { promisify } = require('util');
const validator = require('./validator');
const infra = require('./infra');
const secrets = require('./secrets');
const logger = require('./utils/logger');
const { waitForHealthCheck } = require('./utils/health-check');

const execAsync = promisify(exec);

/**
 * Checks if Docker image exists for the application
 * @param {string} imageName - Image name (can include repository prefix)
 * @param {string} tag - Image tag (default: latest)
 * @returns {Promise<boolean>} True if image exists
 */
async function checkImageExists(imageName, tag = 'latest') {
  try {
    const fullImageName = `${imageName}:${tag}`;
    // Use Docker's native filtering for cross-platform compatibility (Windows-safe)
    const { stdout } = await execAsync(`docker images --format "{{.Repository}}:{{.Tag}}" --filter "reference=${fullImageName}"`);
    const lines = stdout.trim().split('\n').filter(line => line.trim() !== '');
    return lines.some(line => line.trim() === fullImageName);
  } catch (error) {
    return false;
  }
}

/**
 * Checks if container is already running
 * @param {string} appName - Application name
 * @returns {Promise<boolean>} True if container is running
 */
async function checkContainerRunning(appName) {
  try {
    const { stdout } = await execAsync(`docker ps --filter "name=aifabrix-${appName}" --format "{{.Names}}"`);
    return stdout.trim() === `aifabrix-${appName}`;
  } catch (error) {
    return false;
  }
}

/**
 * Stops and removes existing container
 * @param {string} appName - Application name
 */
async function stopAndRemoveContainer(appName) {
  try {
    logger.log(chalk.yellow(`Stopping existing container aifabrix-${appName}...`));
    await execAsync(`docker stop aifabrix-${appName}`);
    await execAsync(`docker rm aifabrix-${appName}`);
    logger.log(chalk.green(`✓ Container aifabrix-${appName} stopped and removed`));
  } catch (error) {
    // Container might not exist, which is fine
    logger.log(chalk.gray(`Container aifabrix-${appName} was not running`));
  }
}

/**
 * Checks if port is available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if port is available
 */
async function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
}

/**
 * Loads and compiles Docker Compose template
 * @param {string} language - Language type
 * @returns {Function} Compiled Handlebars template
 * @throws {Error} If template not found
 */
function loadDockerComposeTemplate(language) {
  const templatePath = path.join(__dirname, '..', 'templates', language, 'docker-compose.hbs');
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
  const containerPort = config.build?.containerPort || config.port || 3000;

  return {
    app: buildAppConfig(appName, config),
    image: buildImageConfig(config, appName),
    port: containerPort,
    build: {
      localPort: port
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

  const port = options.port || config.build?.localPort || config.port || 3000;

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

/**
 * Validates app name and loads configuration
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Application configuration
 * @throws {Error} If validation fails
 */
async function validateAppConfiguration(appName) {
  // Validate app name
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required');
  }

  // Load and validate app configuration
  const configPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
  if (!fsSync.existsSync(configPath)) {
    throw new Error(`Application configuration not found: ${configPath}\nRun 'aifabrix create ${appName}' first`);
  }

  const configContent = fsSync.readFileSync(configPath, 'utf8');
  const config = yaml.load(configContent);

  // Validate configuration
  const validation = await validator.validateApplication(appName);
  if (!validation.valid) {
    throw new Error(`Configuration validation failed:\n${validation.variables.errors.join('\n')}`);
  }

  return config;
}

/**
 * Checks prerequisites: Docker image and infrastructure
 * @async
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @throws {Error} If prerequisites are not met
 */
async function checkPrerequisites(appName, config) {
  // Extract image name from configuration (same logic as build process)
  const imageName = getImageName(config, appName);
  const imageTag = config.image?.tag || 'latest';
  const fullImageName = `${imageName}:${imageTag}`;

  // Check if Docker image exists
  logger.log(chalk.blue(`Checking if image ${fullImageName} exists...`));
  const imageExists = await checkImageExists(imageName, imageTag);
  if (!imageExists) {
    throw new Error(`Docker image ${fullImageName} not found\nRun 'aifabrix build ${appName}' first`);
  }
  logger.log(chalk.green(`✓ Image ${fullImageName} found`));

  // Check infrastructure health
  logger.log(chalk.blue('Checking infrastructure health...'));
  const infraHealth = await infra.checkInfraHealth();
  const unhealthyServices = Object.entries(infraHealth)
    .filter(([_, status]) => status !== 'healthy')
    .map(([service, _]) => service);

  if (unhealthyServices.length > 0) {
    throw new Error(`Infrastructure services not healthy: ${unhealthyServices.join(', ')}\nRun 'aifabrix up' first`);
  }
  logger.log(chalk.green('✓ Infrastructure is running'));
}

/**
 * Prepares environment: ensures .env file and generates Docker Compose
 * @async
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} options - Run options
 * @returns {Promise<string>} Path to generated compose file
 */
async function prepareEnvironment(appName, config, options) {
  // Ensure .env file exists with 'docker' environment context (for running in Docker)
  const envPath = path.join(process.cwd(), 'builder', appName, '.env');
  if (!fsSync.existsSync(envPath)) {
    logger.log(chalk.yellow('Generating .env file from template...'));
    await secrets.generateEnvFile(appName, null, 'docker');
  } else {
    // Re-generate with 'docker' context to ensure correct hostnames for Docker
    logger.log(chalk.blue('Updating .env file for Docker environment...'));
    await secrets.generateEnvFile(appName, null, 'docker');
  }

  // Also ensure .env file in apps/ directory is updated (for Docker build context)
  const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
  if (fsSync.existsSync(variablesPath)) {
    const variablesContent = fsSync.readFileSync(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    if (variables?.build?.envOutputPath && variables.build.envOutputPath !== null) {
      // The generateEnvFile already copies to apps/, but ensure it's using docker context
      logger.log(chalk.blue('Ensuring .env file in apps/ directory is updated for Docker...'));
      await secrets.generateEnvFile(appName, null, 'docker');
    }
  }

  // Generate Docker Compose configuration
  logger.log(chalk.blue('Generating Docker Compose configuration...'));
  const composeContent = await generateDockerCompose(appName, config, options);
  // Write compose file to temporary location
  const tempComposePath = path.join(process.cwd(), 'builder', appName, 'docker-compose.yaml');
  await fs.writeFile(tempComposePath, composeContent);

  return tempComposePath;
}

/**
 * Starts the container and waits for health check
 * @async
 * @param {string} appName - Application name
 * @param {string} composePath - Path to Docker Compose file
 * @param {number} port - Application port
 * @throws {Error} If container fails to start or become healthy
 */
async function startContainer(appName, composePath, port, config = null) {
  logger.log(chalk.blue(`Starting ${appName}...`));

  // Ensure ADMIN_SECRETS_PATH is set for db-init service
  const adminSecretsPath = await infra.ensureAdminSecrets();

  // Load POSTGRES_PASSWORD from admin-secrets.env
  const adminSecretsContent = fsSync.readFileSync(adminSecretsPath, 'utf8');
  const postgresPasswordMatch = adminSecretsContent.match(/^POSTGRES_PASSWORD=(.+)$/m);
  const postgresPassword = postgresPasswordMatch ? postgresPasswordMatch[1] : '';

  // Set environment variables for docker-compose
  const env = {
    ...process.env,
    ADMIN_SECRETS_PATH: adminSecretsPath,
    POSTGRES_PASSWORD: postgresPassword
  };

  await execAsync(`docker-compose -f "${composePath}" up -d`, { env });
  logger.log(chalk.green(`✓ Container aifabrix-${appName} started`));

  // Wait for health check
  const healthCheckPath = config?.healthCheck?.path || '/health';
  const healthCheckUrl = `http://localhost:${port}${healthCheckPath}`;
  logger.log(chalk.blue(`Waiting for application to be healthy at ${healthCheckUrl}...`));
  await waitForHealthCheck(appName, 90, port, config);
}

/**
 * Displays run status after successful start
 * @param {string} appName - Application name
 * @param {number} port - Application port
 * @param {Object} config - Application configuration
 */
function displayRunStatus(appName, port, config) {
  const healthCheckPath = config?.healthCheck?.path || '/health';
  const healthCheckUrl = `http://localhost:${port}${healthCheckPath}`;

  logger.log(chalk.green(`\n✓ App running at http://localhost:${port}`));
  logger.log(chalk.blue(`Health check: ${healthCheckUrl}`));
  logger.log(chalk.gray(`Container: aifabrix-${appName}`));
}

/**
 * Waits for container health check to pass
 * @param {string} appName - Application name
 * @param {number} timeout - Timeout in seconds
 * @param {number} port - Application port (optional, will be detected if not provided)
 * @param {Object} config - Application configuration (optional)
 */

/**
 * Runs the application locally using Docker
 * Starts container with proper port mapping and environment
 *
 * @async
 * @function runApp
 * @param {string} appName - Name of the application to run
 * @param {Object} options - Run options
 * @param {number} [options.port] - Override local port
 * @returns {Promise<void>} Resolves when app is running
 * @throws {Error} If run fails or app is not built
 *
 * @example
 * await runApp('myapp', { port: 3001 });
 * // Application is now running on localhost:3001
 */
async function runApp(appName, options = {}) {
  try {
    // Validate app name and load configuration
    const config = await validateAppConfiguration(appName);

    // Check prerequisites: image and infrastructure
    await checkPrerequisites(appName, config);

    // Check if container is already running
    const containerRunning = await checkContainerRunning(appName);
    if (containerRunning) {
      logger.log(chalk.yellow(`Container aifabrix-${appName} is already running`));
      await stopAndRemoveContainer(appName);
    }

    // Check port availability
    const port = options.port || config.build?.localPort || config.port || 3000;
    const portAvailable = await checkPortAvailable(port);
    if (!portAvailable) {
      throw new Error(`Port ${port} is already in use. Try --port <alternative>`);
    }

    // Prepare environment: ensure .env file and generate Docker Compose
    const tempComposePath = await prepareEnvironment(appName, config, options);

    try {
      // Start container and wait for health check
      await startContainer(appName, tempComposePath, port, config);

      // Display success message
      displayRunStatus(appName, port, config);

    } catch (error) {
      // Keep the compose file for debugging - don't delete on error
      logger.log(chalk.yellow(`\n⚠️  Compose file preserved at: ${tempComposePath}`));
      logger.log(chalk.yellow('   Review the file to debug issues'));
      throw error;
    }

  } catch (error) {
    throw new Error(`Failed to run application: ${error.message}`);
  }
}

module.exports = {
  runApp,
  checkImageExists,
  checkContainerRunning,
  stopAndRemoveContainer,
  checkPortAvailable,
  generateDockerCompose,
  waitForHealthCheck
};
