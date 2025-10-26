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

const execAsync = promisify(exec);

/**
 * Checks if Docker image exists for the application
 * @param {string} appName - Application name
 * @returns {Promise<boolean>} True if image exists
 */
async function checkImageExists(appName) {
  try {
    const { stdout } = await execAsync(`docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${appName}:latest$"`);
    return stdout.trim() === `${appName}:latest`;
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
    console.log(chalk.yellow(`Stopping existing container aifabrix-${appName}...`));
    await execAsync(`docker stop aifabrix-${appName}`);
    await execAsync(`docker rm aifabrix-${appName}`);
    console.log(chalk.green(`✓ Container aifabrix-${appName} stopped and removed`));
  } catch (error) {
    // Container might not exist, which is fine
    console.log(chalk.gray(`Container aifabrix-${appName} was not running`));
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
 * Generates Docker Compose configuration from template
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} options - Run options
 * @returns {Promise<string>} Generated compose content
 */
async function generateDockerCompose(appName, config, options) {
  const language = config.build?.language || config.language || 'typescript';
  const templatePath = path.join(__dirname, '..', 'templates', language, 'docker-compose.hbs');
  if (!fsSync.existsSync(templatePath)) {
    throw new Error(`Docker Compose template not found for language: ${language}`);
  }

  const templateContent = fsSync.readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(templateContent);

  const port = options.port || config.build?.localPort || config.port || 3000;

  const templateData = {
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
    requiresDatabase: config.services?.database || false,
    requiresStorage: config.services?.storage || false,
    requiresRedis: config.services?.redis || false,
    mountVolume: path.join(process.cwd(), 'data', appName),
    databases: config.databases || []
  };

  return template(templateData);
}

/**
 * Waits for container health check to pass
 * @param {string} appName - Application name
 * @param {number} timeout - Timeout in seconds
 */
async function waitForHealthCheck(appName, timeout = 60) {
  const maxAttempts = timeout / 2; // Check every 2 seconds
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const { stdout } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' aifabrix-${appName}`);
      const status = stdout.trim();

      if (status === 'healthy') {
        return;
      } else if (status === 'unhealthy') {
        throw new Error(`Container aifabrix-${appName} is unhealthy`);
      }

      attempts++;
      if (attempts < maxAttempts) {
        console.log(chalk.yellow(`Waiting for health check... (${attempts}/${maxAttempts})`));
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

    // Check if Docker image exists
    console.log(chalk.blue(`Checking if image ${appName}:latest exists...`));
    const imageExists = await checkImageExists(appName);
    if (!imageExists) {
      throw new Error(`Docker image ${appName}:latest not found\nRun 'aifabrix build ${appName}' first`);
    }
    console.log(chalk.green(`✓ Image ${appName}:latest found`));

    // Check infrastructure health
    console.log(chalk.blue('Checking infrastructure health...'));
    const infraHealth = await infra.checkInfraHealth();
    const unhealthyServices = Object.entries(infraHealth)
      .filter(([_, status]) => status !== 'healthy')
      .map(([service, _]) => service);

    if (unhealthyServices.length > 0) {
      throw new Error(`Infrastructure services not healthy: ${unhealthyServices.join(', ')}\nRun 'aifabrix up' first`);
    }
    console.log(chalk.green('✓ Infrastructure is running'));

    // Check if container is already running
    const containerRunning = await checkContainerRunning(appName);
    if (containerRunning) {
      console.log(chalk.yellow(`Container aifabrix-${appName} is already running`));
      await stopAndRemoveContainer(appName);
    }

    // Check port availability
    const port = options.port || config.build?.localPort || config.port || 3000;
    const portAvailable = await checkPortAvailable(port);
    if (!portAvailable) {
      throw new Error(`Port ${port} is already in use. Try --port <alternative>`);
    }

    // Ensure .env file exists
    const envPath = path.join(process.cwd(), 'builder', appName, '.env');
    if (!fsSync.existsSync(envPath)) {
      console.log(chalk.yellow('Generating .env file from template...'));
      await secrets.generateEnvFile(appName);
    }

    // Generate Docker Compose configuration
    console.log(chalk.blue('Generating Docker Compose configuration...'));
    const composeContent = await generateDockerCompose(appName, config, options);
    // Write compose file to temporary location
    const tempComposePath = path.join(process.cwd(), 'builder', appName, 'docker-compose.yaml');
    await fs.writeFile(tempComposePath, composeContent);

    try {
      // Start container
      console.log(chalk.blue(`Starting ${appName}...`));
      await execAsync(`docker-compose -f "${tempComposePath}" up -d`);
      console.log(chalk.green(`✓ Container aifabrix-${appName} started`));

      // Wait for health check
      console.log(chalk.blue('Waiting for application to be healthy...'));
      await waitForHealthCheck(appName);

      // Display success message
      console.log(chalk.green(`\n✓ App running at http://localhost:${port}`));
      console.log(chalk.gray(`Container: aifabrix-${appName}`));
      console.log(chalk.gray('Health check: /health'));

    } finally {
      // Clean up temporary compose file
      try {
        await fs.unlink(tempComposePath);
      } catch (error) {
        // Ignore cleanup errors
      }
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
