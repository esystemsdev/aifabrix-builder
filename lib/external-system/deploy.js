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
const { detectAppType } = require('../utils/paths');
const { logOfflinePathWhenType } = require('../utils/cli-utils');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
const { getExternalSystem } = require('../api/external-systems.api');
const { generateControllerManifest } = require('../generator/external-controller-manifest');
const { validateExternalSystemComplete } = require('../validation/validate');
const { displayValidationResults } = require('../validation/validate-display');

/**
 * Displays API and MCP documentation URLs from dataplane when available
 * @async
 * @function displayDeploymentDocs
 * @param {string} controllerUrl - Controller base URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {string} systemKey - External system key
 */
async function displayDeploymentDocs(controllerUrl, environment, authConfig, systemKey) {
  try {
    const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
    const res = await getExternalSystem(dataplaneUrl, systemKey, authConfig);
    const sys = res?.data || res;
    if (!sys) return;

    const apiDocumentUrl = sys.apiDocumentUrl;
    const mcpServerUrl = sys.mcpServerUrl;
    const openApiDocsPageUrl = sys.openApiDocsPageUrl;

    const urls = [];
    if (apiDocumentUrl && typeof apiDocumentUrl === 'string') {
      urls.push({ label: 'API Docs', url: apiDocumentUrl });
    }
    if (mcpServerUrl && typeof mcpServerUrl === 'string') {
      urls.push({ label: 'MCP Server', url: mcpServerUrl });
    }
    if (openApiDocsPageUrl && typeof openApiDocsPageUrl === 'string') {
      urls.push({ label: 'OpenAPI Docs Page', url: openApiDocsPageUrl });
    }

    if (urls.length > 0) {
      logger.log(chalk.blue('\nDocumentation:'));
      urls.forEach(({ label, url }) => {
        logger.log(chalk.blue(`   ${label}: ${url}`));
      });
    }
  } catch (_err) {
    // Silently ignore: dataplane may be unreachable or docs not configured
  }
}

/**
 * Deploys via controller and displays success summary with docs
 * @async
 * @function executeDeployAndDisplay
 * @param {Object} manifest - Controller manifest
 * @param {string} controllerUrl - Controller base URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment result
 */
async function executeDeployAndDisplay(manifest, controllerUrl, environment, authConfig, options) {
  const deployer = require('../deployment/deployer');
  const pollOpts = {
    poll: options.poll,
    pollInterval: options.pollInterval !== undefined ? options.pollInterval : 500,
    pollMaxAttempts: options.pollMaxAttempts,
    ...options
  };
  const result = await deployer.deployToController(
    manifest,
    controllerUrl,
    environment,
    authConfig,
    pollOpts
  );
  logger.log(chalk.green('\n✅ External system deployed successfully!'));
  logger.log(chalk.blue(`System: ${manifest.key}`));
  logger.log(chalk.blue(`Datasources: ${manifest.dataSources.length}`));
  await displayDeploymentDocs(controllerUrl, environment, authConfig, manifest.key);
  return result;
}

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
    const { appPath } = await detectAppType(appName);
    logOfflinePathWhenType(appPath);

    logger.log(chalk.blue(`\n🚀 Deploying external system: ${appName}`));

    // Step 0: Validate before deployment (same as validate command)
    logger.log(chalk.blue('🔍 Validating external system before deployment...'));
    const validationResult = await validateExternalSystemComplete(appName, options);

    if (!validationResult.valid) {
      displayValidationResults(validationResult);
      throw new Error('Validation failed. Fix errors before deploying.');
    }

    logger.log(chalk.green('✓ Validation passed, proceeding with deployment...'));

    // Step 1: Generate controller manifest (validated, ready for deployment)
    const manifest = await generateControllerManifest(appName, options);

    // Step 2: Get deployment configuration (auth, controller URL, etc.)
    const { environment, controllerUrl, authConfig } = await prepareDeploymentConfig(appName, options);

    // Step 3: Deploy via controller pipeline (same as regular apps)
    const result = await executeDeployAndDisplay(
      manifest,
      controllerUrl,
      environment,
      authConfig,
      options
    );
    return result;
  } catch (error) {
    let message = `Failed to deploy external system: ${error.message}`;
    if (error.message && error.message.includes('Application not found')) {
      message += `\n\n💡 Register the app in the controller first: aifabrix app register ${appName}`;
    }
    throw new Error(message);
  }
}

module.exports = {
  deployExternalSystem
};

