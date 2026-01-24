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
const paths = require('../utils/paths');
const statusHelpers = require('../utils/infra-status');
const {
  getInfraDirName,
  getInfraProjectName,
  checkDockerAvailability,
  ensureAdminSecrets,
  prepareInfraDirectory,
  registerHandlebarsHelper
} = require('./helpers');
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

/**
 * Prepares infrastructure environment
 * @async
 * @function prepareInfrastructureEnvironment
 * @param {string|number|null} developerId - Developer ID
 * @returns {Promise<Object>} Prepared environment configuration
 */
async function prepareInfrastructureEnvironment(developerId) {
  await checkDockerAvailability();
  const adminSecretsPath = await ensureAdminSecrets();

  const devId = developerId || await config.getDeveloperId();
  const devIdNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  const ports = devConfig.getDevPorts(devIdNum);
  const idNum = devIdNum;

  const templatePath = path.join(__dirname, '..', '..', 'templates', 'infra', 'compose.yaml.hbs');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Compose template not found: ${templatePath}`);
  }

  // Prepare infrastructure directory
  const { infraDir } = prepareInfraDirectory(devId, adminSecretsPath);

  return { devId, idNum, ports, templatePath, infraDir, adminSecretsPath };
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
  const { devId, idNum, ports, templatePath, infraDir, adminSecretsPath } = await prepareInfrastructureEnvironment(developerId);
  const { traefik = false } = options;
  const traefikConfig = buildTraefikConfig(traefik);
  const validation = validateTraefikConfig(traefikConfig);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  // Register Handlebars helper
  registerHandlebarsHelper();

  // Generate compose file
  const composePath = generateComposeFile(templatePath, devId, idNum, ports, infraDir, { traefik: traefikConfig });

  try {
    await startDockerServicesAndConfigure(composePath, devId, idNum, adminSecretsPath, infraDir);
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
