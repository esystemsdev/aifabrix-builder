/**
 * AI Fabrix Builder Application Run Management
 *
 * This module handles application running with Docker containers.
 * Includes Docker orchestration, health checking, and port management.
 *
 * @fileoverview Application run management for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const config = require('../core/config');
const logger = require('../utils/logger');
const { checkPortAvailable, waitForHealthCheck } = require('../utils/health-check');
const composeGenerator = require('../utils/compose-generator');
const containerHelpers = require('../utils/app-run-containers');
// Helper functions extracted to reduce file size and complexity
const helpers = require('./run-helpers');

const execAsync = promisify(exec);

/**
 * Validate app for run and check if it's an external system
 * @async
 * @param {string} appName - Application name
 * @param {boolean} _debug - Debug flag (unused)
 * @returns {Promise<boolean>} True if should continue, false if external system
 * @throws {Error} If app name is invalid
 */
async function validateAppForRun(appName, _debug) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required');
  }

  // Run only supports regular apps in builder/ (path resolution: integration first, then builder)
  const { detectAppType } = require('../utils/paths');
  try {
    const { isExternal, baseDir } = await detectAppType(appName);
    if (baseDir !== 'builder' || isExternal) {
      logger.log(chalk.yellow('⚠️  External systems don\'t run as Docker containers.'));
      logger.log(chalk.blue('Use "aifabrix build" to deploy to dataplane, then test via OpenAPI endpoints.'));
      return false;
    }
  } catch (error) {
    throw new Error(
      `Application "${appName}" not found in builder/. Only applications in builder/ can be run.\n` +
      (error.message || '')
    );
  }

  return true;
}

/**
 * Check if container is running and stop it if needed
 * @async
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID
 * @param {boolean} debug - Debug flag
 * @returns {Promise<void>}
 */
async function checkAndStopContainer(appName, developerId, debug) {
  const containerRunning = await helpers.checkContainerRunning(appName, developerId, debug);
  if (!containerRunning) {
    return;
  }

  // Dev 0: aifabrix-{appName} (no dev-0 suffix), Dev > 0: aifabrix-dev{id}-{appName}
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
  logger.log(chalk.yellow(`Container ${containerName} is already running`));
  await helpers.stopAndRemoveContainer(appName, developerId, debug);
}

/**
 * Calculate host port and validate it's available
 * @async
 * @param {Object} appConfig - Application configuration
 * @param {Object} options - Run options
 * @param {number} [options.port] - Override port
 * @param {boolean} debug - Debug flag
 * @returns {Promise<number>} Host port
 * @throws {Error} If port is not available
 */
async function calculateHostPort(appConfig, options, debug) {
  const basePort = appConfig.port || 3000;
  const idNum = typeof appConfig.developerId === 'string' ? parseInt(appConfig.developerId, 10) : appConfig.developerId;
  const hostPort = options.port || (idNum === 0 ? basePort : basePort + (idNum * 100));

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Host port: ${hostPort} (${options.port ? 'CLI override' : 'dev-specific'}), Container port: ${appConfig.build?.containerPort || appConfig.port || 3000} (unchanged)`));
  }

  const portAvailable = await checkPortAvailable(hostPort);
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Port ${hostPort} available: ${portAvailable}`));
  }

  if (!portAvailable) {
    throw new Error(`Port ${hostPort} is already in use. Try --port <alternative>`);
  }

  return hostPort;
}

/**
 * Load and configure application
 * @async
 * @param {string} appName - Application name
 * @param {boolean} debug - Debug flag
 * @returns {Promise<Object>} Application configuration with developerId
 */
