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
const chalk = require('chalk');
const yaml = require('js-yaml');
const { exec } = require('child_process');
const { promisify } = require('util');
const validator = require('./validator');
const infra = require('./infra');
const secrets = require('./secrets');
const config = require('./config');
const buildCopy = require('./utils/build-copy');
const logger = require('./utils/logger');
const { waitForHealthCheck, checkPortAvailable } = require('./utils/health-check');
const composeGenerator = require('./utils/compose-generator');

const execAsync = promisify(exec);

/**
 * Checks if Docker image exists for the application
 * @param {string} imageName - Image name (can include repository prefix)
 * @param {string} tag - Image tag (default: latest)
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<boolean>} True if image exists
 */
async function checkImageExists(imageName, tag = 'latest', debug = false) {
  try {
    const fullImageName = `${imageName}:${tag}`;
    const cmd = `docker images --format "{{.Repository}}:{{.Tag}}" --filter "reference=${fullImageName}"`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${cmd}`));
    }
    // Use Docker's native filtering for cross-platform compatibility (Windows-safe)
    const { stdout } = await execAsync(cmd);
    const lines = stdout.trim().split('\n').filter(line => line.trim() !== '');
    const exists = lines.some(line => line.trim() === fullImageName);
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Image ${fullImageName} exists: ${exists}`));
    }
    return exists;
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Image check failed: ${error.message}`));
    }
    return false;
  }
}

/**
 * Checks if container is already running
 * @param {string} appName - Application name
 * @param {number} developerId - Developer ID (0 = default infra, > 0 = developer-specific)
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<boolean>} True if container is running
 */
async function checkContainerRunning(appName, developerId, debug = false) {
  try {
    // Dev 0: aifabrix-{appName} (no dev-0 suffix), Dev > 0: aifabrix-dev{id}-{appName}
    const containerName = developerId === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
    const cmd = `docker ps --filter "name=${containerName}" --format "{{.Names}}"`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${cmd}`));
    }
    const { stdout } = await execAsync(cmd);
    const isRunning = stdout.trim() === containerName;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Container ${containerName} running: ${isRunning}`));
      if (isRunning) {
        // Get container status details
        const statusCmd = `docker ps --filter "name=${containerName}" --format "{{.Status}}"`;
        const { stdout: status } = await execAsync(statusCmd);
        const portsCmd = `docker ps --filter "name=${containerName}" --format "{{.Ports}}"`;
        const { stdout: ports } = await execAsync(portsCmd);
        logger.log(chalk.gray(`[DEBUG] Container status: ${status.trim()}`));
        logger.log(chalk.gray(`[DEBUG] Container ports: ${ports.trim()}`));
      }
    }
    return isRunning;
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Container check failed: ${error.message}`));
    }
    return false;
  }
}

/**
 * Stops and removes existing container
 * @param {string} appName - Application name
 * @param {number} developerId - Developer ID (0 = default infra, > 0 = developer-specific)
 * @param {boolean} [debug=false] - Enable debug logging
 */
