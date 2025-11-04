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

const execAsync = promisify(exec);

/**
 * Checks if Docker image exists for the application
 * @param {string} appName - Application name
 * @returns {Promise<boolean>} True if image exists
 */
async function checkImageExists(appName) {
  try {
    // Use Docker's native filtering for cross-platform compatibility (Windows-safe)
    const { stdout } = await execAsync(`docker images --format "{{.Repository}}:{{.Tag}}" --filter "reference=${appName}:latest"`);
    const lines = stdout.trim().split('\n').filter(line => line.trim() !== '');
    return lines.some(line => line.trim() === `${appName}:latest`);
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
 * Builds service configuration for template data
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {number} port - Application port
 * @returns {Object} Service configuration
 */
function buildServiceConfig(appName, config, port) {
  return {
    app: {
      key: appName,
      name: config.displayName || appName
    },
    image: {
      name: appName,
      tag: 'latest'
    },
    port: config.port || 3000,
    build: {
      localPort: port
    },
    healthCheck: {
      path: config.healthCheck?.path || '/health',
      interval: config.healthCheck?.interval || 30
    },
    requiresDatabase: config.requires?.database || config.services?.database || false,
    requiresStorage: config.requires?.storage || config.services?.storage || false,
    requiresRedis: config.requires?.redis || config.services?.redis || false
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
 * @throws {Error} If prerequisites are not met
 */
async function checkPrerequisites(appName) {
  // Check if Docker image exists
  logger.log(chalk.blue(`Checking if image ${appName}:latest exists...`));
  const imageExists = await checkImageExists(appName);
  if (!imageExists) {
    throw new Error(`Docker image ${appName}:latest not found\nRun 'aifabrix build ${appName}' first`);
  }
  logger.log(chalk.green(`✓ Image ${appName}:latest found`));

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
async function startContainer(appName, composePath, port) {
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
  logger.log(chalk.blue('Waiting for application to be healthy...'));
  await waitForHealthCheck(appName, 90, port);
}

/**
 * Displays run status after successful start
 * @param {string} appName - Application name
 * @param {number} port - Application port
 */
function displayRunStatus(appName, port) {
  logger.log(chalk.green(`\n✓ App running at http://localhost:${port}`));
  logger.log(chalk.gray(`Container: aifabrix-${appName}`));
  logger.log(chalk.gray('Health check: /health'));
}

/**
 * Waits for container health check to pass
 * @param {string} appName - Application name
 * @param {number} timeout - Timeout in seconds
 * @param {number} port - Application port (optional, will be detected if not provided)
 */
async function waitForHealthCheck(appName, timeout = 90, port = null) {
  // Check if db-init exists and wait for it to complete (though docker-compose should already handle this)
  const dbInitContainer = `aifabrix-${appName}-db-init`;
  try {
    const { stdout } = await execAsync(`docker ps -a --filter "name=${dbInitContainer}" --format "{{.Names}}"`);
    if (stdout.trim() === dbInitContainer) {
      // Check if db-init is already completed
      const { stdout: status } = await execAsync(`docker inspect --format='{{.State.Status}}' ${dbInitContainer}`);
      if (status.trim() === 'exited') {
        const { stdout: exitCode } = await execAsync(`docker inspect --format='{{.State.ExitCode}}' ${dbInitContainer}`);
        if (exitCode.trim() === '0') {
          logger.log(chalk.green('✓ Database initialization already completed'));
        } else {
          logger.log(chalk.yellow(`⚠ Database initialization exited with code ${exitCode.trim()}`));
        }
      } else {
        // db-init is still running, wait for it
        logger.log(chalk.blue('Waiting for database initialization to complete...'));
        let dbInitAttempts = 0;
        const maxDbInitAttempts = 30; // 30 seconds max for db-init
        while (dbInitAttempts < maxDbInitAttempts) {
          const { stdout: currentStatus } = await execAsync(`docker inspect --format='{{.State.Status}}' ${dbInitContainer}`);
          if (currentStatus.trim() === 'exited') {
            const { stdout: exitCode } = await execAsync(`docker inspect --format='{{.State.ExitCode}}' ${dbInitContainer}`);
            if (exitCode.trim() === '0') {
              logger.log(chalk.green('✓ Database initialization completed'));
              break;
            } else {
              logger.log(chalk.yellow(`⚠ Database initialization exited with code ${exitCode.trim()}`));
              break;
            }
          }
          dbInitAttempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (error) {
    // db-init container might not exist, which is fine
  }

  // Get the port from the container if not provided
  if (!port) {
    try {
      const { stdout: portMapping } = await execAsync(`docker inspect --format='{{range .NetworkSettings.Ports}}{{range .}}{{.HostPort}}{{end}}{{end}}' aifabrix-${appName}`);
      const ports = portMapping.trim().split('\n').filter(p => p);
      if (ports.length > 0) {
        port = parseInt(ports[0], 10);
      } else {
        port = 3000; // Default fallback
      }
    } catch (error) {
      port = 3000; // Default fallback
    }
  }

  // Wait for the HTTP health endpoint to respond
  const maxAttempts = timeout / 2; // Check every 2 seconds
  let attempts = 0;
  const http = require('http');

  while (attempts < maxAttempts) {
    try {
      // Try HTTP health check directly
      const healthCheckPassed = await new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, { timeout: 5000 }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const health = JSON.parse(data);
              // Check if health is ok and database is connected (if database is required)
              if (health.status === 'ok') {
                if (health.database === 'connected' || !health.database) {
                  resolve(true);
                } else {
                  resolve(false);
                }
              } else {
                resolve(false);
              }
            } catch (error) {
              resolve(false);
            }
          });
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });

      if (healthCheckPassed) {
        logger.log(chalk.green('✓ Application is healthy'));
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        logger.log(chalk.yellow(`Waiting for health check... (${attempts}/${maxAttempts})`));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  throw new Error(`Health check timeout after ${timeout} seconds`);
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
    await checkPrerequisites(appName);

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
      await startContainer(appName, tempComposePath, port);

      // Display success message
      displayRunStatus(appName, port);

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
