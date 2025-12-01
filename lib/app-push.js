/**
 * Application Push Utilities
 *
 * Handles pushing Docker images to container registries
 *
 * @fileoverview Push functionality for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');
const pushUtils = require('./push');
const logger = require('./utils/logger');

/**
 * Validate application name format
 * @param {string} appName - Application name to validate
 * @throws {Error} If app name is invalid
 */
function validateAppName(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required');
  }

  // App name should be lowercase, alphanumeric with dashes, 3-40 characters
  const nameRegex = /^[a-z0-9-]{3,40}$/;
  if (!nameRegex.test(appName)) {
    throw new Error('Application name must be 3-40 characters, lowercase letters, numbers, and dashes only');
  }

  // Cannot start or end with dash
  if (appName.startsWith('-') || appName.endsWith('-')) {
    throw new Error('Application name cannot start or end with a dash');
  }

  // Cannot have consecutive dashes
  if (appName.includes('--')) {
    throw new Error('Application name cannot have consecutive dashes');
  }
}

/**
 * Extracts image name from configuration using the same logic as build command
 * @param {Object} config - Configuration object from variables.yaml
 * @param {string} appName - Application name (fallback)
 * @returns {string} Image name
 */
function extractImageName(config, appName) {
  if (typeof config.image === 'string') {
    return config.image.split(':')[0];
  } else if (config.image?.name) {
    return config.image.name;
  } else if (config.app?.key) {
    return config.app.key;
  }
  return appName;

}

/**
 * Loads push configuration from variables.yaml
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Push options
 * @returns {Promise<Object>} Configuration with registry and imageName
 * @throws {Error} If configuration cannot be loaded
 */
async function loadPushConfig(appName, options) {
  const configPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
  try {
    const config = yaml.load(await fs.readFile(configPath, 'utf8'));
    const registry = options.registry || config.image?.registry;
    if (!registry) {
      throw new Error('Registry URL is required. Provide via --registry flag or configure in variables.yaml under image.registry');
    }
    const imageName = extractImageName(config, appName);
    return { registry, imageName };
  } catch (error) {
    if (error.message.includes('Registry URL')) {
      throw error;
    }
    throw new Error(`Failed to load configuration: ${configPath}\nRun 'aifabrix create ${appName}' first`);
  }
}

/**
 * Validates push configuration
 * @param {string} registry - Registry URL
 * @param {string} imageName - Image name (from config)
 * @param {string} appName - Application name (for error messages)
 * @throws {Error} If validation fails
 */
async function validatePushConfig(registry, imageName, appName) {
  // Validate ACR URL format specifically (must be *.azurecr.io)
  if (!/^[^.]+\.azurecr\.io$/.test(registry)) {
    throw new Error(`Invalid ACR URL format: ${registry}. Expected format: *.azurecr.io`);
  }

  if (!pushUtils.validateRegistryURL(registry)) {
    throw new Error(`Invalid registry URL format: ${registry}. Expected format: *.azurecr.io`);
  }

  if (!await pushUtils.checkLocalImageExists(imageName, 'latest')) {
    throw new Error(`Docker image ${imageName}:latest not found locally.\nRun 'aifabrix build ${appName}' first`);
  }

  if (!await pushUtils.checkAzureCLIInstalled()) {
    throw new Error('Azure CLI is not installed. Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
  }
}

/**
 * Authenticates with Azure Container Registry
 * @async
 * @param {string} registry - Registry URL
 */
async function authenticateWithRegistry(registry) {
  if (await pushUtils.checkACRAuthentication(registry)) {
    logger.log(chalk.green(`✓ Already authenticated with ${registry}`));
  } else {
    await pushUtils.authenticateACR(registry);
  }
}

/**
 * Pushes image tags to registry
 * @async
 * @param {string} imageName - Image name (from config)
 * @param {string} registry - Registry URL
 * @param {Array<string>} tags - Image tags
 */
async function pushImageTags(imageName, registry, tags) {
  try {
    await Promise.all(tags.map(async(tag) => {
      await pushUtils.tagImage(`${imageName}:latest`, `${registry}/${imageName}:${tag}`);
      await pushUtils.pushImage(`${registry}/${imageName}:${tag}`, registry);
    }));
  } catch (error) {
    // If authentication error, try to re-authenticate and retry once
    const errorMessage = error.message || String(error);
    const isAuthError = errorMessage.includes('Authentication required') ||
                        errorMessage.includes('authentication required') ||
                        (errorMessage.includes('authentication') && errorMessage.includes('401'));

    if (isAuthError) {
      logger.log(chalk.yellow('⚠ Authentication expired, re-authenticating...'));
      await authenticateWithRegistry(registry);
      // Retry push after re-authentication
      await Promise.all(tags.map(async(tag) => {
        await pushUtils.pushImage(`${registry}/${imageName}:${tag}`, registry);
      }));
    } else {
      throw error;
    }
  }
}

/**
 * Displays push results
 * @param {string} registry - Registry URL
 * @param {string} imageName - Image name (from config)
 * @param {Array<string>} tags - Image tags
 */
function displayPushResults(registry, imageName, tags) {
  logger.log(chalk.green(`\n✓ Successfully pushed ${tags.length} tag(s) to ${registry}`));
  logger.log(chalk.gray(`Image: ${registry}/${imageName}:*`));
  logger.log(chalk.gray(`Tags: ${tags.join(', ')}`));
}

/**
 * Pushes application image to Azure Container Registry
 * @async
 * @function pushApp
 * @param {string} appName - Name of the application
 * @param {Object} options - Push options (registry, tag)
 * @returns {Promise<void>} Resolves when push is complete
 */
async function pushApp(appName, options = {}) {
  // Check if app type is external - skip push
  const configPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
  try {
    const yamlContent = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(yamlContent);
    if (config.app && config.app.type === 'external') {
      logger.log(chalk.yellow('⚠️  External systems don\'t require Docker images. Skipping push...'));
      return;
    }
  } catch (error) {
    // If variables.yaml doesn't exist, continue with normal push
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  try {
    // Validate app name
    validateAppName(appName);

    // Load configuration
    const { registry, imageName } = await loadPushConfig(appName, options);

    // Validate push configuration
    await validatePushConfig(registry, imageName, appName);

    // Authenticate with registry
    await authenticateWithRegistry(registry);

    // Push image tags
    const tags = options.tag ? options.tag.split(',').map(t => t.trim()) : ['latest'];
    await pushImageTags(imageName, registry, tags);

    // Display results
    displayPushResults(registry, imageName, tags);

  } catch (error) {
    throw new Error(`Failed to push application: ${error.message}`);
  }
}

module.exports = {
  pushApp,
  validateAppName
};