async function stopAndRemoveContainer(appName, developerId, debug = false) {
  try {
    // Dev 0: aifabrix-{appName} (no dev-0 suffix), Dev > 0: aifabrix-dev{id}-{appName}
    const containerName = developerId === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
    logger.log(chalk.yellow(`Stopping existing container ${containerName}...`));
    const stopCmd = `docker stop ${containerName}`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${stopCmd}`));
    }
    await execAsync(stopCmd);
    const rmCmd = `docker rm ${containerName}`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${rmCmd}`));
    }
    await execAsync(rmCmd);
    logger.log(chalk.green(`✓ Container ${containerName} stopped and removed`));
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Stop/remove container error: ${error.message}`));
    }
    // Container might not exist, which is fine
    // Dev 0: aifabrix-{appName} (no dev-0 suffix), Dev > 0: aifabrix-dev{id}-{appName}
    const containerName = developerId === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
    logger.log(chalk.gray(`Container ${containerName} was not running`));
  }
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

  // Check if we're running from inside the builder directory
  const currentDir = process.cwd();
  const normalizedPath = currentDir.replace(/\\/g, '/');
  const expectedBuilderPath = `builder/${appName}`;

  // If inside builder/{appName}, suggest moving to project root
  if (normalizedPath.endsWith(expectedBuilderPath)) {
    const projectRoot = path.resolve(currentDir, '../..');
    throw new Error(
      'You\'re running from inside the builder directory.\n' +
      `Current directory: ${currentDir}\n` +
      'Please change to the project root and try again:\n' +
      `  cd ${projectRoot}\n` +
      `  aifabrix run ${appName}`
    );
  }

  // Load and validate app configuration
  const configPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
  if (!fsSync.existsSync(configPath)) {
    const expectedDir = path.join(currentDir, 'builder', appName);
    throw new Error(
      `Application configuration not found: ${configPath}\n` +
      `Current directory: ${currentDir}\n` +
      `Expected location: ${expectedDir}\n` +
      'Make sure you\'re running from the project root (where \'builder\' directory exists)\n' +
      `Run 'aifabrix create ${appName}' first if configuration doesn't exist`
    );
  }

  const configContent = fsSync.readFileSync(configPath, 'utf8');
  const config = yaml.load(configContent);

  // Validate configuration
  const validation = await validator.validateApplication(appName);
  if (!validation.valid) {
    const allErrors = [];

    if (validation.variables && validation.variables.errors && validation.variables.errors.length > 0) {
      allErrors.push('variables.yaml:');
      allErrors.push(...validation.variables.errors.map(err => `  ${err}`));
    }

    if (validation.rbac && validation.rbac.errors && validation.rbac.errors.length > 0) {
      allErrors.push('rbac.yaml:');
      allErrors.push(...validation.rbac.errors.map(err => `  ${err}`));
    }

    if (validation.env && validation.env.errors && validation.env.errors.length > 0) {
      allErrors.push('env.template:');
      allErrors.push(...validation.env.errors.map(err => `  ${err}`));
    }

    if (allErrors.length === 0) {
      throw new Error('Configuration validation failed');
    }

    throw new Error(`Configuration validation failed:\n${allErrors.join('\n')}`);
  }

  return config;
}

/**
 * Checks prerequisites: Docker image and infrastructure
 * @async
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {boolean} [debug=false] - Enable debug logging
 * @throws {Error} If prerequisites are not met
 */
async function checkPrerequisites(appName, config, debug = false) {
  // Extract image name from configuration (same logic as build process)
  const imageName = composeGenerator.getImageName(config, appName);
  const imageTag = config.image?.tag || 'latest';
  const fullImageName = `${imageName}:${imageTag}`;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Image name: ${imageName}, tag: ${imageTag}`));
  }

  // Check if Docker image exists
  logger.log(chalk.blue(`Checking if image ${fullImageName} exists...`));
  const imageExists = await checkImageExists(imageName, imageTag, debug);
  if (!imageExists) {
    throw new Error(`Docker image ${fullImageName} not found\nRun 'aifabrix build ${appName}' first`);
  }
  logger.log(chalk.green(`✓ Image ${fullImageName} found`));

  // Check infrastructure health
  logger.log(chalk.blue('Checking infrastructure health...'));
  const infraHealth = await infra.checkInfraHealth();
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Infrastructure health: ${JSON.stringify(infraHealth, null, 2)}`));
  }
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
 * @param {Object} appConfig - Application configuration
 * @param {Object} options - Run options
 * @returns {Promise<string>} Path to generated compose file
 */
