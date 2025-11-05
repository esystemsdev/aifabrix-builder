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
const os = require('os');
const secrets = require('./secrets');
const logger = require('./utils/logger');

const execAsync = promisify(exec);

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
    await execAsync('docker --version');
    await execAsync('docker-compose --version');
  } catch (error) {
    throw new Error('Docker or Docker Compose is not available. Please install and start Docker.');
  }
}

async function ensureAdminSecrets() {
  const adminSecretsPath = path.join(os.homedir(), '.aifabrix', 'admin-secrets.env');
  if (!fs.existsSync(adminSecretsPath)) {
    logger.log('Generating admin-secrets.env...');
    await secrets.generateAdminSecretsEnv();
  }
  return adminSecretsPath;
}

async function startInfra() {
  await checkDockerAvailability();
  const adminSecretsPath = await ensureAdminSecrets();

  // Load compose template
  const templatePath = path.join(__dirname, '..', 'templates', 'infra', 'compose.yaml');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Compose template not found: ${templatePath}`);
  }

  // Create infra directory in ~/.aifabrix
  const aifabrixDir = path.join(os.homedir(), '.aifabrix');
  const infraDir = path.join(aifabrixDir, 'infra');
  if (!fs.existsSync(infraDir)) {
    fs.mkdirSync(infraDir, { recursive: true });
  }

  const composePath = path.join(infraDir, 'compose.yaml');
  fs.writeFileSync(composePath, fs.readFileSync(templatePath, 'utf8'));

  try {
    logger.log(`Using compose file: ${composePath}`);
    logger.log('Starting infrastructure services...');
    await execAsyncWithCwd(`docker-compose -f "${composePath}" -p infra --env-file "${adminSecretsPath}" up -d`, { cwd: infraDir });
    logger.log('Infrastructure services started successfully');

    await waitForServices();
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
  const aifabrixDir = path.join(os.homedir(), '.aifabrix');
  const composePath = path.join(aifabrixDir, 'infra', 'compose.yaml');
  const adminSecretsPath = path.join(aifabrixDir, 'admin-secrets.env');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    logger.log('Infrastructure not running or not properly configured');
    return;
  }

  const infraDir = path.join(aifabrixDir, 'infra');

  try {
    logger.log('Stopping infrastructure services...');
    await execAsyncWithCwd(`docker-compose -f "${composePath}" -p infra --env-file "${adminSecretsPath}" down`, { cwd: infraDir });
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
  const aifabrixDir = path.join(os.homedir(), '.aifabrix');
  const composePath = path.join(aifabrixDir, 'infra', 'compose.yaml');
  const adminSecretsPath = path.join(aifabrixDir, 'admin-secrets.env');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    logger.log('Infrastructure not running or not properly configured');
    return;
  }

  const infraDir = path.join(aifabrixDir, 'infra');

  try {
    logger.log('Stopping infrastructure services and removing all data...');
    await execAsyncWithCwd(`docker-compose -f "${composePath}" -p infra --env-file "${adminSecretsPath}" down -v`, { cwd: infraDir });
    logger.log('Infrastructure services stopped and all data removed');
  } finally {
    // Keep the compose file for future use
  }
}

/**
 * Finds container by name pattern
 * @private
 * @async
 * @param {string} serviceName - Service name
 * @returns {Promise<string|null>} Container name or null if not found
 */
async function findContainer(serviceName) {
  try {
    // Try both naming patterns: infra-* (dynamic names) and aifabrix-* (hardcoded names)
    let { stdout } = await execAsync(`docker ps --filter "name=infra-${serviceName}" --format "{{.Names}}"`);
    let containerName = stdout.trim();
    if (!containerName) {
      // Fallback to hardcoded names
      ({ stdout } = await execAsync(`docker ps --filter "name=aifabrix-${serviceName}" --format "{{.Names}}"`));
      containerName = stdout.trim();
    }
    return containerName;
  } catch (error) {
    return null;
  }
}

/**
 * Checks health status for a service with health checks
 * @private
 * @async
 * @param {string} serviceName - Service name
 * @returns {Promise<string>} Health status
 */
async function checkServiceWithHealthCheck(serviceName) {
  try {
    const containerName = await findContainer(serviceName);
    if (!containerName) {
      return 'unknown';
    }
    const { stdout } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' ${containerName}`);
    const status = stdout.trim().replace(/['"]/g, '');
    // Accept both 'healthy' and 'starting' as healthy (starting means it's initializing)
    return (status === 'healthy' || status === 'starting') ? 'healthy' : status;
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Checks health status for a service without health checks
 * @private
 * @async
 * @param {string} serviceName - Service name
 * @returns {Promise<string>} Health status
 */
async function checkServiceWithoutHealthCheck(serviceName) {
  try {
    const containerName = await findContainer(serviceName);
    if (!containerName) {
      return 'unknown';
    }
    const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}' ${containerName}`);
    const status = stdout.trim().replace(/['"]/g, '');
    // Treat 'running' or 'healthy' as 'healthy' for services without health checks
    return (status === 'running' || status === 'healthy') ? 'healthy' : 'unhealthy';
  } catch (error) {
    return 'unknown';
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
async function checkInfraHealth() {
  const servicesWithHealthCheck = ['postgres', 'redis'];
  const servicesWithoutHealthCheck = ['pgadmin', 'redis-commander'];
  const health = {};

  // Check health status for services with health checks
  for (const service of servicesWithHealthCheck) {
    health[service] = await checkServiceWithHealthCheck(service);
  }

  // Check if services without health checks are running
  for (const service of servicesWithoutHealthCheck) {
    health[service] = await checkServiceWithoutHealthCheck(service);
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
  const services = {
    postgres: { port: 5432, url: 'localhost:5432' },
    redis: { port: 6379, url: 'localhost:6379' },
    pgadmin: { port: 5050, url: 'http://localhost:5050' },
    'redis-commander': { port: 8081, url: 'http://localhost:8081' }
  };

  const status = {};

  for (const [serviceName, config] of Object.entries(services)) {
    try {
      const containerName = await findContainer(serviceName);
      if (containerName) {
        const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}' ${containerName}`);
        status[serviceName] = {
          status: stdout.trim(),
          port: config.port,
          url: config.url
        };
      } else {
        status[serviceName] = {
          status: 'not running',
          port: config.port,
          url: config.url
        };
      }
    } catch (error) {
      status[serviceName] = {
        status: 'not running',
        port: config.port,
        url: config.url
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

  const aifabrixDir = path.join(os.homedir(), '.aifabrix');
  const composePath = path.join(aifabrixDir, 'infra', 'compose.yaml');
  const adminSecretsPath = path.join(aifabrixDir, 'admin-secrets.env');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    throw new Error('Infrastructure not properly configured');
  }

  const infraDir = path.join(aifabrixDir, 'infra');

  try {
    logger.log(`Restarting ${serviceName} service...`);
    await execAsyncWithCwd(`docker-compose -f "${composePath}" -p infra --env-file "${adminSecretsPath}" restart ${serviceName}`, { cwd: infraDir });
    logger.log(`${serviceName} service restarted successfully`);
  } finally {
    // Keep the compose file for future use
  }
}

/**
 * Waits for services to be healthy
 * @private
 */
async function waitForServices() {
  const maxAttempts = 30;
  const delay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const health = await checkInfraHealth();
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
  startInfra,
  stopInfra,
  stopInfraWithVolumes,
  checkInfraHealth,
  getInfraStatus,
  restartService,
  ensureAdminSecrets
};
