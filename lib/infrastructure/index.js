/**
 * AI Fabrix Builder Infrastructure Management
 *
 * This module manages local infrastructure services using Docker Compose.
 * Handles starting/stopping Postgres, Redis, Keycloak, and Controller services.
 *
 * @fileoverview Local infrastructure management for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const secrets = require('../core/secrets');
const config = require('../core/config');
const devConfig = require('../utils/dev-config');
const logger = require('../utils/logger');
const containerUtils = require('../utils/infra-containers');
const dockerUtils = require('../utils/docker');
const paths = require('../utils/paths');
const statusHelpers = require('../utils/infra-status');

// Register Handlebars helper for equality check
// Handles both strict equality and numeric string comparisons
// Treats null/undefined as equivalent to "0" (default infrastructure)
handlebars.registerHelper('eq', (a, b) => {
  // Handle null/undefined - treat as "0" for default infrastructure
  if (a === null || a === undefined) a = '0';
  if (b === null || b === undefined) b = '0';

  // If both are numeric strings or one is number and other is numeric string, compare as numbers
  const aNum = typeof a === 'string' && /^\d+$/.test(a) ? parseInt(a, 10) : a;
  const bNum = typeof b === 'string' && /^\d+$/.test(b) ? parseInt(b, 10) : b;
  // Use numeric comparison if both are numbers, otherwise strict equality
  if (typeof aNum === 'number' && typeof bNum === 'number') {
    return aNum === bNum;
  }
  return a === b;
});
const execAsync = promisify(exec);

/**
 * Gets infrastructure directory name based on developer ID
 * Dev 0: infra (no dev-0 suffix), Dev > 0: infra-dev{id}
 * @param {number|string} devId - Developer ID
 * @returns {string} Infrastructure directory name
 */
function getInfraDirName(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  return idNum === 0 ? 'infra' : `infra-dev${devId}`;
}

/**
 * Gets Docker Compose project name based on developer ID
 * Dev 0: infra (no dev-0 suffix), Dev > 0: infra-dev{id}
 * @param {number|string} devId - Developer ID
 * @returns {string} Docker Compose project name
 */
function getInfraProjectName(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  return idNum === 0 ? 'infra' : `infra-dev${devId}`;
}