async function prepareEnvironment(appName, appConfig, options) {
  // Get developer ID and dev-specific directory
  const developerId = await config.getDeveloperId();
  const devDir = buildCopy.getDevDirectory(appName, developerId);

  // Ensure dev directory exists (should exist from build, but check anyway)
  if (!fsSync.existsSync(devDir)) {
    await buildCopy.copyBuilderToDevDirectory(appName, developerId);
  }

  // Ensure .env file exists with 'docker' environment context (for running in Docker)
  // Generate in builder directory first, then copy to dev directory
  const builderEnvPath = path.join(process.cwd(), 'builder', appName, '.env');
  if (!fsSync.existsSync(builderEnvPath)) {
    logger.log(chalk.yellow('Generating .env file from template...'));
    await secrets.generateEnvFile(appName, null, 'docker');
  } else {
    // Re-generate with 'docker' context to ensure correct hostnames for Docker
    logger.log(chalk.blue('Updating .env file for Docker environment...'));
    await secrets.generateEnvFile(appName, null, 'docker');
  }

  // Copy .env to dev directory
  const devEnvPath = path.join(devDir, '.env');
  if (fsSync.existsSync(builderEnvPath)) {
    await fs.copyFile(builderEnvPath, devEnvPath);
  }

  // Also ensure .env file in apps/ directory is updated (for Docker build context)
  const variablesPath = path.join(devDir, 'variables.yaml');
  if (fsSync.existsSync(variablesPath)) {
    const variablesContent = fsSync.readFileSync(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    if (variables?.build?.envOutputPath && variables.build.envOutputPath !== null) {
      // The generateEnvFile already copies to apps/, but ensure it's using docker context
      logger.log(chalk.blue('Ensuring .env file in apps/ directory is updated for Docker...'));
      await secrets.generateEnvFile(appName, null, 'docker');
      // Copy .env to dev directory again after regeneration
      if (fsSync.existsSync(builderEnvPath)) {
        await fs.copyFile(builderEnvPath, devEnvPath);
      }
    }
  }

  // Generate Docker Compose configuration
  logger.log(chalk.blue('Generating Docker Compose configuration...'));
  const composeOptions = { ...options };
  if (!composeOptions.port) {
    const basePort = appConfig.port || 3000;
    composeOptions.port = developerId === 0 ? basePort : basePort + (developerId * 100);
  }
  const composeContent = await composeGenerator.generateDockerCompose(appName, appConfig, composeOptions);

  // Write compose file to dev-specific directory (devDir already defined above)
  // Ensure dev directory exists (should exist from build, but check anyway)
  if (!fsSync.existsSync(devDir)) {
    await buildCopy.copyBuilderToDevDirectory(appName, developerId);
  }
  const tempComposePath = path.join(devDir, 'docker-compose.yaml');
  await fs.writeFile(tempComposePath, composeContent);

  return tempComposePath;
}

/**
 * Starts the container and waits for health check
 * @async
 * @param {string} appName - Application name
 * @param {string} composePath - Path to Docker Compose file
 * @param {number} port - Application port
 * @param {Object} config - Application configuration
 * @param {boolean} [debug=false] - Enable debug logging
 * @throws {Error} If container fails to start or become healthy
 */
async function startContainer(appName, composePath, port, config = null, debug = false) {
  logger.log(chalk.blue(`Starting ${appName}...`));

  // Ensure ADMIN_SECRETS_PATH is set for db-init service
  const adminSecretsPath = await infra.ensureAdminSecrets();
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Admin secrets path: ${adminSecretsPath}`));
  }

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

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Environment variables: ADMIN_SECRETS_PATH=${adminSecretsPath}, POSTGRES_PASSWORD=${postgresPassword ? '***' : '(not set)'}`));
  }

  const composeCmd = `docker-compose -f "${composePath}" up -d`;
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Executing: ${composeCmd}`));
    logger.log(chalk.gray(`[DEBUG] Compose file: ${composePath}`));
  }
  await execAsync(composeCmd, { env });
  // Dev 0: aifabrix-{appName} (no dev-0 suffix), Dev > 0: aifabrix-dev{id}-{appName}
  const containerName = config.developerId === 0 ? `aifabrix-${appName}` : `aifabrix-dev${config.developerId}-${appName}`;
  logger.log(chalk.green(`✓ Container ${containerName} started`));
  if (debug) {
    // Get container status after start
    const statusCmd = `docker ps --filter "name=${containerName}" --format "{{.Status}}"`;
    const { stdout: status } = await execAsync(statusCmd);
    const portsCmd = `docker ps --filter "name=${containerName}" --format "{{.Ports}}"`;
    const { stdout: ports } = await execAsync(portsCmd);
    logger.log(chalk.gray(`[DEBUG] Container status: ${status.trim()}`));
    logger.log(chalk.gray(`[DEBUG] Container ports: ${ports.trim()}`));
  }

  // Wait for health check using host port (CLI --port or dev-specific port, NOT localPort)
  const healthCheckPath = config?.healthCheck?.path || '/health';
  logger.log(chalk.blue(`Waiting for application to be healthy at http://localhost:${port}${healthCheckPath}...`));
  await waitForHealthCheck(appName, 90, port, config, debug);
}
/**
 * Displays run status after successful start
 * @param {string} appName - Application name
 * @param {number} port - Application port
 * @param {Object} config - Application configuration (with developerId property)
 */
