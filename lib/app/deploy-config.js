/**
 * Deployment configuration loading and validation for deploy flow.
 * Extracted from deploy.js to keep file size within limits.
 *
 * @fileoverview Deployment config for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const config = require('../core/config');
const { getDeploymentAuth } = require('../utils/token-manager');
const { detectAppType, resolveApplicationConfigPath } = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');
const { resolveControllerUrl } = require('../utils/controller-url');

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
 * Loads application config (application.yaml or application.json) via resolver + converter.
 * @param {string} appPath - Path to application directory
 * @returns {Object} Variables object
 * @throws {Error} If file cannot be loaded
 */
function loadVariablesFile(appPath) {
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    return loadConfigFile(configPath);
  } catch (error) {
    throw new Error('Failed to load configuration: ' + error.message);
  }
}

/**
 * Extracts deployment configuration from config.yaml
 * Resolves controller URL using fallback chain: config.controller → logged-in user → developer ID default
 * Resolves environment using fallback chain: config.environment → default 'dev'
 * @async
 * @param {Object} options - CLI options (for poll settings only)
 * @param {Object} _variables - Variables from application config (unused, kept for compatibility)
 * @returns {Promise<Object>} Extracted configuration with resolved controller URL
 */
async function extractDeploymentConfig(options, _variables) {
  const { resolveEnvironment } = require('../core/config');

  const controllerUrl = await resolveControllerUrl();
  const envKey = await resolveEnvironment();

  return {
    controllerUrl,
    envKey,
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
    throw new Error('Controller URL is required. Run "aifabrix login" to set the controller URL in config.yaml');
  }
  if (!deploymentConfig.auth) {
    throw new Error('Authentication is required. Run "aifabrix login" first or ensure credentials are in secrets.local.yaml');
  }
}

/**
 * Configure deployment environment settings from config.yaml
 * @async
 * @param {Object} _options - CLI options (unused, kept for compatibility)
 * @param {Object} deploymentConfig - Deployment configuration to update
 * @returns {Promise<void>}
 */
async function configureDeploymentEnvironment(_options, deploymentConfig) {
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
  if (!deploymentConfig.controllerUrl) {
    throw new Error('Controller URL is required. Run "aifabrix login" to set the controller URL in config.yaml');
  }

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
 * Loads deployment configuration from application.yaml and gets/refreshes token
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - CLI options
 * @returns {Promise<Object>} Deployment configuration with token
 * @throws {Error} If configuration is invalid
 */
async function loadDeploymentConfig(appName, options) {
  const { appPath } = await detectAppType(appName);
  await validateAppDirectory(appPath, appName);

  const variables = loadVariablesFile(appPath);

  const deploymentConfig = await extractDeploymentConfig(options, variables);

  await configureDeploymentEnvironment(options, deploymentConfig);
  await refreshDeploymentToken(appName, deploymentConfig);

  validateDeploymentConfig(deploymentConfig);

  return { ...deploymentConfig, appPath };
}

module.exports = {
  loadDeploymentConfig
};