// Wrapper to support cwd option
function execAsyncWithCwd(command, options = {}) {
  return new Promise((resolve, reject) => {
    const { cwd, ...execOptions } = options;
    exec(command, { ...execOptions, cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Starts local infrastructure services
 * Launches Postgres, Redis, Keycloak, and Controller in Docker containers
 *
 * @async
 * @function startInfra
 * @returns {Promise<void>} Resolves when infrastructure is started
 * @throws {Error} If Docker is not running or compose fails
 *
 * @example
 * await startInfra();
 * // Infrastructure services are now running
 */
async function checkDockerAvailability() {
  try {
    await dockerUtils.ensureDockerAndCompose();
  } catch (error) {
    throw new Error('Docker or Docker Compose is not available. Please install and start Docker.');
  }
}

async function ensureAdminSecrets() {
  const adminSecretsPath = path.join(paths.getAifabrixHome(), 'admin-secrets.env');
  if (!fs.existsSync(adminSecretsPath)) {
    logger.log('Generating admin-secrets.env...');
    await secrets.generateAdminSecretsEnv();
  }
  return adminSecretsPath;
}

/**
 * Generates pgAdmin4 configuration files (servers.json and pgpass)
 * @param {string} infraDir - Infrastructure directory path
 * @param {string} postgresPassword - PostgreSQL password
 */
function generatePgAdminConfig(infraDir, postgresPassword) {
  const serversJsonTemplatePath = path.join(__dirname, '..', 'templates', 'infra', 'servers.json.hbs');
  if (!fs.existsSync(serversJsonTemplatePath)) {
    return;
  }

  const serversJsonTemplateContent = fs.readFileSync(serversJsonTemplatePath, 'utf8');
  const serversJsonTemplate = handlebars.compile(serversJsonTemplateContent);
  const serversJsonContent = serversJsonTemplate({ postgresPassword });
  const serversJsonPath = path.join(infraDir, 'servers.json');
  fs.writeFileSync(serversJsonPath, serversJsonContent, { mode: 0o644 });

  const pgpassContent = `postgres:5432:postgres:pgadmin:${postgresPassword}\n`;
  const pgpassPath = path.join(infraDir, 'pgpass');
  fs.writeFileSync(pgpassPath, pgpassContent, { mode: 0o600 });
}

/**
 * Prepare infrastructure directory and extract postgres password
 * @param {string} devId - Developer ID
 * @param {string} adminSecretsPath - Path to admin secrets file
 * @returns {Object} Object with infraDir and postgresPassword
 */
function prepareInfraDirectory(devId, adminSecretsPath) {
  const aifabrixDir = paths.getAifabrixHome();
  const infraDirName = getInfraDirName(devId);
  const infraDir = path.join(aifabrixDir, infraDirName);
  if (!fs.existsSync(infraDir)) {
    fs.mkdirSync(infraDir, { recursive: true });
  }

  const adminSecretsContent = fs.readFileSync(adminSecretsPath, 'utf8');
  const postgresPasswordMatch = adminSecretsContent.match(/^POSTGRES_PASSWORD=(.+)$/m);
  const postgresPassword = postgresPasswordMatch ? postgresPasswordMatch[1] : '';
  generatePgAdminConfig(infraDir, postgresPassword);

  return { infraDir, postgresPassword };
}

/**
 * Register Handlebars helper for equality comparison
 */
function registerHandlebarsHelper() {
  handlebars.registerHelper('eq', (a, b) => {
    if (a === null || a === undefined) a = '0';
    if (b === null || b === undefined) b = '0';
    const aNum = typeof a === 'string' && /^\d+$/.test(a) ? parseInt(a, 10) : a;
    const bNum = typeof b === 'string' && /^\d+$/.test(b) ? parseInt(b, 10) : b;
    if (typeof aNum === 'number' && typeof bNum === 'number') {
      return aNum === bNum;
    }
    return a === b;
  });
}

/**
 * Generate docker-compose file from template
 * @param {string} templatePath - Path to compose template
 * @param {string} devId - Developer ID
 * @param {number} idNum - Developer ID number
 * @param {Object} ports - Port configuration
 * @param {string} infraDir - Infrastructure directory
 * @returns {string} Path to generated compose file
 */
function generateComposeFile(templatePath, devId, idNum, ports, infraDir) {
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(templateContent);
  const networkName = idNum === 0 ? 'infra-aifabrix-network' : `infra-dev${devId}-aifabrix-network`;
  const serversJsonPath = path.join(infraDir, 'servers.json');
  const pgpassPath = path.join(infraDir, 'pgpass');
  const composeContent = template({
    devId: devId,
    postgresPort: ports.postgres,
    redisPort: ports.redis,
    pgadminPort: ports.pgadmin,
    redisCommanderPort: ports.redisCommander,
    networkName: networkName,
    serversJsonPath: serversJsonPath,
    pgpassPath: pgpassPath,
    infraDir: infraDir
  });
  const composePath = path.join(infraDir, 'compose.yaml');
  fs.writeFileSync(composePath, composeContent);
  return composePath;
}

/**
 * Start Docker services using docker-compose
 * @async
 * @param {string} composePath - Path to compose file
 * @param {string} projectName - Docker project name
 * @param {string} adminSecretsPath - Path to admin secrets file
 * @param {string} infraDir - Infrastructure directory
 */
async function startDockerServices(composePath, projectName, adminSecretsPath, infraDir) {
  logger.log(`Using compose file: ${composePath}`);
  logger.log('Starting infrastructure services...');
  const composeCmd = await dockerUtils.getComposeCommand();
  await execAsyncWithCwd(`${composeCmd} -f "${composePath}" -p ${projectName} --env-file "${adminSecretsPath}" up -d`, { cwd: infraDir });
  logger.log('Infrastructure services started successfully');
}

/**
 * Copy pgAdmin4 configuration files into container
 * @async
 * @param {string} pgadminContainerName - pgAdmin container name
 * @param {string} serversJsonPath - Path to servers.json file
 * @param {string} pgpassPath - Path to pgpass file
 */
async function copyPgAdminConfig(pgadminContainerName, serversJsonPath, pgpassPath) {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for container to be ready
    if (fs.existsSync(serversJsonPath)) {
      await execAsync(`docker cp "${serversJsonPath}" ${pgadminContainerName}:/pgadmin4/servers.json`);
    }
    if (fs.existsSync(pgpassPath)) {
      await execAsync(`docker cp "${pgpassPath}" ${pgadminContainerName}:/pgpass`);
      await execAsync(`docker exec ${pgadminContainerName} chmod 600 /pgpass`);
    }
  } catch (error) {
    // Ignore copy errors - files might already be there or container not ready
    logger.log('Note: Could not copy pgAdmin4 config files (this is OK if container was just restarted)');
  }
}

async function startInfra(developerId = null) {
  await checkDockerAvailability();
  const adminSecretsPath = await ensureAdminSecrets();

  const devId = developerId || await config.getDeveloperId();
  const devIdNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  const ports = devConfig.getDevPorts(devIdNum);
  const idNum = devIdNum;

  const templatePath = path.join(__dirname, '..', 'templates', 'infra', 'compose.yaml.hbs');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Compose template not found: ${templatePath}`);
  }

  // Prepare infrastructure directory
  const { infraDir } = prepareInfraDirectory(devId, adminSecretsPath);

  // Register Handlebars helper
  registerHandlebarsHelper();

  // Generate compose file
  const composePath = generateComposeFile(templatePath, devId, idNum, ports, infraDir);

  try {
    // Start Docker services
    const projectName = getInfraProjectName(devId);
    await startDockerServices(composePath, projectName, adminSecretsPath, infraDir);

    // Copy pgAdmin4 config files
    const pgadminContainerName = idNum === 0 ? 'aifabrix-pgadmin' : `aifabrix-dev${devId}-pgadmin`;
    const serversJsonPath = path.join(infraDir, 'servers.json');
    const pgpassPath = path.join(infraDir, 'pgpass');
    await copyPgAdminConfig(pgadminContainerName, serversJsonPath, pgpassPath);

    // Wait for services to be healthy
    await waitForServices(devId);
    logger.log('All services are healthy and ready');
  } finally {
    // Keep the compose file for stop commands
  }
}

/**
 * Stops and removes local infrastructure services
 * Cleanly shuts down all infrastructure containers
 *
 * @async
 * @function stopInfra
 * @returns {Promise<void>} Resolves when infrastructure is stopped
 * @throws {Error} If Docker compose fails
 *
 * @example
 * await stopInfra();
 * // All infrastructure containers are stopped and removed
 */
async function stopInfra() {
  const devId = await config.getDeveloperId();
  const aifabrixDir = paths.getAifabrixHome();
  const infraDirName = getInfraDirName(devId);
  const infraDir = path.join(aifabrixDir, infraDirName);
  const composePath = path.join(infraDir, 'compose.yaml');
  const adminSecretsPath = path.join(aifabrixDir, 'admin-secrets.env');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    logger.log('Infrastructure not running or not properly configured');
    return;
  }

  try {
    logger.log('Stopping infrastructure services...');
    const projectName = getInfraProjectName(devId);
    const composeCmd = await dockerUtils.getComposeCommand();
    await execAsyncWithCwd(`${composeCmd} -f "${composePath}" -p ${projectName} --env-file "${adminSecretsPath}" down`, { cwd: infraDir });
    logger.log('Infrastructure services stopped');
  } finally {
    // Keep the compose file for future use
  }
}

/**
 * Stops and removes local infrastructure services with volumes
 * Cleanly shuts down all infrastructure containers and removes all data
 *
 * @async
 * @function stopInfraWithVolumes
 * @returns {Promise<void>} Resolves when infrastructure is stopped and volumes removed
 * @throws {Error} If Docker compose fails
 *
 * @example
 * await stopInfraWithVolumes();
 * // All infrastructure containers and data are removed
 */
async function stopInfraWithVolumes() {
  const devId = await config.getDeveloperId();
  const aifabrixDir = paths.getAifabrixHome();
  const infraDirName = getInfraDirName(devId);
  const infraDir = path.join(aifabrixDir, infraDirName);
  const composePath = path.join(infraDir, 'compose.yaml');
  const adminSecretsPath = path.join(aifabrixDir, 'admin-secrets.env');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    logger.log('Infrastructure not running or not properly configured');
    return;
  }

  try {
    logger.log('Stopping infrastructure services and removing all data...');
    const projectName = getInfraProjectName(devId);
    const composeCmd = await dockerUtils.getComposeCommand();
    await execAsyncWithCwd(`${composeCmd} -f "${composePath}" -p ${projectName} --env-file "${adminSecretsPath}" down -v`, { cwd: infraDir });
    logger.log('Infrastructure services stopped and all data removed');
  } finally {
    // Keep the compose file for future use
  }
}

/**
 * Checks if infrastructure services are running
 * Validates that all required services are healthy and accessible
 *
 * @async
 * @function checkInfraHealth
 * @returns {Promise<Object>} Health status of each service
 * @throws {Error} If health check fails
 *
 * @example
 * const health = await checkInfraHealth();
 * // Returns: { postgres: 'healthy', redis: 'healthy', keycloak: 'healthy', controller: 'healthy' }
 */
async function checkInfraHealth(devId = null) {
  const developerId = devId || await config.getDeveloperId();
  const servicesWithHealthCheck = ['postgres', 'redis'];
  const servicesWithoutHealthCheck = ['pgadmin', 'redis-commander'];
  const health = {};

  // Check health status for services with health checks
  for (const service of servicesWithHealthCheck) {
    health[service] = await containerUtils.checkServiceWithHealthCheck(service, developerId);
  }

  // Check if services without health checks are running
  for (const service of servicesWithoutHealthCheck) {
    health[service] = await containerUtils.checkServiceWithoutHealthCheck(service, developerId);
  }

  return health;
}

// Re-export status helper functions
const getInfraStatus = statusHelpers.getInfraStatus;
const getAppStatus = statusHelpers.getAppStatus;

/**
 * Restarts a specific infrastructure service
 * Useful for applying configuration changes
 *
 * @async
 * @function restartService
 * @param {string} serviceName - Name of service to restart
 * @returns {Promise<void>} Resolves when service is restarted
 * @throws {Error} If service doesn't exist or restart fails
 *
 * @example
 * await restartService('keycloak');
 * // Keycloak service is restarted
 */
async function restartService(serviceName) {
  if (!serviceName || typeof serviceName !== 'string') {
    throw new Error('Service name is required and must be a string');
  }

  const validServices = ['postgres', 'redis', 'pgadmin', 'redis-commander'];
  if (!validServices.includes(serviceName)) {
    throw new Error(`Invalid service name. Must be one of: ${validServices.join(', ')}`);
  }

  const devId = await config.getDeveloperId();
  const aifabrixDir = paths.getAifabrixHome();
  const infraDirName = getInfraDirName(devId);
  const infraDir = path.join(aifabrixDir, infraDirName);
  const composePath = path.join(infraDir, 'compose.yaml');
  const adminSecretsPath = path.join(aifabrixDir, 'admin-secrets.env');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    throw new Error('Infrastructure not properly configured');
  }

  try {
    logger.log(`Restarting ${serviceName} service...`);
    const projectName = getInfraProjectName(devId);
    const composeCmd = await dockerUtils.getComposeCommand();
    await execAsyncWithCwd(`${composeCmd} -f "${composePath}" -p ${projectName} --env-file "${adminSecretsPath}" restart ${serviceName}`, { cwd: infraDir });
    logger.log(`${serviceName} service restarted successfully`);
  } finally {
    // Keep the compose file for future use
  }
}

/**
 * Waits for services to be healthy
 * @private
 * @param {number} [devId] - Developer ID (optional, will be loaded from config if not provided)
 */
async function waitForServices(devId = null) {
  const maxAttempts = 30;
  const delay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const health = await checkInfraHealth(devId);
    const allHealthy = Object.values(health).every(status => status === 'healthy');

    if (allHealthy) {
      return;
    }

    // Debug logging

    if (attempt < maxAttempts) {
      logger.log(`Waiting for services to be healthy... (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Services failed to become healthy within timeout period');
}
module.exports = {
  startInfra, stopInfra, stopInfraWithVolumes, checkInfraHealth,
  getInfraStatus, getAppStatus, restartService, ensureAdminSecrets
};
