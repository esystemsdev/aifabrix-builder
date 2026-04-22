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

const config = require('../core/config');
const devConfig = require('./dev-config');
const containerUtils = require('./infra-containers');
const { execWithDockerEnv } = require('./docker-exec');

/**
 * Builds services config map from ports and config flags.
 * @param {Object} ports - Port configuration
 * @param {Object} cfg - Config (pgadmin, redisCommander, traefik)
 * @returns {Object} Map of serviceName -> { port, url }
 */
function buildServicesConfig(ports, cfg) {
  const services = {
    postgres: { port: ports.postgres, url: `localhost:${ports.postgres}` },
    redis: { port: ports.redis, url: `localhost:${ports.redis}` }
  };
  if (cfg.pgadmin !== false) services.pgadmin = { port: ports.pgadmin, url: `http://localhost:${ports.pgadmin}` };
  if (cfg.redisCommander !== false) {
    services['redis-commander'] = { port: ports.redisCommander, url: `http://localhost:${ports.redisCommander}` };
  }
  if (cfg.traefik) {
    services.traefik = {
      port: `${ports.traefikHttp}, ${ports.traefikHttps}`,
      url: `http://localhost:${ports.traefikHttp}, https://localhost:${ports.traefikHttps}`
    };
  }
  return services;
}

/**
 * Gets status for a single service.
 * @param {string} serviceName - Service name
 * @param {Object} serviceConfig - { port, url }
 * @param {string} devId - Developer ID
 * @returns {Promise<Object>} Status entry
 */
async function getServiceStatus(serviceName, serviceConfig, devId) {
  try {
    const containerName = await containerUtils.findContainer(serviceName, devId, { strict: true });
    const rawStatus = containerName
      ? (await execWithDockerEnv(`docker inspect --format='{{.State.Status}}' ${containerName}`)).stdout.trim().replace(/['"]/g, '')
      : 'not running';
    return { status: rawStatus, port: serviceConfig.port, url: serviceConfig.url };
  } catch {
    return { status: 'not running', port: serviceConfig.port, url: serviceConfig.url };
  }
}

/**
 * Gets the status of infrastructure services
 * Returns detailed information about running containers.
 * Only includes pgAdmin, Redis Commander, and Traefik when enabled in config.
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
  const cfg = await config.getConfig();
  const ports = devConfig.getDevPorts(parseInt(devId, 10));
  const services = buildServicesConfig(ports, cfg);
  const status = {};
  for (const [name, svc] of Object.entries(services)) {
    status[name] = await getServiceStatus(name, svc, devId);
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
    return ['aifabrix-postgres', 'aifabrix-redis', 'aifabrix-pgadmin', 'aifabrix-redis-commander', 'aifabrix-traefik'];
  }
  return [
    `aifabrix-dev${devId}-postgres`,
    `aifabrix-dev${devId}-redis`,
    `aifabrix-dev${devId}-pgadmin`,
    `aifabrix-dev${devId}-redis-commander`,
    `aifabrix-dev${devId}-traefik`
  ];
}

/** Suffixes for init/helper containers to exclude from "Running Applications" (e.g. keycloak-db-init) */
const INIT_CONTAINER_SUFFIXES = ['-db-init', '-init'];

/** Names like aifabrix-dev02-postgres belong to isolated developer stacks, not legacy dev-0 mode */
const DEV_PREFIXED_CONTAINER = /^aifabrix-dev\d+-/;

/**
 * Extracts app name from container name
 * @param {string} containerName - Container name
 * @param {number} devIdNum - Developer ID number
 * @param {string} devId - Developer ID string
 * @returns {string|null} App name or null if not matched
 */
function extractAppName(containerName, devIdNum, devId) {
  if (devIdNum === 0 && DEV_PREFIXED_CONTAINER.test(containerName)) {
    return null;
  }
  const pattern = devIdNum === 0 ? /^aifabrix-(.+)$/ : new RegExp(`^aifabrix-dev${devId}-(.+)$`);
  const match = containerName.match(pattern);
  if (!match) return null;
  const appName = match[1];
  if (INIT_CONTAINER_SUFFIXES.some(suffix => appName.endsWith(suffix))) {
    return null;
  }
  return appName;
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
    const { stdout } = await execWithDockerEnv(`docker ps --filter "name=${filterPattern}" --format "{{.Names}}\t{{.Ports}}\t{{.Status}}"`);
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

/**
 * Lists app container names for a developer (excludes infra containers).
 * Used by down-infra to stop/remove all app-related containers on the same network.
 * When includeExited is true, includes stopped/exited containers (e.g. db-init one-offs).
 *
 * @async
 * @function listAppContainerNamesForDeveloper
 * @param {string} devId - Developer ID
 * @param {Object} [options] - Options
 * @param {boolean} [options.includeExited=false] - If true, use docker ps -a to include exited containers
 * @returns {Promise<string[]>} Container names (e.g. aifabrix-myapp, aifabrix-keycloak-db-init)
 */
async function listAppContainerNamesForDeveloper(devId, options = {}) {
  const devIdNum = parseInt(devId, 10);
  const filterPattern = devIdNum === 0 ? 'aifabrix-' : `aifabrix-dev${devId}-`;
  const infraContainers = getInfraContainerNames(devIdNum, devId);
  const includeExited = !!options.includeExited;
  try {
    const allFlag = includeExited ? ' -a' : '';
    const { stdout } = await execWithDockerEnv(`docker ps${allFlag} --filter "name=${filterPattern}" --format "{{.Names}}"`);
    const names = (stdout || '').trim().split('\n').filter(Boolean);
    return names.filter(n => {
      if (devIdNum === 0 && DEV_PREFIXED_CONTAINER.test(n)) {
        return false;
      }
      return !infraContainers.includes(n);
    });
  } catch {
    return [];
  }
}

module.exports = {
  getInfraStatus,
  getAppStatus,
  extractAppName,
  listAppContainerNamesForDeveloper
};

