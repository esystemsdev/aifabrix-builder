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
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const containerUtils = require('../utils/infra-containers');
const dockerUtils = require('../utils/docker');
const config = require('../core/config');
const { getInfraProjectName } = require('./helpers');
const adminSecrets = require('../core/admin-secrets');

// Wrapper to support cwd option and dev-config remote Docker (docker-endpoint + TLS)
async function execAsyncWithCwd(command, options = {}) {
  const { getDockerExecEnv } = require('../utils/remote-docker-env');
  const { cwd, env: extraEnv, ...execOptions } = options;
  const env = { ...(await getDockerExecEnv()), ...(extraEnv || {}) };
  return new Promise((resolve, reject) => {
    exec(command, { ...execOptions, cwd, env }, (error, stdout, stderr) => {
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
  const { execWithDockerEnv } = require('../utils/docker-exec');
  try {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for container to be ready
    if (fs.existsSync(serversJsonPath)) {
      await execWithDockerEnv(`docker cp "${serversJsonPath}" ${pgadminContainerName}:/pgadmin4/servers.json`);
    }
    if (fs.existsSync(pgpassPath)) {
      await execWithDockerEnv(`docker cp "${pgpassPath}" ${pgadminContainerName}:/pgpass`);
      await execWithDockerEnv(`docker exec ${pgadminContainerName} chmod 600 /pgpass`);
    }
  } catch (error) {
    // Ignore copy errors - files might already be there or container not ready
    logger.log('Note: Could not copy pgAdmin4 config files (this is OK if container was just restarted)');
  }
}

/**
 * Prepare run env file from decrypted admin secrets.
 * @async
 * @param {string} infraDir - Infrastructure directory
 * @returns {Promise<{ adminObj: Object, runEnvPath: string }>}
 */
async function prepareRunEnv(infraDir) {
  const runEnvPath = path.join(infraDir, '.env.run');
  const adminObj = await adminSecrets.readAndDecryptAdminSecrets();
  const content = adminSecrets.envObjectToContent(adminObj);
  fs.writeFileSync(runEnvPath, content, { mode: 0o600 });
  return { adminObj, runEnvPath };
}

/**
 * Write pgpass file and copy pgAdmin config into container.
 * @async
 * @param {string} infraDir - Infrastructure directory
 * @param {Object} adminObj - Decrypted admin secrets object
 * @param {string} devId - Developer ID
 * @param {number} idNum - Developer ID number
 * @returns {Promise<string>} Path to pgpass run file
 */
async function writePgpassAndCopyPgAdminConfig(infraDir, adminObj, devId, idNum) {
  const pgpassRunPath = path.join(infraDir, '.pgpass.run');
  const pgadminContainerName = idNum === 0 ? 'aifabrix-pgadmin' : `aifabrix-dev${devId}-pgadmin`;
  const serversJsonPath = path.join(infraDir, 'servers.json');
  const postgresPassword = adminObj.POSTGRES_PASSWORD || '';
  const pgpassContent = `postgres:5432:postgres:pgadmin:${postgresPassword}\n`;
  fs.writeFileSync(pgpassRunPath, pgpassContent, { mode: 0o600 });
  await copyPgAdminConfig(pgadminContainerName, serversJsonPath, pgpassRunPath);
  return pgpassRunPath;
}

/**
 * Remove temporary run files (env and pgpass) if they exist.
 * @param {string} runEnvPath - Path to .env.run
 * @param {string} [pgpassRunPath] - Path to .pgpass.run
 */
function cleanupRunFiles(runEnvPath, pgpassRunPath) {
  try {
    if (fs.existsSync(runEnvPath)) fs.unlinkSync(runEnvPath);
    if (pgpassRunPath && fs.existsSync(pgpassRunPath)) fs.unlinkSync(pgpassRunPath);
  } catch {
    // Ignore unlink errors
  }
}

/**
 * Starts Docker services and configures pgAdmin (when enabled).
 * Writes decrypted admin secrets to a temporary .env in infra dir, runs compose, then deletes the file (ISO 27K).
 *
 * @async
 * @function startDockerServicesAndConfigure
 * @param {string} composePath - Compose file path
 * @param {string} devId - Developer ID
 * @param {number} idNum - Developer ID number
 * @param {string} infraDir - Infrastructure directory
 * @param {Object} [opts] - Options (pgadmin, redisCommander, traefik)
 */
async function startDockerServicesAndConfigure(composePath, devId, idNum, infraDir, opts = {}) {
  let runEnvPath;
  let pgpassRunPath;
  let adminObj;
  const { pgadmin = true, redisCommander = true, traefik = false } = opts;
  try {
    ({ adminObj, runEnvPath } = await prepareRunEnv(infraDir));
  } catch (err) {
    throw new Error(`Failed to prepare infra env: ${err.message}`);
  }

  try {
    const projectName = getInfraProjectName(devId);
    await startDockerServices(composePath, projectName, runEnvPath, infraDir);
    if (pgadmin) {
      pgpassRunPath = await writePgpassAndCopyPgAdminConfig(infraDir, adminObj, devId, idNum);
    }
    await waitForServices(devId, { pgadmin, redisCommander, traefik });
    logger.log('All services are healthy and ready');
  } finally {
    cleanupRunFiles(runEnvPath, pgpassRunPath);
  }
}

/**
 * Waits for services to be healthy
 * @private
 * @param {number|string|null} [devId] - Developer ID (optional, will be loaded from config if not provided)
 * @param {Object} [opts] - Options (pgadmin, redisCommander, traefik) - which optional services to expect
 */
async function waitForServices(devId = null, opts = {}) {
  const maxAttempts = 30;
  const delay = 2000; // 2 seconds
  const { pgadmin = true, redisCommander = true, traefik = false } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const health = await checkInfraHealth(devId, { pgadmin, redisCommander, traefik });
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
 * Validates that all expected services are healthy and accessible
 *
 * @async
 * @function checkInfraHealth
 * @param {number|string|null} [devId] - Developer ID (null = use current)
 * @param {Object} [options] - Options
 * @param {boolean} [options.strict=false] - When true, only consider current dev's containers (no fallback to dev 0); use for up-miso and status consistency
 * @param {boolean} [options.postgres=true] - When false, skip Postgres (and pgAdmin) checks — for apps with requires.database: false
 * @param {boolean} [options.redis=true] - When false, skip Redis (and Redis Commander) checks — for apps with requires.redis: false
 * @param {boolean} [options.pgadmin=true] - Include pgAdmin in health check (only when Postgres is checked)
 * @param {boolean} [options.redisCommander=true] - Include Redis Commander in health check (only when Redis is checked)
 * @param {boolean} [options.traefik=false] - Include Traefik in health check
 * @returns {Promise<Object>} Health status of each service
 *
 * @example
 * const health = await checkInfraHealth();
 * // Returns: { postgres: 'healthy', redis: 'healthy', pgadmin: 'healthy', redis-commander: 'healthy' }
 */
async function checkInfraHealth(devId = null, options = {}) {
  const developerId = devId || await config.getDeveloperId();
  const includePostgres = options.postgres !== false;
  const includeRedis = options.redis !== false;
  const servicesWithHealthCheck = [];
  if (includePostgres) servicesWithHealthCheck.push('postgres');
  if (includeRedis) servicesWithHealthCheck.push('redis');
  const servicesWithoutHealthCheck = [];
  if (includePostgres && options.pgadmin !== false) servicesWithoutHealthCheck.push('pgadmin');
  if (includeRedis && options.redisCommander !== false) servicesWithoutHealthCheck.push('redis-commander');
  if (options.traefik === true) servicesWithoutHealthCheck.push('traefik');
  const health = {};
  const lookupOptions = options.strict ? { strict: true } : {};

  // Check health status for services with health checks
  for (const service of servicesWithHealthCheck) {
    health[service] = await containerUtils.checkServiceWithHealthCheck(service, developerId, lookupOptions);
  }

  // Check if optional services without health checks are running
  for (const service of servicesWithoutHealthCheck) {
    health[service] = await containerUtils.checkServiceWithoutHealthCheck(service, developerId, lookupOptions);
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