async function displayRunStatus(appName, port, config) {
  // Dev 0: aifabrix-{appName} (no dev-0 suffix), Dev > 0: aifabrix-dev{id}-{appName}
  const containerName = config.developerId === 0 ? `aifabrix-${appName}` : `aifabrix-dev${config.developerId}-${appName}`;
  const healthCheckPath = config?.healthCheck?.path || '/health';
  const healthCheckUrl = `http://localhost:${port}${healthCheckPath}`;

  logger.log(chalk.green(`\n✓ App running at http://localhost:${port}`));
  logger.log(chalk.blue(`Health check: ${healthCheckUrl}`));
  logger.log(chalk.gray(`Container: ${containerName}`));
}

/**
 * Runs the application locally using Docker
 * Starts container with proper port mapping and environment
 *
 * @async
 * @function runApp
 * @param {string} appName - Name of the application to run
 * @param {Object} options - Run options
 * @param {number} [options.port] - Override local port
 * @param {boolean} [options.debug] - Enable debug output
 * @returns {Promise<void>} Resolves when app is running
 * @throws {Error} If run fails or app is not built
 *
 * @example
 * await runApp('myapp', { port: 3001 });
 * // Application is now running on localhost:3001
 */
async function runApp(appName, options = {}) {
  const debug = options.debug || false;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Starting run process for: ${appName}`));
    logger.log(chalk.gray(`[DEBUG] Options: ${JSON.stringify(options, null, 2)}`));
  }

  try {
    // Validate app name and load configuration
    const appConfig = await validateAppConfiguration(appName);

    // Load developer ID once from config module - it's now cached and available as config.developerId
    // Developer ID: 0 = default infra, > 0 = developer-specific
    const developerId = await config.getDeveloperId(); // Load and cache developer ID
    appConfig.developerId = developerId; // Use developer ID in config

    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Configuration loaded: port=${appConfig.port || 'default'}, healthCheck.path=${appConfig.healthCheck?.path || '/health'}, developerId=${appConfig.developerId}`));
    }

    // Check prerequisites: image and infrastructure
    await checkPrerequisites(appName, appConfig, debug);

    // Check if container is already running
    const containerRunning = await checkContainerRunning(appName, appConfig.developerId, debug);
    if (containerRunning) {
      // Dev 0: aifabrix-{appName} (no dev-0 suffix), Dev > 0: aifabrix-dev{id}-{appName}
      const containerName = appConfig.developerId === 0 ? `aifabrix-${appName}` : `aifabrix-dev${appConfig.developerId}-${appName}`;
      logger.log(chalk.yellow(`Container ${containerName} is already running`));
      await stopAndRemoveContainer(appName, appConfig.developerId, debug);
    }

    // Calculate host port: use dev-specific port offset if not overridden
    // IMPORTANT: Container port (for Dockerfile) stays unchanged from appConfig.port
    const basePort = appConfig.port || 3000;
    const hostPort = options.port || (appConfig.developerId === 0 ? basePort : basePort + (appConfig.developerId * 100));
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Host port: ${hostPort} (${options.port ? 'CLI override' : 'dev-specific'}), Container port: ${appConfig.build?.containerPort || appConfig.port || 3000} (unchanged)`));
    }
    const portAvailable = await checkPortAvailable(hostPort);
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Port ${hostPort} available: ${portAvailable}`));
    }
    if (!portAvailable) {
      throw new Error(`Port ${hostPort} is already in use. Try --port <alternative>`);
    }

    // Prepare environment: ensure .env file and generate Docker Compose
    const tempComposePath = await prepareEnvironment(appName, appConfig, options);
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Compose file generated: ${tempComposePath}`));
    }

    try {
      // Start container and wait for health check
      await startContainer(appName, tempComposePath, hostPort, appConfig, debug);

      // Display success message
      await displayRunStatus(appName, hostPort, appConfig);

    } catch (error) {
      // Keep the compose file for debugging - don't delete on error
      logger.log(chalk.yellow(`\n⚠️  Compose file preserved at: ${tempComposePath}`));
      logger.log(chalk.yellow('   Review the file to debug issues'));
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Error during container start: ${error.message}`));
      }
      throw error;
    }

  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Run failed: ${error.message}`));
    }
    throw new Error(`Failed to run application: ${error.message}`);
  }
}
module.exports = {
  runApp,
  checkImageExists,
  checkContainerRunning,
  stopAndRemoveContainer,
  checkPortAvailable,
  generateDockerCompose: composeGenerator.generateDockerCompose,
  waitForHealthCheck
};