async function loadAndConfigureApp(appName, debug) {
  const appConfig = await helpers.validateAppConfiguration(appName);
  const developerId = await config.getDeveloperId();
  appConfig.developerId = developerId;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Configuration loaded: port=${appConfig.port || 'default'}, healthCheck.path=${appConfig.healthCheck?.path || '/health'}, developerId=${appConfig.developerId}`));
  }

  return appConfig;
}

/**
 * Start application container and display status
 * @async
 * @param {string} appName - Application name
 * @param {string} tempComposePath - Path to compose file
 * @param {number} hostPort - Host port
 * @param {Object} appConfig - Application configuration
 * @param {boolean} debug - Debug flag
 * @throws {Error} If container start fails
 */
async function startAppContainer(appName, tempComposePath, hostPort, appConfig, debug) {
  try {
    await helpers.startContainer(appName, tempComposePath, hostPort, appConfig, debug);
    await helpers.displayRunStatus(appName, hostPort, appConfig);
  } catch (error) {
    logger.log(chalk.yellow(`\n⚠️  Compose file preserved at: ${tempComposePath}`));
    logger.log(chalk.yellow('   Review the file to debug issues'));
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Error during container start: ${error.message}`));
    }
    throw error;
  }
}

/**
 * Runs the application locally using Docker
 * Starts container with proper port mapping and environment
 *
 * @async
 * @function runApp
 * @param {string} appName - Name of the application to run
 * @param {Object} options - Run options
 * @param {number} [options.port] - Override local port
 * @param {boolean} [options.debug] - Enable debug output
 * @returns {Promise<void>} Resolves when app is running
 * @throws {Error} If run fails or app is not built
 *
 * @example
 * await runApp('myapp', { port: 3001 });
 * // Application is now running on localhost:3001
 */
async function runApp(appName, options = {}) {
  const debug = options.debug || false;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Starting run process for: ${appName}`));
    logger.log(chalk.gray(`[DEBUG] Options: ${JSON.stringify(options, null, 2)}`));
  }

  try {
    // Validate app for run and check if external
    const shouldContinue = await validateAppForRun(appName, debug);
    if (!shouldContinue) {
      return;
    }

    // Load and configure application
    const appConfig = await loadAndConfigureApp(appName, debug);

    // Check prerequisites: image and (unless skipped) infrastructure
    await helpers.checkPrerequisites(appName, appConfig, debug, options.skipInfraCheck === true);

    // Check if container is already running and stop it if needed
    await checkAndStopContainer(appName, appConfig.developerId, debug);

    // Calculate host port and validate it's available
    const hostPort = await calculateHostPort(appConfig, options, debug);

    // Prepare environment: ensure .env file and generate Docker Compose
    const tempComposePath = await helpers.prepareEnvironment(appName, appConfig, options);
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Compose file generated: ${tempComposePath}`));
    }

    // Start container and display status
    await startAppContainer(appName, tempComposePath, hostPort, appConfig, debug);

  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Run failed: ${error.message}`));
    }
    throw new Error(`Failed to run application: ${error.message}`);
  }
}

/**
 * Restart a running application container (Docker restart).
 * Only applies to apps in builder/ run via aifabrix run.
 *
 * @async
 * @function restartApp
 * @param {string} appName - Application name (must be running)
 * @returns {Promise<void>} Resolves when container is restarted
 * @throws {Error} If app name is invalid, container not found, or restart fails
 *
 * @example
 * await restartApp('myapp');
 */
async function restartApp(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required and must be a string');
  }
  const developerId = await config.getDeveloperId();
  const containerName = containerHelpers.getContainerName(appName, developerId);
  try {
    await execAsync(`docker restart ${containerName}`);
  } catch (error) {
    const msg = (error.stderr || error.stdout || error.message || '').toLowerCase();
    if (msg.includes('no such container') || msg.includes('is not running')) {
      throw new Error(`Application '${appName}' is not running. Start it with: aifabrix run ${appName}`);
    }
    throw new Error(`Failed to restart application: ${error.message}`);
  }
}

module.exports = {
  runApp,
  restartApp,
  checkImageExists: helpers.checkImageExists,
  checkContainerRunning: helpers.checkContainerRunning,
  stopAndRemoveContainer: helpers.stopAndRemoveContainer,
  checkPortAvailable,
  generateDockerCompose: composeGenerator.generateDockerCompose,
  waitForHealthCheck
};
