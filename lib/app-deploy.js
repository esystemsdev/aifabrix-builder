/**
 * AI Fabrix Builder Application Deployment Module
 *
 * Handles deployment to Miso Controller with manifest generation
 * and orchestration. Includes push to Azure Container Registry.
 *
 * @fileoverview Application deployment for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
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

/**
 * Deploys application to Miso Controller
 * Orchestrates manifest generation, key creation, and deployment
 *
 * @async
 * @function deployApp
 * @param {string} appName - Name of the application to deploy
 * @param {Object} options - Deployment options
 * @param {string} options.controller - Controller URL (required)
 * @param {string} [options.environment] - Target environment (dev/tst/pro)
 * @param {boolean} [options.poll] - Poll for deployment status
 * @param {number} [options.pollInterval] - Polling interval in milliseconds
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 *
 * @example
 * await deployApp('myapp', { controller: 'https://controller.aifabrix.ai', environment: 'dev' });
 */
async function deployApp(appName, options = {}) {
  try {
    // 1. Input validation
    if (!appName || typeof appName !== 'string') {
      throw new Error('App name is required');
    }

    validateAppName(appName);

    // 2. Load application configuration
    const builderPath = path.join(process.cwd(), 'builder', appName);
    try {
      await fs.access(builderPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Application '${appName}' not found in builder/. Run 'aifabrix create ${appName}' first`);
      }
      throw error;
    }

    // Load variables.yaml for configuration
    const variablesPath = path.join(builderPath, 'variables.yaml');
    let variables = {};
    try {
      const variablesContent = await fs.readFile(variablesPath, 'utf8');
      variables = yaml.load(variablesContent);
    } catch (error) {
      throw new Error(`Failed to load configuration from variables.yaml: ${error.message}`);
    }

    // Extract configuration with proper defaults
    const controllerUrl = options.controller || variables.deployment?.controllerUrl;
    const envKey = options.environment || variables.deployment?.environment || 'dev';
    const clientId = options.clientId || variables.deployment?.clientId;
    const clientSecret = options.clientSecret || variables.deployment?.clientSecret;

    // Validate required configuration
    if (!controllerUrl) {
      throw new Error('Controller URL is required. Set it in variables.yaml or use --controller flag');
    }
    if (!clientId || !clientSecret) {
      throw new Error('Client ID and Client Secret are required. Set them in variables.yaml or use --client-id and --client-secret flags');
    }

    // 3. Generate deployment manifest
    console.log(chalk.blue(`\n📋 Generating deployment manifest for ${appName}...`));
    const generator = require('./generator');
    const manifestPath = await generator.generateDeployJson(appName);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    // 4. Validate manifest
    const validation = generator.validateDeploymentJson(manifest);
    if (!validation.valid) {
      console.log(chalk.red('\n❌ Validation failed:'));
      validation.errors.forEach(error => console.log(chalk.red(`   • ${error}`)));
      throw new Error('Deployment manifest validation failed');
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      validation.warnings.forEach(warning => console.log(chalk.yellow(`   • ${warning}`)));
    }

    // 5. Display deployment info
    console.log(chalk.green(`✓ Manifest generated: ${manifestPath}`));
    console.log(chalk.blue(`   Key: ${manifest.key}`));
    console.log(chalk.blue(`   Display Name: ${manifest.displayName}`));
    console.log(chalk.blue(`   Image: ${manifest.image}`));
    console.log(chalk.blue(`   Port: ${manifest.port}`));

    // 6. Deploy to controller
    console.log(chalk.blue(`\n🚀 Deploying to ${controllerUrl} (environment: ${envKey})...`));
    const deployer = require('./deployer');
    const result = await deployer.deployToController(
      manifest,
      controllerUrl,
      envKey,
      clientId,
      clientSecret,
      {
        poll: options.poll !== false, // Poll by default
        pollInterval: options.pollInterval || 5000,
        pollMaxAttempts: options.pollMaxAttempts || 60
      }
    );

    // 7. Display results
    console.log(chalk.green('\n✅ Deployment initiated successfully'));
    if (result.deploymentUrl) {
      console.log(chalk.blue(`   URL: ${result.deploymentUrl}`));
    }
    if (result.deploymentId) {
      console.log(chalk.blue(`   Deployment ID: ${result.deploymentId}`));
    }
    if (result.status) {
      const statusIcon = result.status.status === 'completed' ? '✅' :
        result.status.status === 'failed' ? '❌' : '⏳';
      console.log(chalk.blue(`   Status: ${statusIcon} ${result.status.status}`));
    }

    return result;

  } catch (error) {
    throw new Error(`Failed to deploy application: ${error.message}`);
  }
}

module.exports = {
  pushApp,
  deployApp,
  validateAppName
};

