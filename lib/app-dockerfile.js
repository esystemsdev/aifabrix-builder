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
const yaml = require('js-yaml');
const build = require('./build');
const { validateAppName } = require('./app-push');
const logger = require('./utils/logger');

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
 * Loads application configuration from variables.yaml
 * @async
 * @param {string} configPath - Path to variables.yaml
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Application configuration
 * @throws {Error} If configuration cannot be loaded
 */
async function loadAppConfig(configPath, options) {
  try {
    const yamlContent = await fs.readFile(configPath, 'utf8');
    const variables = yaml.load(yamlContent);
    return {
      language: options.language || variables.build?.language || 'typescript',
      port: variables.build?.port || variables.port || 3000,
      ...variables
    };
  } catch {
    throw new Error(`Failed to load configuration from ${configPath}`);
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
  const generatedPath = await build.generateDockerfile(appPath, config.language, config);
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
  try {
    // Validate app name
    validateAppName(appName);

    const appPath = path.join(process.cwd(), 'builder', appName);
    const dockerfilePath = path.join(appPath, 'Dockerfile');

    // Check if Dockerfile already exists
    await checkDockerfileExists(dockerfilePath, options);

    // Load configuration
    const configPath = path.join(appPath, 'variables.yaml');
    const config = await loadAppConfig(configPath, options);

    // Generate and copy Dockerfile
    return await generateAndCopyDockerfile(appPath, dockerfilePath, config);

  } catch (error) {
    throw new Error(`Failed to generate Dockerfile: ${error.message}`);
  }
}

module.exports = {
  generateDockerfileForApp
};

