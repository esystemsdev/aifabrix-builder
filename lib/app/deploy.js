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
const chalk = require('chalk');
const pushUtils = require('../deployment/push');
const logger = require('../utils/logger');
const { detectAppType, getBuilderPath, getIntegrationPath } = require('../utils/paths');
const { checkApplicationExists } = require('../utils/app-existence');
const { loadDeploymentConfig } = require('./deploy-config');
const { logOfflinePathWhenType } = require('../utils/cli-utils');
const { displayAppUrlFromController } = require('./deploy-status-display');

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

    const { getBuilderPath, resolveApplicationConfigPath } = require('../utils/paths');
    const { loadConfigFile } = require('../utils/config-format');
    const builderPath = getBuilderPath(appName);
    let config;
    try {
      const configPath = resolveApplicationConfigPath(builderPath);
      config = loadConfigFile(configPath);
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}\nRun 'aifabrix create ${appName}' first`);
    }

    const registry = options.registry || config.image?.registry;
    if (!registry) {
      throw new Error('Registry URL is required. Provide via --registry flag or configure in application.yaml under image.registry');
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
 * Generates and validates deployment manifest
 * @async
 * @param {string} appName - Application name
 * @param {Object} [options] - Deployment options (type: 'app' | 'external' for path resolution)
 * @returns {Promise<Object>} Deployment manifest
 * @throws {Error} If generation or validation fails
 */
async function generateAndValidateManifest(appName, options = {}) {
  logger.log(chalk.blue(`\n📋 Generating deployment manifest for ${appName}...`));
  const generator = require('../generator');

  // generateDeployJson already validates against schema and throws on error
  const manifestPath = await generator.generateDeployJson(appName, options);
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
 * Check if app is external (resolved from integration/) and handle external deployment.
 * Path resolution order: integration first, then builder; no flag overrides.
 * @async
 * @function handleExternalDeployment
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options (poll, etc.)
 * @returns {Promise<Object|null>} Deployment result if external, null otherwise
 */
async function handleExternalDeployment(appName, options) {
  const { isExternal } = await detectAppType(appName);
  if (isExternal) {
    const externalDeploy = require('../external-system/deploy');
    await externalDeploy.deployExternalSystem(appName, options);
    return { success: true, type: 'external' };
  }
  return null;
}

/**
 * Handle deployment errors
 * @async
 * @function handleDeploymentError
 * @param {Error} error - Error that occurred
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL (from config, or null if not yet resolved)
 * @param {boolean} usedExternalDeploy - Whether external deployment was used
 */
async function handleDeploymentError(error, appName, controllerUrl, usedExternalDeploy) {
  if (usedExternalDeploy) {
    throw error;
  }
  const alreadyLogged = error._logged === true;
  const url = controllerUrl || 'unknown';
  const deployer = require('../deployment/deployer');
  await deployer.handleDeploymentErrors(error, appName, url, alreadyLogged);
}

/**
 * Validates that the deployment image reference is pullable (includes a registry).
 * A local ref (name:tag) causes "docker: not found" on the controller host.
 * @param {string} imageRef - Image reference from manifest
 * @param {string} appName - Application name (for error hint)
 * @throws {Error} If image is missing or has no registry
 */
function validateImageIsPullable(imageRef, appName) {
  if (!imageRef || !imageRef.includes('/')) {
    const hint = `Set image.registry and image.tag in builder/${appName}/application.yaml, or pass a full image ref (e.g. --image <registry>/${appName}:<tag>) when deploying`;
    throw new Error(
      `Deployed image must be pullable (include a registry). Current image: "${imageRef || 'none'}". ${hint}`
    );
  }
}

/**
 * Throws an error when deployment status is failed or cancelled
 * @param {string} status - Status value
 * @param {Object} statusObj - Full status object from result
 * @throws {Error}
 */
function throwIfDeploymentFailed(status, statusObj) {
  if (status !== 'failed' && status !== 'cancelled') return;
  const msg =
    statusObj.message ||
    statusObj.error ||
    (status === 'cancelled' ? 'Deployment cancelled' : 'Deployment failed');
  const err = new Error(`Deployment ${status}: ${msg}`);
  err.formatted = `Deployment ${status}.\n\n${msg}`;
  err.deploymentStatus = statusObj;
  throw err;
}

/**
 * Enhances 401 error with rotate-secret hint when app exists
 * @param {Error} error - Caught error
 * @param {boolean} appExists - Whether app exists in controller
 * @param {string} appName - Application name
 * @param {string} envKey - Environment key
 * @throws {Error} Enhanced or original error
 */
function enhanceAuthErrorIfNeeded(error, appExists, appName, envKey) {
  if (!appExists || error.status !== 401 || error.message.includes('rotate-secret')) {
    throw error;
  }
  const enhancedError = new Error(
    `${error.message}\n\n💡 The application '${appName}' exists in environment '${envKey}'. ` +
      `To fix invalid credentials, rotate the application secret:\n   aifabrix app rotate-secret ${appName}`
  );
  enhancedError.status = 401;
  enhancedError.formatted = error.formatted || enhancedError.message;
  throw enhancedError;
}

/**
 * Apply image/registry overrides from options to manifest
 * @param {Object} manifest - Deployment manifest
 * @param {Object} options - Deployment options
 */
function applyManifestOverrides(manifest, options) {
  if (options.imageOverride || options.image) {
    manifest.image = options.imageOverride || options.image;
  }
  if (options.registryMode) {
    manifest.registryMode = options.registryMode;
  }
}

/**
 * Execute standard application deployment flow
 * @async
 * @function executeStandardDeployment
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment result
 */
async function executeStandardDeployment(appName, options) {
  const config = await loadDeploymentConfig(appName, options);
  logOfflinePathWhenType(config.appPath, options);
  const controllerUrl = config.controllerUrl || 'unknown';
  const appExists = await checkApplicationExists(appName, controllerUrl, config.envKey, config.auth);

  const { manifest, manifestPath } = await generateAndValidateManifest(appName, options);
  applyManifestOverrides(manifest, options);
  validateImageIsPullable(manifest.image, appName);
  displayDeploymentInfo(manifest, manifestPath);

  try {
    const result = await executeDeployment(manifest, config);
    displayDeploymentResults(result);
    const status = result.status?.status;
    throwIfDeploymentFailed(status, result.status || {});
    if (status === 'completed') {
      await displayAppUrlFromController(
        config.controllerUrl,
        config.envKey,
        manifest.key,
        config.auth
      );
    }
    return { result, controllerUrl, appExists };
  } catch (error) {
    enhanceAuthErrorIfNeeded(error, appExists, appName, config.envKey);
  }
}

/**
 * Tries external deploy when builder/<app> does not exist but integration/<app> does.
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @returns {Promise<{usedExternalDeploy: boolean, result: Object|null}>}
 */
async function tryExternalDeployFallback(appName, options) {
  const builderPath = getBuilderPath(appName);
  const integrationPath = getIntegrationPath(appName);
  let builderExists = false;
  let integrationExists = false;
  try {
    await fs.access(builderPath);
    builderExists = true;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  try {
    await fs.access(integrationPath);
    integrationExists = true;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (!builderExists && integrationExists) {
    const fallbackResult = await handleExternalDeployment(appName, options);
    if (fallbackResult) return { usedExternalDeploy: true, result: fallbackResult };
  }
  return { usedExternalDeploy: false, result: null };
}

/**
 * Deploys application to Miso Controller
 * Orchestrates manifest generation, key creation, and deployment
 *
 * @async
 * @function deployApp
 * @param {string} appName - Name of the application to deploy
 * @param {Object} options - Deployment options
 * @param {boolean} [options.local] - If true, caller may run app locally or restart dataplane (for external)
 * @param {boolean} [options.poll] - Poll for deployment status
 * @param {number} [options.pollInterval] - Polling interval in milliseconds
 * @param {number} [options.pollMaxAttempts] - Max polling attempts
 * @returns {Promise<{ result: Object, usedExternalDeploy: boolean }>} Deployment result and whether external deploy was used
 * @throws {Error} If deployment fails
 *
 * Controller and environment come from config.yaml (set via aifabrix login or aifabrix auth config).
 *
 * @example
 * const { result, usedExternalDeploy } = await deployApp('myapp', { poll: true });
 */
async function deployApp(appName, options = {}) {
  let controllerUrl = null;
  let usedExternalDeploy = false;

  try {
    if (!appName || typeof appName !== 'string' || appName.trim().length === 0) {
      throw new Error('App name is required');
    }
    validateAppName(appName);

    const externalResult = await handleExternalDeployment(appName, options);
    if (externalResult) {
      usedExternalDeploy = true;
      return { result: externalResult, usedExternalDeploy: true };
    }

    const fallback = await tryExternalDeployFallback(appName, options);
    if (fallback.result) {
      usedExternalDeploy = fallback.usedExternalDeploy;
      return { result: fallback.result, usedExternalDeploy };
    }

    const { result, controllerUrl: url } = await executeStandardDeployment(appName, options);
    controllerUrl = url;
    return { result, usedExternalDeploy: false };
  } catch (error) {
    await handleDeploymentError(error, appName, controllerUrl, usedExternalDeploy);
  }
}

module.exports = {
  pushApp,
  deployApp,
  validateAppName,
  validateImageIsPullable
};

