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
const validator = require('../validation/validator');
const infra = require('../infrastructure');
const secrets = require('../core/secrets');
const config = require('../core/config');
const buildCopy = require('../utils/build-copy');
const logger = require('../utils/logger');
const { waitForHealthCheck } = require('../utils/health-check');
const composeGenerator = require('../utils/compose-generator');
const dockerUtils = require('../utils/docker');
const containerHelpers = require('../utils/app-run-containers');

const execAsync = promisify(exec);

// Re-export container helper functions
const checkImageExists = containerHelpers.checkImageExists;
const checkContainerRunning = containerHelpers.checkContainerRunning;
const stopAndRemoveContainer = containerHelpers.stopAndRemoveContainer;

/**
 * Check if running from builder directory
 * @param {string} appName - Application name
 * @throws {Error} If running from builder directory
 */
function checkBuilderDirectory(appName) {
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
}

/**
 * Load and validate config file exists
 * @param {string} appName - Application name
 * @returns {Object} Application configuration
 * @throws {Error} If config file not found
 */
function loadAppConfig(appName) {
  const currentDir = process.cwd();
  const configPath = path.join(currentDir, 'builder', appName, 'variables.yaml');
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
  return yaml.load(configContent);
}

/**
 * Format validation errors
 * @param {Object} validation - Validation result
 * @returns {Array<string>} Formatted error messages
 */
function formatValidationErrors(validation) {
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

  return allErrors;
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

  // Check if running from builder directory
  checkBuilderDirectory(appName);

  // Load config
  const appConfig = loadAppConfig(appName);

  // Validate configuration
  const validation = await validator.validateApplication(appName);
  if (!validation.valid) {
    const allErrors = formatValidationErrors(validation);
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
 * Ensure dev directory exists
 * @async
 * @param {string} appName - Application name
 * @param {string} developerId - Developer ID
 * @returns {Promise<string>} Dev directory path
 */
async function ensureDevDirectory(appName, developerId) {
  const devDir = buildCopy.getDevDirectory(appName, developerId);
  if (!fsSync.existsSync(devDir)) {
    await buildCopy.copyBuilderToDevDirectory(appName, developerId);
  }
  return devDir;
}

/**
 * Generate or update .env file for Docker
 * @async
 * @param {string} appName - Application name
 * @param {string} builderEnvPath - Path to builder .env file
 */
async function ensureEnvFile(appName, builderEnvPath) {
  if (!fsSync.existsSync(builderEnvPath)) {
    logger.log(chalk.yellow('Generating .env file from template...'));
    await secrets.generateEnvFile(appName, null, 'docker');
  } else {
    logger.log(chalk.blue('Updating .env file for Docker environment...'));
    await secrets.generateEnvFile(appName, null, 'docker');
  }
}

/**
 * Copy .env file to dev directory
 * @async
 * @param {string} builderEnvPath - Path to builder .env file
 * @param {string} devEnvPath - Path to dev .env file
 */
async function copyEnvToDev(builderEnvPath, devEnvPath) {
  if (fsSync.existsSync(builderEnvPath)) {
    await fs.copyFile(builderEnvPath, devEnvPath);
  }
}

/**
 * Handle envOutputPath configuration
 * @async
 * @param {string} appName - Application name
 * @param {string} variablesPath - Path to variables.yaml
 * @param {string} builderEnvPath - Path to builder .env file
 * @param {string} devEnvPath - Path to dev .env file
 */
async function handleEnvOutputPath(appName, variablesPath, builderEnvPath, devEnvPath) {
  if (!fsSync.existsSync(variablesPath)) {
    return;
  }

  const variablesContent = fsSync.readFileSync(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);

  if (variables?.build?.envOutputPath && variables.build.envOutputPath !== null) {
    logger.log(chalk.blue('Ensuring .env file in apps/ directory is updated for Docker...'));
    await secrets.generateEnvFile(appName, null, 'docker');
    await copyEnvToDev(builderEnvPath, devEnvPath);
  }
}

/**
 * Calculate compose port from options or app config
 * @param {Object} options - Run options
 * @param {Object} appConfig - Application configuration
 * @param {string} developerId - Developer ID
 * @returns {number} Port number
 */
function calculateComposePort(options, appConfig, developerId) {
  if (options.port) {
    return options.port;
  }
  const basePort = appConfig.port || 3000;
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  return idNum === 0 ? basePort : basePort + (idNum * 100);
}

/**
 * Generate and write Docker Compose file
 * @async
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {Object} composeOptions - Compose options
 * @param {string} devDir - Dev directory path
 * @returns {Promise<string>} Path to compose file
 */
async function generateComposeFile(appName, appConfig, composeOptions, devDir) {
  logger.log(chalk.blue('Generating Docker Compose configuration...'));
  const composeContent = await composeGenerator.generateDockerCompose(appName, appConfig, composeOptions);
  const tempComposePath = path.join(devDir, 'docker-compose.yaml');
  await fs.writeFile(tempComposePath, composeContent);
  return tempComposePath;
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
  const devDir = await ensureDevDirectory(appName, developerId);

  // Generate/update .env file
  const builderEnvPath = path.join(process.cwd(), 'builder', appName, '.env');
  await ensureEnvFile(appName, builderEnvPath);

  // Copy .env to dev directory
  const devEnvPath = path.join(devDir, '.env');
  await copyEnvToDev(builderEnvPath, devEnvPath);

  // Handle envOutputPath if configured
  const variablesPath = path.join(devDir, 'variables.yaml');
  await handleEnvOutputPath(appName, variablesPath, builderEnvPath, devEnvPath);

  // Generate Docker Compose
  const composeOptions = { ...options };
  composeOptions.port = calculateComposePort(composeOptions, appConfig, developerId);
  return await generateComposeFile(appName, appConfig, composeOptions, devDir);
}

/**
 * Prepare environment variables from admin secrets
 * @async
 * @param {boolean} debug - Enable debug logging
 * @returns {Promise<Object>} Environment variables object
 */
async function prepareContainerEnv(debug) {
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

  return env;
}

/**
 * Execute docker-compose up command
 * @async
 * @param {string} composeCmdBase - Base compose command
 * @param {string} composePath - Path to compose file
 * @param {Object} env - Environment variables
 * @param {boolean} debug - Enable debug logging
 */
async function executeComposeUp(composeCmdBase, composePath, env, debug) {
  const composeCmd = `${composeCmdBase} -f "${composePath}" up -d`;
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Executing: ${composeCmd}`));
    logger.log(chalk.gray(`[DEBUG] Compose file: ${composePath}`));
  }
  await execAsync(composeCmd, { env });
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

  // Ensure Docker + Compose available and determine correct compose command
  const composeCmdBase = await dockerUtils.ensureDockerAndCompose().then(() => dockerUtils.getComposeCommand());

  // Prepare environment variables
  const env = await prepareContainerEnv(debug);

  // Execute compose up
  await executeComposeUp(composeCmdBase, composePath, env, debug);

  // Get container name and log status
  const idNum = typeof appConfig.developerId === 'string' ? parseInt(appConfig.developerId, 10) : appConfig.developerId;
  const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${appConfig.developerId}-${appName}`;
  logger.log(chalk.green(`✓ Container ${containerName} started`));
  await containerHelpers.logContainerStatus(containerName, debug);

  // Wait for health check
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

