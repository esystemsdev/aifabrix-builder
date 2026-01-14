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
const pushUtils = require('../deployment/push');
const logger = require('../utils/logger');
const config = require('../core/config');
const { getDeploymentAuth } = require('../utils/token-manager');
const { detectAppType } = require('../utils/paths');

/**
 * Validate application name format
 * @param {string} appName - Application name to validate
 * @throws {Error} If app name is invalid
 */
function validateAppName(appName) {
  if (!appName || typeof appName !== 'string' || appName.trim().length === 0) {
    throw new Error('App name is required');
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
 * Validates push prerequisites
 * @async
 * @function validatePushPrerequisites
 * @param {string} appName - Application name
 * @param {string} registry - Registry URL
 * @throws {Error} If prerequisites are not met
 */
async function validatePushPrerequisites(appName, registry) {
  if (!pushUtils.validateRegistryURL(registry)) {
    throw new Error(`Invalid registry URL format: ${registry}. Expected format: *.azurecr.io`);
  }

  if (!await pushUtils.checkLocalImageExists(appName, 'latest')) {
    throw new Error(`Docker image ${appName}:latest not found locally.\nRun 'aifabrix build ${appName}' first`);
  }

  if (!await pushUtils.checkAzureCLIInstalled()) {
    throw new Error('Azure CLI is not installed. Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
  }
}

/**
 * Executes push operations
 * @async
 * @function executePush
 * @param {string} appName - Application name
 * @param {string} registry - Registry URL
 * @param {string[]} tags - Tags to push
 * @throws {Error} If push fails
 */
async function executePush(appName, registry, tags) {
  if (await pushUtils.checkACRAuthentication(registry)) {
    logger.log(chalk.green(`✓ Already authenticated with ${registry}`));
  } else {
    await pushUtils.authenticateACR(registry);
  }

  await Promise.all(tags.map(async(tag) => {
    await pushUtils.tagImage(`${appName}:latest`, `${registry}/${appName}:${tag}`);
    await pushUtils.pushImage(`${registry}/${appName}:${tag}`, registry);
  }));
}

/**
 * Verifies push result
 * @function verifyPushResult
 * @param {string[]} tags - Tags that were pushed
 * @param {string} registry - Registry URL
 * @param {string} appName - Application name
 */
function verifyPushResult(tags, registry, appName) {
  logger.log(chalk.green(`\n✓ Successfully pushed ${tags.length} tag(s) to ${registry}`));
  logger.log(chalk.gray(`Image: ${registry}/${appName}:*`));
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
  try {
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

    if (!/^[^.]+\.azurecr\.io$/.test(registry)) {
      throw new Error(`Invalid ACR URL format: ${registry}. Expected format: *.azurecr.io`);
    }

    const tags = options.tag ? options.tag.split(',').map(t => t.trim()) : ['latest'];

    await validatePushPrerequisites(appName, registry);
    await executePush(appName, registry, tags);
    verifyPushResult(tags, registry, appName);

  } catch (error) {
    throw new Error(`Failed to push application: ${error.message}`);
  }
}

/**
 * Validates that the application directory exists
 * @async
 * @param {string} builderPath - Path to builder directory
 * @param {string} appName - Application name
 * @throws {Error} If directory doesn't exist
 */
async function validateAppDirectory(builderPath, appName) {
  try {
    await fs.access(builderPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Application '${appName}' not found in builder/. Run 'aifabrix create ${appName}' first`);
    }
    throw error;
  }
}

/**
 * Loads variables.yaml file
 * @async
 * @param {string} variablesPath - Path to variables.yaml
 * @returns {Promise<Object>} Variables object
 * @throws {Error} If file cannot be loaded
 */
async function loadVariablesFile(variablesPath) {
  try {
    const variablesContent = await fs.readFile(variablesPath, 'utf8');
    return yaml.load(variablesContent);
  } catch (error) {
    throw new Error(`Failed to load configuration from variables.yaml: ${error.message}`);
  }
}

/**
 * Extracts deployment configuration from options and variables
 * @param {Object} options - CLI options
 * @param {Object} variables - Variables from variables.yaml
 * @returns {Object} Extracted configuration
 */
function extractDeploymentConfig(options, variables) {
  return {
    controllerUrl: options.controller || variables.deployment?.controllerUrl,
    envKey: options.environment || variables.deployment?.environment,
    poll: options.poll !== false,
    pollInterval: options.pollInterval || 5000,
    pollMaxAttempts: options.pollMaxAttempts || 60
  };
}

/**
 * Validates required deployment configuration
 * @param {Object} deploymentConfig - Deployment configuration
 * @throws {Error} If configuration is invalid
 */
function validateDeploymentConfig(deploymentConfig) {
  if (!deploymentConfig.controllerUrl) {
    throw new Error('Controller URL is required. Set it in variables.yaml or use --controller flag');
  }
  if (!deploymentConfig.auth) {
    throw new Error('Authentication is required. Run "aifabrix login" first or ensure credentials are in secrets.local.yaml');
  }
}

/**
 * Configure deployment environment settings
 * @async
 * @param {Object} options - CLI options
 * @param {Object} deploymentConfig - Deployment configuration to update
 * @returns {Promise<void>}
 */
async function configureDeploymentEnvironment(options, deploymentConfig) {
  // Update root-level environment if provided
  if (options.environment) {
    await config.setCurrentEnvironment(options.environment);
  }

  // Get current environment from root-level config
  const currentEnvironment = await config.getCurrentEnvironment();
  deploymentConfig.envKey = deploymentConfig.envKey || currentEnvironment;
}

/**
 * Refresh deployment token and configure authentication
 * @async
 * @param {string} appName - Application name
 * @param {Object} deploymentConfig - Deployment configuration to update
 * @returns {Promise<void>}
 * @throws {Error} If authentication fails
 */
async function refreshDeploymentToken(appName, deploymentConfig) {
  // Get controller URL
  if (!deploymentConfig.controllerUrl) {
    throw new Error('Controller URL is required. Set it in variables.yaml or use --controller flag');
  }

  // Get deployment authentication (device token → client token → credentials)
  try {
    const authConfig = await getDeploymentAuth(
      deploymentConfig.controllerUrl,
      deploymentConfig.envKey,
      appName
    );
    if (!authConfig || !authConfig.controller) {
      throw new Error('Invalid authentication configuration: missing controller URL');
    }
    if (!authConfig.token) {
      throw new Error('Authentication is required');
    }
    deploymentConfig.auth = authConfig;
    deploymentConfig.controllerUrl = authConfig.controller;
  } catch (error) {
    throw new Error(`Failed to get authentication: ${error.message}`);
  }
}

/**
 * Loads deployment configuration from variables.yaml and gets/refreshes token
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - CLI options
 * @returns {Promise<Object>} Deployment configuration with token
 * @throws {Error} If configuration is invalid
 */
async function loadDeploymentConfig(appName, options) {
  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appName);
  await validateAppDirectory(appPath, appName);

  const variablesPath = path.join(appPath, 'variables.yaml');
  const variables = await loadVariablesFile(variablesPath);

  const deploymentConfig = extractDeploymentConfig(options, variables);

  await configureDeploymentEnvironment(options, deploymentConfig);
  await refreshDeploymentToken(appName, deploymentConfig);

  validateDeploymentConfig(deploymentConfig);

  return deploymentConfig;
}

/**
 * Generates and validates deployment manifest
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Deployment manifest
 * @throws {Error} If generation or validation fails
 */
async function generateAndValidateManifest(appName) {
  logger.log(chalk.blue(`\n📋 Generating deployment manifest for ${appName}...`));
  const generator = require('../generator');

  // generateDeployJson already validates against schema and throws on error
  const manifestPath = await generator.generateDeployJson(appName);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

  // Additional validation for warnings (schema validation already passed)
  // Note: Schema validation happens in generateDeployJson, this is just for additional checks if needed
  return { manifest, manifestPath };
}

/**
 * Displays deployment information
 * @param {Object} manifest - Deployment manifest
 * @param {string} manifestPath - Path to manifest file
 */
function displayDeploymentInfo(manifest, manifestPath) {
  logger.log(chalk.green(`✓ Manifest generated: ${manifestPath}`));
  logger.log(chalk.blue(`   Key: ${manifest.key}`));
  logger.log(chalk.blue(`   Display Name: ${manifest.displayName}`));
  logger.log(chalk.blue(`   Image: ${manifest.image}`));
  logger.log(chalk.blue(`   Port: ${manifest.port}`));
}

/**
 * Executes deployment to controller
 * @async
 * @param {Object} manifest - Deployment manifest
 * @param {Object} deploymentConfig - Deployment configuration
 * @returns {Promise<Object>} Deployment result
 */
async function executeDeployment(manifest, deploymentConfig) {
  logger.log(chalk.blue(`\n🚀 Deploying to ${deploymentConfig.controllerUrl} (environment: ${deploymentConfig.envKey})...`));
  const deployer = require('../deployment/deployer');
  return await deployer.deployToController(
    manifest,
    deploymentConfig.controllerUrl,
    deploymentConfig.envKey,
    deploymentConfig.auth,
    {
      poll: deploymentConfig.poll,
      pollInterval: deploymentConfig.pollInterval,
      pollMaxAttempts: deploymentConfig.pollMaxAttempts
    }
  );
}

/**
 * Displays deployment results
 * @param {Object} result - Deployment result
 */
function displayDeploymentResults(result) {
  logger.log(chalk.green('\n✅ Deployment initiated successfully'));
  if (result.deploymentUrl) {
    logger.log(chalk.blue(`   URL: ${result.deploymentUrl}`));
  }
  if (result.deploymentId) {
    logger.log(chalk.blue(`   Deployment ID: ${result.deploymentId}`));
  }
  if (result.status) {
    const statusIcon = result.status.status === 'completed' ? '✅' :
      result.status.status === 'failed' ? '❌' : '⏳';
    logger.log(chalk.blue(`   Status: ${statusIcon} ${result.status.status}`));
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
 * @param {string} [options.environment] - Target environment (miso/dev/tst/pro)
 * @param {boolean} [options.poll] - Poll for deployment status
 * @param {number} [options.pollInterval] - Polling interval in milliseconds
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 *
 * @example
 * await deployApp('myapp', { controller: 'https://controller.aifabrix.ai', environment: 'dev' });
 */
async function deployApp(appName, options = {}) {
  let controllerUrl = null;
  let config = null;

  try {
    // 1. Input validation
    if (!appName || typeof appName !== 'string' || appName.trim().length === 0) {
      throw new Error('App name is required');
    }

    validateAppName(appName);

    // 2. Check if app type is external - use normal deployment flow with application-schema.json
    // External systems now deploy via miso controller as normal application (full application file)
    // The json command generates application-schema.json which is used for deployment

    // 2. Load deployment configuration
    config = await loadDeploymentConfig(appName, options);
    controllerUrl = config.controllerUrl || options.controller || 'unknown';

    // 3. Generate and validate manifest
    const { manifest, manifestPath } = await generateAndValidateManifest(appName);

    // 4. Display deployment info
    displayDeploymentInfo(manifest, manifestPath);

    // 5. Execute deployment
    const result = await executeDeployment(manifest, config);

    // 6. Display results
    displayDeploymentResults(result);

    return result;

  } catch (error) {
    // Use unified error handler from deployer
    // Check if error was already logged (from deployer.js)
    const alreadyLogged = error._logged === true;
    const url = controllerUrl || options.controller || 'unknown';

    const deployer = require('../deployment/deployer');
    // handleDeploymentErrors will log, format, and throw the error
    await deployer.handleDeploymentErrors(error, appName, url, alreadyLogged);
  }
}

module.exports = {
  pushApp,
  deployApp,
  validateAppName
};

