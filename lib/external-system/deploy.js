/**
 * External System Deployment Module
 *
 * Handles deployment of external systems via controller pipeline.
 * Uses unified controller pipeline (same as regular apps) - no direct dataplane calls.
 *
 * @fileoverview External system deployment for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { getDeploymentAuth } = require('../utils/token-manager');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { generateControllerManifest } = require('../generator/external-controller-manifest');
const { validateExternalSystemComplete } = require('../validation/validate');
const { displayValidationResults } = require('../validation/validate-display');

/**
 * Prepares deployment configuration (auth, controller URL, environment)
 * @async
 * @function prepareDeploymentConfig
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment configuration
 */
async function prepareDeploymentConfig(appName, _options) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  return { environment, controllerUrl, authConfig };
}

/**
 * Deploys external system via controller pipeline (same as regular apps)
 * Uses unified controller pipeline - no direct dataplane calls
 *
 * @async
 * @function deployExternalSystem
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {string} [options.controller] - Controller URL
 * @param {boolean} [options.poll] - Poll for deployment status
 * @param {number} [options.pollInterval] - Polling interval in milliseconds (default: 500ms for external systems)
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 */
async function deployExternalSystem(appName, options = {}) {
  try {
    logger.log(chalk.blue(`\n🚀 Deploying external system: ${appName}`));

    // Step 0: Validate before deployment (same as validate command)
    logger.log(chalk.blue('🔍 Validating external system before deployment...'));
    const validationResult = await validateExternalSystemComplete(appName);

    if (!validationResult.valid) {
      displayValidationResults(validationResult);
      throw new Error('Validation failed. Fix errors before deploying.');
    }

    logger.log(chalk.green('✓ Validation passed, proceeding with deployment...'));

    // Step 1: Generate controller manifest (validated, ready for deployment)
    const manifest = await generateControllerManifest(appName);

    // Step 2: Get deployment configuration (auth, controller URL, etc.)
    const { environment, controllerUrl, authConfig } = await prepareDeploymentConfig(appName, options);

    // Step 3: Deploy via controller pipeline (same as regular apps)
    // Use 500ms polling for external systems (faster than web apps which use 5000ms)
    const deployer = require('../deployment/deployer');
    const result = await deployer.deployToController(
      manifest,
      controllerUrl,
      environment,
      authConfig,
      {
        poll: options.poll,
        pollInterval: options.pollInterval !== undefined ? options.pollInterval : 500,
        pollMaxAttempts: options.pollMaxAttempts,
        ...options
      }
    );

    // Display success summary
    logger.log(chalk.green('\n✅ External system deployed successfully!'));
    logger.log(chalk.blue(`System: ${manifest.key}`));
    logger.log(chalk.blue(`Datasources: ${manifest.dataSources.length}`));

    return result;
  } catch (error) {
    throw new Error(`Failed to deploy external system: ${error.message}`);
  }
}

module.exports = {
  deployExternalSystem
};

