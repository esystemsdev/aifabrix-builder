/**
 * AI Fabrix Builder - App Run Helpers
 *
 * Extracted helper functions to keep lib/app-run.js small and maintainable.
 * These helpers encapsulate image checks, validation, env prep, and container start logic.
 *
 * @fileoverview Helper functions for application run workflow
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
const { waitForHealthCheck } = require('./utils/health-check');
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
 * @param {number|string} developerId - Developer ID (0 = default infra, > 0 = developer-specific; string allowed)
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<boolean>} True if container is running
 */
async function checkContainerRunning(appName, developerId, debug = false) {
  try {
    const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
    const cmd = `docker ps --filter "name=${containerName}" --format "{{.Names}}"`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${cmd}`));
    }
    const { stdout } = await execAsync(cmd);
    const isRunning = stdout.trim() === containerName;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Container ${containerName} running: ${isRunning}`));
      if (isRunning) {
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
 * @param {number|string} developerId - Developer ID (0 = default infra, > 0 = developer-specific; string allowed)
 * @param {boolean} [debug=false] - Enable debug logging
 */
async function stopAndRemoveContainer(appName, developerId, debug = false) {
  try {
    const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
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
    const idNum2 = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    const containerName = idNum2 === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
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
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required');
  }

  const currentDir = process.cwd();
  const normalizedPath = currentDir.replace(/\\/g, '/');
  const expectedBuilderPath = `builder/${appName}`;

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
  const appConfig = yaml.load(configContent);

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

  return appConfig;
}

/**
 * Checks prerequisites: Docker image and infrastructure
 * @async
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {boolean} [debug=false] - Enable debug logging
 * @throws {Error} If prerequisites are not met
 */
async function checkPrerequisites(appName, appConfig, debug = false) {
  const imageName = composeGenerator.getImageName(appConfig, appName);
  const imageTag = appConfig.image?.tag || 'latest';
  const fullImageName = `${imageName}:${imageTag}`;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Image name: ${imageName}, tag: ${imageTag}`));
  }

  logger.log(chalk.blue(`Checking if image ${fullImageName} exists...`));
  const imageExists = await checkImageExists(imageName, imageTag, debug);
  if (!imageExists) {
    throw new Error(`Docker image ${fullImageName} not found\nRun 'aifabrix build ${appName}' first`);
  }
  logger.log(chalk.green(`✓ Image ${fullImageName} found`));

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
  const developerId = await config.getDeveloperId();
  const devDir = buildCopy.getDevDirectory(appName, developerId);

  if (!fsSync.existsSync(devDir)) {
    await buildCopy.copyBuilderToDevDirectory(appName, developerId);
  }

  const builderEnvPath = path.join(process.cwd(), 'builder', appName, '.env');
  if (!fsSync.existsSync(builderEnvPath)) {
    logger.log(chalk.yellow('Generating .env file from template...'));
    await secrets.generateEnvFile(appName, null, 'docker');
  } else {
    logger.log(chalk.blue('Updating .env file for Docker environment...'));
    await secrets.generateEnvFile(appName, null, 'docker');
  }

  const devEnvPath = path.join(devDir, '.env');
  if (fsSync.existsSync(builderEnvPath)) {
    await fs.copyFile(builderEnvPath, devEnvPath);
  }

  const variablesPath = path.join(devDir, 'variables.yaml');
  if (fsSync.existsSync(variablesPath)) {
    const variablesContent = fsSync.readFileSync(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    if (variables?.build?.envOutputPath && variables.build.envOutputPath !== null) {
      logger.log(chalk.blue('Ensuring .env file in apps/ directory is updated for Docker...'));
      await secrets.generateEnvFile(appName, null, 'docker');
      if (fsSync.existsSync(builderEnvPath)) {
        await fs.copyFile(builderEnvPath, devEnvPath);
      }
    }
  }

  logger.log(chalk.blue('Generating Docker Compose configuration...'));
  const composeOptions = { ...options };
  if (!composeOptions.port) {
    const basePort = appConfig.port || 3000;
    const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    composeOptions.port = idNum === 0 ? basePort : basePort + (idNum * 100);
  }
  const composeContent = await composeGenerator.generateDockerCompose(appName, appConfig, composeOptions);

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
 * @param {Object} appConfig - Application configuration
 * @param {boolean} [debug=false] - Enable debug logging
 * @throws {Error} If container fails to start or become healthy
 */
async function startContainer(appName, composePath, port, appConfig = null, debug = false) {
  logger.log(chalk.blue(`Starting ${appName}...`));

  const adminSecretsPath = await infra.ensureAdminSecrets();
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Admin secrets path: ${adminSecretsPath}`));
  }

  const adminSecretsContent = fsSync.readFileSync(adminSecretsPath, 'utf8');
  const postgresPasswordMatch = adminSecretsContent.match(/^POSTGRES_PASSWORD=(.+)$/m);
  const postgresPassword = postgresPasswordMatch ? postgresPasswordMatch[1] : '';

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

  const idNum = typeof appConfig.developerId === 'string' ? parseInt(appConfig.developerId, 10) : appConfig.developerId;
  const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${appConfig.developerId}-${appName}`;
  logger.log(chalk.green(`✓ Container ${containerName} started`));
  if (debug) {
    const statusCmd = `docker ps --filter "name=${containerName}" --format "{{.Status}}"`;
    const { stdout: status } = await execAsync(statusCmd);
    const portsCmd = `docker ps --filter "name=${containerName}" --format "{{.Ports}}"`;
    const { stdout: ports } = await execAsync(portsCmd);
    logger.log(chalk.gray(`[DEBUG] Container status: ${status.trim()}`));
    logger.log(chalk.gray(`[DEBUG] Container ports: ${ports.trim()}`));
  }

  const healthCheckPath = appConfig?.healthCheck?.path || '/health';
  logger.log(chalk.blue(`Waiting for application to be healthy at http://localhost:${port}${healthCheckPath}...`));
  await waitForHealthCheck(appName, 90, port, appConfig, debug);
}

/**
 * Displays run status after successful start
 * @param {string} appName - Application name
 * @param {number} port - Application port
 * @param {Object} appConfig - Application configuration (with developerId property)
 */
async function displayRunStatus(appName, port, appConfig) {
  const idNum = typeof appConfig.developerId === 'string' ? parseInt(appConfig.developerId, 10) : appConfig.developerId;
  const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${appConfig.developerId}-${appName}`;
  const healthCheckPath = appConfig?.healthCheck?.path || '/health';
  const healthCheckUrl = `http://localhost:${port}${healthCheckPath}`;

  logger.log(chalk.green(`\n✓ App running at http://localhost:${port}`));
  logger.log(chalk.blue(`Health check: ${healthCheckUrl}`));
  logger.log(chalk.gray(`Container: ${containerName}`));
}

module.exports = {
  checkImageExists,
  checkContainerRunning,
  stopAndRemoveContainer,
  validateAppConfiguration,
  checkPrerequisites,
  prepareEnvironment,
  startContainer,
  displayRunStatus
};

