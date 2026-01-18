/**
 * AI Fabrix Builder - Infrastructure Status Helpers
 *
 * Status-related helper functions for infrastructure management.
 * Extracted from infra.js to reduce file size.
 *
 * @fileoverview Status helper functions for infrastructure management
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const config = require('../core/config');
const devConfig = require('./dev-config');
const containerUtils = require('./infra-containers');

const execAsync = promisify(exec);

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
 * Gets infrastructure container names for a developer ID
 * @param {number} devIdNum - Developer ID number
 * @param {string} devId - Developer ID string
 * @returns {Array<string>} Array of infrastructure container names
 */
function getInfraContainerNames(devIdNum, devId) {
  if (devIdNum === 0) {
    return ['aifabrix-postgres', 'aifabrix-redis', 'aifabrix-pgadmin', 'aifabrix-redis-commander'];
  }
  return [`aifabrix-dev${devId}-postgres`, `aifabrix-dev${devId}-redis`, `aifabrix-dev${devId}-pgadmin`, `aifabrix-dev${devId}-redis-commander`];
}

/**
 * Extracts app name from container name
 * @param {string} containerName - Container name
 * @param {number} devIdNum - Developer ID number
 * @param {string} devId - Developer ID string
 * @returns {string|null} App name or null if not matched
 */
function extractAppName(containerName, devIdNum, devId) {
  const pattern = devIdNum === 0 ? /^aifabrix-(.+)$/ : new RegExp(`^aifabrix-dev${devId}-(.+)$`);
  const match = containerName.match(pattern);
  return match ? match[1] : null;
}

/**
 * Extracts host port from docker ports string
 * @param {string} ports - Docker ports string
 * @returns {string} Host port or 'unknown'
 */
function extractHostPort(ports) {
  const portMatch = ports.match(/:(\d+)->\d+\//);
  return portMatch ? portMatch[1] : 'unknown';
}

/**
 * Parses container line and creates app status object
 * @param {string} line - Container line from docker ps
 * @param {Array<string>} infraContainers - Infrastructure container names
 * @param {number} devIdNum - Developer ID number
 * @param {string} devId - Developer ID string
 * @returns {Object|null} App status object or null if not an app container
 */
function parseContainerLine(line, infraContainers, devIdNum, devId) {
  const [containerName, ports, status] = line.split('\t');
  if (infraContainers.includes(containerName)) {
    return null;
  }
  const appName = extractAppName(containerName, devIdNum, devId);
  if (!appName) {
    return null;
  }
  const hostPort = extractHostPort(ports);
  const url = hostPort !== 'unknown' ? `http://localhost:${hostPort}` : 'unknown';
  return { name: appName, container: containerName, port: ports, status: status.trim(), url: url };
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
    const devIdNum = parseInt(devId, 10);
    const filterPattern = devIdNum === 0 ? 'aifabrix-' : `aifabrix-dev${devId}-`;
    const { stdout } = await execAsync(`docker ps --filter "name=${filterPattern}" --format "{{.Names}}\t{{.Ports}}\t{{.Status}}"`);
    const lines = stdout.trim().split('\n').filter(line => line.trim() !== '');
    const infraContainers = getInfraContainerNames(devIdNum, devId);
    for (const line of lines) {
      const appStatus = parseContainerLine(line, infraContainers, devIdNum, devId);
      if (appStatus) {
        apps.push(appStatus);
      }
    }
  } catch (error) {
    return [];
  }

  return apps;
}

module.exports = {
  getInfraStatus,
  getAppStatus
};

