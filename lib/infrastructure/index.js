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

const path = require('path');
const fs = require('fs');
const config = require('../core/config');
const devConfig = require('../utils/dev-config');
const logger = require('../utils/logger');
const dockerUtils = require('../utils/docker');
const statusHelpers = require('../utils/infra-status');
const {
  getInfraProjectName,
  checkDockerAvailability,
  ensureAdminSecrets,
  prepareInfraDirectory,
  resolveInfraStatePaths,
  ensureMisoInitScript,
  registerHandlebarsHelper
} = require('./helpers');
const secretsEnsure = require('../core/secrets-ensure');
const {
  buildTraefikConfig,
  validateTraefikConfig,
  generateComposeFile
} = require('./compose');
const {
  execAsyncWithCwd,
  startDockerServicesAndConfigure,
  checkInfraHealth
} = require('./services');
const adminSecrets = require('../core/admin-secrets');
// Lazy require to avoid circular dependency: infra -> app/down -> run-helpers -> infra

/**
 * Runs a callback with a temporary .env.run file in infraDir (created from admin-secrets).
 * Removes the file in a finally block.
 * @async
 * @param {string} infraDir - Infrastructure directory path
 * @param {string} adminSecretsPath - Path to admin-secrets.env
 * @param {function(string): Promise<void>} fn - Callback receiving runEnvPath
 * @returns {Promise<void>}
 */
async function withRunEnv(infraDir, adminSecretsPath, fn) {
  const runEnvPath = path.join(infraDir, '.env.run');
  try {
    const adminObj = await adminSecrets.readAndDecryptAdminSecrets(adminSecretsPath);
    const content = adminSecrets.envObjectToContent(adminObj);
    fs.writeFileSync(runEnvPath, content, { mode: 0o600 });
    await fn(runEnvPath);
  } finally {
    try {
      if (fs.existsSync(runEnvPath)) fs.unlinkSync(runEnvPath);
    } catch {
      // Ignore unlink errors
    }
  }
}

/**
 * Prepares infrastructure environment
 * Ensures infra secrets exist, then admin-secrets.env, then miso init script.
 *
 * @async
 * @function prepareInfrastructureEnvironment
 * @param {string|number|null} developerId - Developer ID
 * @param {Object} [options] - Options (traefik, adminPwd, tlsEnabled)
 * @returns {Promise<Object>} Prepared environment configuration
 */
