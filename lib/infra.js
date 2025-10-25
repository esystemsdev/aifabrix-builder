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

const execAsync = promisify(exec);

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
    console.log('Generating admin-secrets.env...');
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

  const template = fs.readFileSync(templatePath, 'utf8');
  const tempComposePath = path.join(os.tmpdir(), 'aifabrix-compose.yaml');
  fs.writeFileSync(tempComposePath, template);

  try {
    console.log('Starting infrastructure services...');
    await execAsync(`docker-compose -f "${tempComposePath}" --env-file "${adminSecretsPath}" up -d`);
    console.log('Infrastructure services started successfully');

    await waitForServices();
    console.log('All services are healthy and ready');
  } finally {
    if (fs.existsSync(tempComposePath)) {
      fs.unlinkSync(tempComposePath);
    }
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
  const templatePath = path.join(__dirname, '..', 'templates', 'infra', 'compose.yaml');
  const adminSecretsPath = path.join(os.homedir(), '.aifabrix', 'admin-secrets.env');

  if (!fs.existsSync(templatePath) || !fs.existsSync(adminSecretsPath)) {
    console.log('Infrastructure not running or not properly configured');
    return;
  }

  const tempComposePath = path.join(os.tmpdir(), 'aifabrix-compose.yaml');
  fs.writeFileSync(tempComposePath, fs.readFileSync(templatePath, 'utf8'));

  try {
    console.log('Stopping infrastructure services...');
    await execAsync(`docker-compose -f "${tempComposePath}" --env-file "${adminSecretsPath}" down`);
    console.log('Infrastructure services stopped');
  } finally {
    if (fs.existsSync(tempComposePath)) {
      fs.unlinkSync(tempComposePath);
    }
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
  const templatePath = path.join(__dirname, '..', 'templates', 'infra', 'compose.yaml');
  const adminSecretsPath = path.join(os.homedir(), '.aifabrix', 'admin-secrets.env');

  if (!fs.existsSync(templatePath) || !fs.existsSync(adminSecretsPath)) {
    console.log('Infrastructure not running or not properly configured');
    return;
  }

  const tempComposePath = path.join(os.tmpdir(), 'aifabrix-compose.yaml');
  fs.writeFileSync(tempComposePath, fs.readFileSync(templatePath, 'utf8'));

  try {
    console.log('Stopping infrastructure services and removing all data...');
    await execAsync(`docker-compose -f "${tempComposePath}" --env-file "${adminSecretsPath}" down -v`);
    console.log('Infrastructure services stopped and all data removed');
  } finally {
    if (fs.existsSync(tempComposePath)) {
      fs.unlinkSync(tempComposePath);
    }
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
  const services = ['postgres', 'redis', 'pgadmin', 'redis-commander'];
  const health = {};

  for (const service of services) {
    try {
      const { stdout } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' aifabrix-${service}`);
      health[service] = stdout.trim();
    } catch (error) {
      health[service] = 'unknown';
    }
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
      const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}' aifabrix-${serviceName}`);
      status[serviceName] = {
        status: stdout.trim(),
        port: config.port,
        url: config.url
      };
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

  const templatePath = path.join(__dirname, '..', 'templates', 'infra', 'compose.yaml');
  const adminSecretsPath = path.join(os.homedir(), '.aifabrix', 'admin-secrets.env');

  if (!fs.existsSync(templatePath) || !fs.existsSync(adminSecretsPath)) {
    throw new Error('Infrastructure not properly configured');
  }

  const tempComposePath = path.join(os.tmpdir(), 'aifabrix-compose.yaml');
  fs.writeFileSync(tempComposePath, fs.readFileSync(templatePath, 'utf8'));

  try {
    console.log(`Restarting ${serviceName} service...`);
    await execAsync(`docker-compose -f "${tempComposePath}" --env-file "${adminSecretsPath}" restart ${serviceName}`);
    console.log(`${serviceName} service restarted successfully`);
  } finally {
    if (fs.existsSync(tempComposePath)) {
      fs.unlinkSync(tempComposePath);
    }
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

    if (attempt < maxAttempts) {
      console.log(`Waiting for services to be healthy... (${attempt}/${maxAttempts})`);
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
  restartService
};
