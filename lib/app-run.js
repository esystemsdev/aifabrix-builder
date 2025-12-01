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
const config = require('./config');
const logger = require('./utils/logger');
const { checkPortAvailable, waitForHealthCheck } = require('./utils/health-check');
const composeGenerator = require('./utils/compose-generator');
// Helper functions extracted to reduce file size and complexity
const helpers = require('./app-run-helpers');

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
    // Validate app name first
    if (!appName || typeof appName !== 'string') {
      throw new Error('Application name is required');
    }

    // Check if app type is external - skip Docker run
    const yaml = require('js-yaml');
    const fs = require('fs').promises;
    const path = require('path');
    const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
    try {
      const variablesContent = await fs.readFile(variablesPath, 'utf8');
      const variables = yaml.load(variablesContent);
      if (variables.app && variables.app.type === 'external') {
        logger.log(chalk.yellow('⚠️  External systems don\'t run as Docker containers.'));
        logger.log(chalk.blue('Use "aifabrix build" to deploy to dataplane, then test via OpenAPI endpoints.'));
        return;
      }
    } catch (error) {
      // If variables.yaml doesn't exist, continue with normal run
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Validate app name and load configuration
    const appConfig = await helpers.validateAppConfiguration(appName);

    // Load developer ID once from config module - it's now cached and available as config.developerId
    // Developer ID: 0 = default infra, > 0 = developer-specific
    const developerId = await config.getDeveloperId(); // Load and cache developer ID
    appConfig.developerId = developerId; // Use developer ID in config

    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Configuration loaded: port=${appConfig.port || 'default'}, healthCheck.path=${appConfig.healthCheck?.path || '/health'}, developerId=${appConfig.developerId}`));
    }

    // Check prerequisites: image and infrastructure
    await helpers.checkPrerequisites(appName, appConfig, debug);

    // Check if container is already running
    const containerRunning = await helpers.checkContainerRunning(appName, appConfig.developerId, debug);
    if (containerRunning) {
      // Dev 0: aifabrix-{appName} (no dev-0 suffix), Dev > 0: aifabrix-dev{id}-{appName}
      const idNum2 = typeof appConfig.developerId === 'string' ? parseInt(appConfig.developerId, 10) : appConfig.developerId;
      const containerName = idNum2 === 0 ? `aifabrix-${appName}` : `aifabrix-dev${appConfig.developerId}-${appName}`;
      logger.log(chalk.yellow(`Container ${containerName} is already running`));
      await helpers.stopAndRemoveContainer(appName, appConfig.developerId, debug);
    }

    // Calculate host port: use dev-specific port offset if not overridden
    // IMPORTANT: Container port (for Dockerfile) stays unchanged from appConfig.port
    const basePort = appConfig.port || 3000;
    const idNum3 = typeof appConfig.developerId === 'string' ? parseInt(appConfig.developerId, 10) : appConfig.developerId;
    const hostPort = options.port || (idNum3 === 0 ? basePort : basePort + (idNum3 * 100));
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

    // Prepare environment: ensure .env file and generate Docker Compose
    const tempComposePath = await helpers.prepareEnvironment(appName, appConfig, options);
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Compose file generated: ${tempComposePath}`));
    }

    try {
      // Start container and wait for health check
      await helpers.startContainer(appName, tempComposePath, hostPort, appConfig, debug);

      // Display success message
      await helpers.displayRunStatus(appName, hostPort, appConfig);

    } catch (error) {
      // Keep the compose file for debugging - don't delete on error
      logger.log(chalk.yellow(`\n⚠️  Compose file preserved at: ${tempComposePath}`));
      logger.log(chalk.yellow('   Review the file to debug issues'));
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Error during container start: ${error.message}`));
      }
      throw error;
    }

  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Run failed: ${error.message}`));
    }
    throw new Error(`Failed to run application: ${error.message}`);
  }
}
module.exports = {
  runApp,
  checkImageExists: helpers.checkImageExists,
  checkContainerRunning: helpers.checkContainerRunning,
  stopAndRemoveContainer: helpers.stopAndRemoveContainer,
  checkPortAvailable,
  generateDockerCompose: composeGenerator.generateDockerCompose,
  waitForHealthCheck
};