async function prepareInfrastructureEnvironment(developerId, options = {}) {
  await checkDockerAvailability();
  const adminPass = options.adminPassword || options.adminPwd;
  const tlsEnabled = options.tlsEnabled === true;
  const infraOpts = {
    adminPassword: adminPass,
    adminPwd: adminPass,
    adminEmail: options.adminEmail,
    userPassword: options.userPassword,
    tlsEnabled
  };
  await secretsEnsure.ensureInfraSecrets(infraOpts);
  const adminSecretsPath = await ensureAdminSecrets(infraOpts);

  const devId = developerId || await config.getDeveloperId();
  const remoteServer = await config.getRemoteServer();
  const {
    assertRemoteBuilderDeveloperId,
    remoteServerHostIsNonLocalhost
  } = require('../utils/remote-builder-validation');
  assertRemoteBuilderDeveloperId(remoteServer, devId);

  const devIdNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  const ports = devConfig.getDevPorts(devIdNum);
  const idNum = devIdNum;
  const trustForwardedHeaders = remoteServerHostIsNonLocalhost(remoteServer);

  const templatePath = path.join(__dirname, '..', '..', 'templates', 'infra', 'compose.yaml.hbs');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Compose template not found: ${templatePath}`);
  }

  // Prepare infrastructure directory
  const { infraDir } = await prepareInfraDirectory(devId, adminSecretsPath);
  await ensureMisoInitScript(infraDir);

  return { devId, idNum, ports, templatePath, infraDir, adminSecretsPath, trustForwardedHeaders };
}

/**
 * Starts local infrastructure services
 * Launches Postgres, Redis, pgAdmin, and Redis Commander in Docker containers
 *
 * @async
 * @function startInfra
 * @param {number|string|null} developerId - Developer ID (null = use current)
 * @param {Object} [options] - Infrastructure options
 * @param {boolean} [options.traefik=false] - Include Traefik service
 * @returns {Promise<void>} Resolves when infrastructure is started
 * @throws {Error} If Docker is not running or compose fails
 *
 * @example
 * await startInfra(null, { traefik: true });
 * // Infrastructure services are now running
 */
async function startInfra(developerId = null, options = {}) {
  const { devId, idNum, ports, templatePath, infraDir, trustForwardedHeaders } =
    await prepareInfrastructureEnvironment(developerId, options);
  const { traefik = false, pgadmin = true, redisCommander = true } = options;
  const traefikConfig = { ...buildTraefikConfig(traefik), trustForwardedHeaders };
  const validation = validateTraefikConfig(traefikConfig);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  // Register Handlebars helper
  registerHandlebarsHelper();

  // Generate compose file
  const composePath = generateComposeFile(templatePath, devId, idNum, ports, infraDir, {
    traefik: traefikConfig,
    pgadmin: { enabled: !!pgadmin },
    redisCommander: { enabled: !!redisCommander }
  });

  try {
    await startDockerServicesAndConfigure(composePath, devId, idNum, infraDir, {
      pgadmin: !!pgadmin,
      redisCommander: !!redisCommander,
      traefik: !!traefik
    });
  } finally {
    // Keep the compose file for stop commands
  }
}

/**
 * Stops and removes all app containers for the current developer (same network).
 * @param {string} devId - Developer ID
 * @returns {Promise<void>}
 */
async function stopAllAppContainers(devId) {
  const containerNames = await statusHelpers.listAppContainerNamesForDeveloper(devId, { includeExited: true });
  for (const name of containerNames) {
    try {
      await execAsyncWithCwd(`docker rm -f ${name}`);
      logger.log(`Stopped and removed container: ${name}`);
    } catch (err) {
      logger.log(`Container ${name} not running or already removed`);
    }
  }
}

/**
 * Removes Docker volumes for the given app names (current developer).
 * @param {string[]} appNames - Application names
 * @param {string} devId - Developer ID
 * @returns {Promise<void>}
 */
async function removeAppVolumes(appNames, devId) {
  const { getAppVolumeName } = require('../app/down');
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  for (const appName of appNames) {
    const primaryName = getAppVolumeName(appName, devId);
    const legacyDev0Name = idNum === 0 ? `aifabrix_dev0_${appName}_data` : null;
    const candidates = Array.from(new Set([primaryName, legacyDev0Name].filter(Boolean)));
    for (const volumeName of candidates) {
      try {
        await execAsyncWithCwd(`docker volume rm -f ${volumeName}`);
        logger.log(`Removed volume: ${volumeName}`);
      } catch {
        logger.log(`Volume ${volumeName} not found or already removed`);
      }
    }
  }
}

/**
 * Stops and removes local infrastructure services and all application containers
 * on the same network. Cleanly shuts down infra and app containers.
 *
 * @async
 * @function stopInfra
 * @returns {Promise<void>} Resolves when infrastructure is stopped
 * @throws {Error} If Docker compose fails
 *
 * @example
 * await stopInfra();
 * // All infrastructure and app containers on the same network are stopped and removed
 */
async function stopInfra() {
  const devId = await config.getDeveloperId();
  const { infraDir, adminSecretsPath } = resolveInfraStatePaths(devId);
  const composePath = path.join(infraDir, 'compose.yaml');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    logger.log('Infrastructure not running or not properly configured');
    return;
  }

  await withRunEnv(infraDir, adminSecretsPath, async(runEnvPath) => {
    logger.log('Stopping application containers on the same network...');
    await stopAllAppContainers(devId);
    logger.log('Stopping infrastructure services...');
    const projectName = getInfraProjectName(devId);
    const composeCmd = await dockerUtils.getComposeCommand();
    await execAsyncWithCwd(`${composeCmd} -f "${composePath}" -p ${projectName} --env-file "${runEnvPath}" down`, { cwd: infraDir });
    logger.log('Infrastructure services stopped');
  });
}

/**
 * Stops all app containers on the network and removes their volumes.
 * @param {string} devId - Developer ID
 * @returns {Promise<void>}
 */
async function stopAllAppContainersAndVolumes(devId) {
  const devIdNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  const containerNames = await statusHelpers.listAppContainerNamesForDeveloper(devId, { includeExited: true });
  for (const name of containerNames) {
    try {
      await execAsyncWithCwd(`docker rm -f ${name}`);
      logger.log(`Stopped and removed container: ${name}`);
    } catch (err) {
      logger.log(`Container ${name} not running or already removed`);
    }
  }
  const appNames = [...new Set(
    containerNames
      .map(n => statusHelpers.extractAppName(n, devIdNum, devId))
      .filter(Boolean)
  )];
  if (appNames.length > 0) {
    logger.log('Removing application volumes...');
    await removeAppVolumes(appNames, devId);
  }
}

/**
 * Stops and removes local infrastructure services and all application containers
 * on the same network, and removes all volumes (infra and app data).
 *
 * @async
 * @function stopInfraWithVolumes
 * @returns {Promise<void>} Resolves when infrastructure is stopped and volumes removed
 * @throws {Error} If Docker compose fails
 *
 * @example
 * await stopInfraWithVolumes();
 * // All infrastructure and app containers and volumes are removed
 */
async function stopInfraWithVolumes() {
  const devId = await config.getDeveloperId();
  const { infraDir, adminSecretsPath } = resolveInfraStatePaths(devId);
  const composePath = path.join(infraDir, 'compose.yaml');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    logger.log('Infrastructure not running or not properly configured');
    return;
  }

  await withRunEnv(infraDir, adminSecretsPath, async(runEnvPath) => {
    logger.log('Stopping application containers on the same network...');
    await stopAllAppContainersAndVolumes(devId);
    logger.log('Stopping infrastructure services and removing all data...');
    const projectName = getInfraProjectName(devId);
    const composeCmd = await dockerUtils.getComposeCommand();
    await execAsyncWithCwd(`${composeCmd} -f "${composePath}" -p ${projectName} --env-file "${runEnvPath}" down -v`, { cwd: infraDir });
    logger.log('Infrastructure services stopped and all data removed');
  });
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
  const validServices = ['postgres', 'redis', 'pgadmin', 'redis-commander', 'traefik'];
  if (!validServices.includes(serviceName)) {
    throw new Error(`Invalid service name. Must be one of: ${validServices.join(', ')}`);
  }

  const devId = await config.getDeveloperId();
  const { infraDir, adminSecretsPath } = resolveInfraStatePaths(devId);
  const composePath = path.join(infraDir, 'compose.yaml');

  if (!fs.existsSync(composePath) || !fs.existsSync(adminSecretsPath)) {
    throw new Error('Infrastructure not properly configured');
  }

  await withRunEnv(infraDir, adminSecretsPath, async(runEnvPath) => {
    logger.log(`Restarting ${serviceName} service...`);
    const projectName = getInfraProjectName(devId);
    const composeCmd = await dockerUtils.getComposeCommand();
    await execAsyncWithCwd(`${composeCmd} -f "${composePath}" -p ${projectName} --env-file "${runEnvPath}" restart ${serviceName}`, { cwd: infraDir });
    logger.log(`${serviceName} service restarted successfully`);
  });
}

// Re-export status helper functions
const getInfraStatus = statusHelpers.getInfraStatus;
const getAppStatus = statusHelpers.getAppStatus;

module.exports = {
  startInfra,
  stopInfra,
  stopInfraWithVolumes,
  checkInfraHealth,
  getInfraStatus,
  getAppStatus,
  restartService,
  ensureAdminSecrets
};
