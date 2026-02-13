/**
 * Application Dockerfile Generation
 *
 * Handles Dockerfile generation for applications
 *
 * @fileoverview Dockerfile generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const build = require('../build');
const { validateAppName } = require('./push');
const logger = require('../utils/logger');
const { getContainerPort } = require('../utils/port-resolver');

/**
 * Checks if Dockerfile exists and validates overwrite permission
 * @async
 * @param {string} dockerfilePath - Path to Dockerfile
 * @param {Object} options - Generation options
 * @throws {Error} If Dockerfile exists and force is not enabled
 */
async function checkDockerfileExists(dockerfilePath, options) {
  try {
    await fs.access(dockerfilePath);
    if (!options.force) {
      throw new Error(`Dockerfile already exists at ${dockerfilePath}. Use --force to overwrite.`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, that's okay
      return;
    }
    throw error;
  }
}

/**
 * Loads application configuration from application config (application.yaml or application.json)
 * @param {string} appPath - Application directory path
 * @param {Object} options - Generation options
 * @returns {Object} Application configuration
 * @throws {Error} If configuration cannot be loaded
 */
function loadAppConfig(appPath, options) {
  const { resolveApplicationConfigPath } = require('../utils/paths');
  const { loadConfigFile } = require('../utils/config-format');
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    const variables = loadConfigFile(configPath);
    return {
      language: options.language || variables.build?.language || 'typescript',
      port: getContainerPort(variables, 3000),
      ...variables
    };
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error.message}`);
  }
}

/**
 * Generates and copies Dockerfile to app directory
 * @async
 * @param {string} appPath - Application directory path
 * @param {string} dockerfilePath - Target Dockerfile path
 * @param {Object} config - Application configuration
 * @returns {Promise<string>} Path to generated Dockerfile
 */
async function generateAndCopyDockerfile(appPath, dockerfilePath, config) {
  // Extract buildConfig from config to pass to generateDockerfile
  const buildConfig = config.build || {};
  const generatedPath = await build.generateDockerfile(appPath, config.language, config, buildConfig);
  await fs.copyFile(generatedPath, dockerfilePath);
  logger.log(chalk.green('✓ Generated Dockerfile from template'));
  return dockerfilePath;
}

/**
 * Generate Dockerfile for an application
 * @param {string} appName - Application name
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Path to generated Dockerfile
 */
async function generateDockerfileForApp(appName, options = {}) {
  // Check if app type is external - skip Dockerfile generation
  const { detectAppType } = require('../utils/paths');
  try {
    const { isExternal } = await detectAppType(appName);
    if (isExternal) {
      logger.log(chalk.yellow('⚠️  External systems don\'t require Dockerfiles. Skipping...'));
      return null;
    }
  } catch (error) {
    // If detection fails, continue with normal generation
    // (detectAppType throws if app doesn't exist, which is fine for dockerfile command)
  }
  try {
    // Validate app name
    validateAppName(appName);

    // Detect app type and get correct path (integration or builder)
    const { appPath } = await detectAppType(appName);
    const dockerfilePath = path.join(appPath, 'Dockerfile');

    // Check if Dockerfile already exists
    await checkDockerfileExists(dockerfilePath, options);

    // Load configuration
    const config = loadAppConfig(appPath, options);

    // Generate and copy Dockerfile
    return await generateAndCopyDockerfile(appPath, dockerfilePath, config);

  } catch (error) {
    throw new Error(`Failed to generate Dockerfile: ${error.message}`);
  }
}

module.exports = {
  generateDockerfileForApp
};

