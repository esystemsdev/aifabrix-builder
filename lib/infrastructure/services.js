/**
 * AI Fabrix Builder Infrastructure Docker Services
 *
 * Handles Docker service operations including starting, stopping, and configuring services.
 *
 * @fileoverview Docker service management for infrastructure
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const containerUtils = require('../utils/infra-containers');
const dockerUtils = require('../utils/docker');
const config = require('../core/config');
const { getInfraProjectName } = require('./helpers');

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

/**
 * Starts Docker services and configures pgAdmin
 * @async
 * @function startDockerServicesAndConfigure
 * @param {string} composePath - Compose file path
 * @param {string} devId - Developer ID
 * @param {number} idNum - Developer ID number
 * @param {string} adminSecretsPath - Admin secrets path
 * @param {string} infraDir - Infrastructure directory
 */
async function startDockerServicesAndConfigure(composePath, devId, idNum, adminSecretsPath, infraDir) {
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

    if (attempt < maxAttempts) {
      logger.log(`Waiting for services to be healthy... (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Services failed to become healthy within timeout period');
}

/**
 * Checks if infrastructure services are running
 * Validates that all required services are healthy and accessible
 *
 * @async
 * @function checkInfraHealth
 * @param {number|string|null} [devId] - Developer ID (null = use current)
 * @returns {Promise<Object>} Health status of each service
 * @throws {Error} If health check fails
 *
 * @example
 * const health = await checkInfraHealth();
 * // Returns: { postgres: 'healthy', redis: 'healthy', pgadmin: 'healthy', redis-commander: 'healthy' }
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

module.exports = {
  execAsyncWithCwd,
  startDockerServices,
  copyPgAdminConfig,
  startDockerServicesAndConfigure,
  waitForServices,
  checkInfraHealth
};
