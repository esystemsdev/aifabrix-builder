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

    // Check if Dockerfile already exists
    const dockerfilePath = path.join(appPath, 'Dockerfile');
    let dockerfileExists = false;
    try {
      await fs.access(dockerfilePath);
      dockerfileExists = true;
    } catch {
      // File doesn't exist, that's okay
    }

    if (dockerfileExists && !options.force) {
      throw new Error(`Dockerfile already exists at ${dockerfilePath}. Use --force to overwrite.`);
    }

    // Load configuration
    const configPath = path.join(appPath, 'variables.yaml');
    let config;
    try {
      const yamlContent = await fs.readFile(configPath, 'utf8');
      const variables = yaml.load(yamlContent);
      config = {
        language: options.language || variables.build?.language || 'typescript',
        port: variables.build?.port || variables.port || 3000,
        ...variables
      };
    } catch {
      throw new Error(`Failed to load configuration from ${configPath}`);
    }

    // Generate Dockerfile
    const generatedPath = await build.generateDockerfile(appPath, config.language, config);

    // Copy to appPath/Dockerfile
    const sourcePath = generatedPath;
    await fs.copyFile(sourcePath, dockerfilePath);

    logger.log(chalk.green('✓ Generated Dockerfile from template'));

    return dockerfilePath;

  } catch (error) {
    throw new Error(`Failed to generate Dockerfile: ${error.message}`);
  }
}

module.exports = {
  generateDockerfileForApp
};

