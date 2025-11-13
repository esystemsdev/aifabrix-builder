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
const secrets = require('./secrets');
const config = require('./config');
const devConfig = require('./utils/dev-config');
const logger = require('./utils/logger');
const containerUtils = require('./utils/infra-containers');
const dockerUtils = require('./utils/docker');
const paths = require('./utils/paths');

// Register Handlebars helper for equality check
handlebars.registerHelper('eq', (a, b) => a === b);
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

async function startInfra(developerId = null) {
  await checkDockerAvailability();
  const adminSecretsPath = await ensureAdminSecrets();

  // Get developer ID from parameter or config
  const devId = developerId || await config.getDeveloperId();
  // Convert to number for getDevPorts (it expects numbers)
  const devIdNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  const ports = devConfig.getDevPorts(devIdNum);
  const idNum = devIdNum;

  // Load compose template (Handlebars)
  const templatePath = path.join(__dirname, '..', 'templates', 'infra', 'compose.yaml.hbs');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Compose template not found: ${templatePath}`);
  }

  // Create infra directory in AIFABRIX_HOME with dev ID
  const aifabrixDir = paths.getAifabrixHome();
  const infraDirName = getInfraDirName(devId);
  const infraDir = path.join(aifabrixDir, infraDirName);
  if (!fs.existsSync(infraDir)) {
    fs.mkdirSync(infraDir, { recursive: true });
  }

  // Generate compose file from template
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(templateContent);
  // Dev 0: infra-aifabrix-network, Dev > 0: infra-dev{id}-aifabrix-network
  const networkName = idNum === 0 ? 'infra-aifabrix-network' : `infra-dev${devId}-aifabrix-network`;
  const composeContent = template({
    devId: idNum,
    postgresPort: ports.postgres,
    redisPort: ports.redis,
    pgadminPort: ports.pgadmin,
    redisCommanderPort: ports.redisCommander,
    networkName: networkName
  });

  const composePath = path.join(infraDir, 'compose.yaml');
  fs.writeFileSync(composePath, composeContent);

  try {
    logger.log(`Using compose file: ${composePath}`);
    logger.log(`Starting infrastructure services for developer ${devId}...`);
    const projectName = getInfraProjectName(devId);
    const composeCmd = await dockerUtils.getComposeCommand();
    await execAsyncWithCwd(`${composeCmd} -f "${composePath}" -p ${projectName} --env-file "${adminSecretsPath}" up -d`, { cwd: infraDir });
    logger.log('Infrastructure services started successfully');

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

/**
 * Gets the status of infrastructure services
 * Returns detailed information about running containers
 *
 * @async
 * @function getInfraStatus
 * @returns {Promise<Object>} Status information for each service
 *
 * @example
 * const status = await getInfraStatus();
 * // Returns: { postgres: { status: 'running', port: 5432, url: 'localhost:5432' }, ... }
 */
async function getInfraStatus() {
  const devId = await config.getDeveloperId();
  // Convert string developer ID to number for getDevPorts
  const devIdNum = parseInt(devId, 10);
  const ports = devConfig.getDevPorts(devIdNum);
  const services = {
    postgres: { port: ports.postgres, url: `localhost:${ports.postgres}` },
    redis: { port: ports.redis, url: `localhost:${ports.redis}` },
    pgadmin: { port: ports.pgadmin, url: `http://localhost:${ports.pgadmin}` },
    'redis-commander': { port: ports.redisCommander, url: `http://localhost:${ports.redisCommander}` }
  };

  const status = {};

  for (const [serviceName, serviceConfig] of Object.entries(services)) {
    try {
      const containerName = await containerUtils.findContainer(serviceName, devId);
      if (containerName) {
        const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}' ${containerName}`);
        // Normalize status value (trim whitespace and remove quotes)
        const normalizedStatus = stdout.trim().replace(/['"]/g, '');
        status[serviceName] = {
          status: normalizedStatus,
          port: serviceConfig.port,
          url: serviceConfig.url
        };
      } else {
        status[serviceName] = {
          status: 'not running',
          port: serviceConfig.port,
          url: serviceConfig.url
        };
      }
    } catch (error) {
      status[serviceName] = {
        status: 'not running',
        port: serviceConfig.port,
        url: serviceConfig.url
      };
    }
  }

  return status;
}

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

/**
 * Gets status of running application containers
 * Finds all containers matching pattern aifabrix-dev{id}-* (excluding infrastructure)
 *
 * @async
 * @function getAppStatus
 * @returns {Promise<Array>} Array of application status objects
 *
 * @example
 * const apps = await getAppStatus();
 * // Returns: [{ name: 'myapp', container: 'aifabrix-dev1-myapp', port: '3100:3000', status: 'running', url: 'http://localhost:3100' }]
 */
async function getAppStatus() {
  const devId = await config.getDeveloperId();
  const apps = [];

  try {
    // Find all containers with pattern
    // Dev 0: aifabrix-* (but exclude infrastructure containers)
    // Dev > 0: aifabrix-dev{id}-*
    const filterPattern = devId === 0 ? 'aifabrix-' : `aifabrix-dev${devId}-`;
    const { stdout } = await execAsync(`docker ps --filter "name=${filterPattern}" --format "{{.Names}}\t{{.Ports}}\t{{.Status}}"`);
    const lines = stdout.trim().split('\n').filter(line => line.trim() !== '');

    // Infrastructure container names to exclude
    // Dev 0: aifabrix-{serviceName}, Dev > 0: aifabrix-dev{id}-{serviceName}
    const infraContainers = devId === 0
      ? [
        'aifabrix-postgres',
        'aifabrix-redis',
        'aifabrix-pgadmin',
        'aifabrix-redis-commander'
      ]
      : [
        `aifabrix-dev${devId}-postgres`,
        `aifabrix-dev${devId}-redis`,
        `aifabrix-dev${devId}-pgadmin`,
        `aifabrix-dev${devId}-redis-commander`
      ];

    for (const line of lines) {
      const [containerName, ports, status] = line.split('\t');

      // Skip infrastructure containers
      if (infraContainers.includes(containerName)) {
        continue;
      }

      // Extract app name from container name
      // Dev 0: aifabrix-{appName}, Dev > 0: aifabrix-dev{id}-{appName}
      const pattern = devId === 0
        ? /^aifabrix-(.+)$/
        : new RegExp(`^aifabrix-dev${devId}-(.+)$`);
      const appNameMatch = containerName.match(pattern);
      if (!appNameMatch) {
        continue;
      }

      const appName = appNameMatch[1];

      // Extract host port from ports string (e.g., "0.0.0.0:3100->3000/tcp")
      const portMatch = ports.match(/:(\d+)->\d+\//);
      const hostPort = portMatch ? portMatch[1] : 'unknown';
      const url = hostPort !== 'unknown' ? `http://localhost:${hostPort}` : 'unknown';

      apps.push({
        name: appName,
        container: containerName,
        port: ports,
        status: status.trim(),
        url: url
      });
    }
  } catch (error) {
    // If no containers found, return empty array
    return [];
  }

  return apps;
}

module.exports = {
  startInfra, stopInfra, stopInfraWithVolumes, checkInfraHealth,
  getInfraStatus, getAppStatus, restartService, ensureAdminSecrets
};
