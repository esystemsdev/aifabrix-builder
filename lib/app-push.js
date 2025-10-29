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
 * Pushes application image to Azure Container Registry
 * @async
 * @function pushApp
 * @param {string} appName - Name of the application
 * @param {Object} options - Push options (registry, tag)
 * @returns {Promise<void>} Resolves when push is complete
 */
async function pushApp(appName, options = {}) {
  try {
    // Validate app name
    validateAppName(appName);

    const configPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
    let config;
    try {
      config = yaml.load(await fs.readFile(configPath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to load configuration: ${configPath}\nRun 'aifabrix create ${appName}' first`);
    }

    const registry = options.registry || config.image?.registry;
    if (!registry) {
      throw new Error('Registry URL is required. Provide via --registry flag or configure in variables.yaml under image.registry');
    }

    if (!pushUtils.validateRegistryURL(registry)) {
      throw new Error(`Invalid registry URL format: ${registry}. Expected format: *.azurecr.io`);
    }

    const tags = options.tag ? options.tag.split(',').map(t => t.trim()) : ['latest'];

    if (!await pushUtils.checkLocalImageExists(appName, 'latest')) {
      throw new Error(`Docker image ${appName}:latest not found locally.\nRun 'aifabrix build ${appName}' first`);
    }

    if (!await pushUtils.checkAzureCLIInstalled()) {
      throw new Error('Azure CLI is not installed. Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
    }

    if (await pushUtils.checkACRAuthentication(registry)) {
      console.log(chalk.green(`✓ Already authenticated with ${registry}`));
    } else {
      await pushUtils.authenticateACR(registry);
    }

    await Promise.all(tags.map(async(tag) => {
      await pushUtils.tagImage(`${appName}:latest`, `${registry}/${appName}:${tag}`);
      await pushUtils.pushImage(`${registry}/${appName}:${tag}`);
    }));

    console.log(chalk.green(`\n✓ Successfully pushed ${tags.length} tag(s) to ${registry}`));
    console.log(chalk.gray(`Image: ${registry}/${appName}:*`));
    console.log(chalk.gray(`Tags: ${tags.join(', ')}`));

  } catch (error) {
    throw new Error(`Failed to push application: ${error.message}`);
  }
}

module.exports = {
  pushApp,
  validateAppName
};

