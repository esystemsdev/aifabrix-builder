/**
 * Datasource Deployment
 *
 * Deploys datasource to dataplane via controller API.
 * Gets dataplane URL from controller, then deploys to dataplane.
 *
 * @fileoverview Datasource deployment for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const chalk = require('chalk');
const { getDeploymentAuth } = require('../utils/token-manager');
const { getEnvironmentApplication } = require('../api/environments.api');
const { publishDatasourceViaPipeline } = require('../api/pipeline.api');
const { formatApiError } = require('../utils/api-error-handler');
const logger = require('../utils/logger');
const { validateDatasourceFile } = require('./validate');

/**
 * Gets dataplane URL from controller by fetching application details
 *
 * @async
 * @function getDataplaneUrl
 * @param {string} controllerUrl - Controller URL
 * @param {string} appKey - Application key
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<string>} Dataplane URL
 * @throws {Error} If dataplane URL cannot be retrieved
 */
async function getDataplaneUrl(controllerUrl, appKey, environment, authConfig) {
  // Call controller API to get application details using centralized API client
  const response = await getEnvironmentApplication(controllerUrl, environment, appKey, authConfig);

  if (!response.success || !response.data) {
    const formattedError = response.formattedError || formatApiError(response);
    throw new Error(`Failed to get application from controller: ${formattedError}`);
  }

  // Extract dataplane URL from application response
  // Try multiple possible locations for the URL
  const application = response.data.data || response.data;
  const dataplaneUrl = application.url ||
    application.dataplaneUrl ||
    application.dataplane?.url ||
    application.configuration?.dataplaneUrl;

  if (!dataplaneUrl) {
    const appType = application.configuration?.type || application.type;
    if (appType === 'external') {
      throw new Error('Dataplane URL not found for external system. Provide --dataplane <url>.');
    }
    throw new Error('Dataplane URL not found in application configuration');
  }

  return dataplaneUrl;
}

/**
 * Validate deployment inputs
 * @param {string} appKey - Application key
 * @param {string} filePath - File path
 * @param {Object} options - Options
 * @throws {Error} If validation fails
 */
function validateDeploymentInputs(appKey, filePath) {
  if (!appKey || typeof appKey !== 'string') {
    throw new Error('Application key is required');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required');
  }
}

/**
 * Validate and load datasource file
 * @async
 * @param {string} filePath - Path to datasource file
 * @returns {Promise<Object>} Datasource configuration
 * @throws {Error} If validation or loading fails
 */
async function validateAndLoadDatasourceFile(filePath) {
  logger.log(chalk.blue('🔍 Validating datasource file...'));
  const validation = await validateDatasourceFile(filePath);
  if (!validation.valid) {
    logger.error(chalk.red('❌ Datasource validation failed:'));
    validation.errors.forEach(error => {
      logger.error(chalk.red(`  • ${error}`));
    });
    throw new Error('Datasource file validation failed');
  }
  logger.log(chalk.green('✓ Datasource file is valid'));

  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse datasource file: ${error.message}`);
  }
}

/**
 * Setup authentication and get dataplane URL
 * @async
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment key
 * @param {string} appKey - Application key
 * @param {Object} [options] - Options
 * @param {string} [options.dataplane] - Dataplane URL override
 * @returns {Promise<Object>} Object with authConfig and dataplaneUrl
 */
async function setupDeploymentAuth(controllerUrl, environment, appKey) {
  const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
  logger.log(chalk.blue('🔐 Getting authentication...'));
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appKey);
  logger.log(chalk.green('✓ Authentication successful'));

  logger.log(chalk.blue('🌐 Resolving dataplane URL...'));
  let dataplaneUrl;
  try {
    dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
    logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));
  } catch (error) {
    logger.error(chalk.red('❌ Failed to resolve dataplane URL:'), error.message);
    logger.error(chalk.gray('\nThe dataplane URL is automatically discovered from the controller.'));
    logger.error(chalk.gray('If discovery fails, ensure you are logged in and the controller is accessible:'));
    logger.error(chalk.gray('   aifabrix login'));
    throw error;
  }

  // Validate dataplane URL
  if (!dataplaneUrl || !dataplaneUrl.trim()) {
    logger.error(chalk.red('❌ Dataplane URL is empty.'));
    logger.error(chalk.gray('The dataplane URL could not be discovered from the controller.'));
    logger.error(chalk.gray('Ensure the dataplane service is registered in the controller.'));
    throw new Error('Dataplane URL is empty');
  }

  return { authConfig, dataplaneUrl: dataplaneUrl.trim() };
}

/**
 * Publish datasource to dataplane
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} datasourceConfig - Datasource configuration
 * @returns {Promise<Object>} Publish response
 * @throws {Error} If publish fails
 */
async function publishDatasourceToDataplane(dataplaneUrl, systemKey, authConfig, datasourceConfig) {
  logger.log(chalk.blue('\n🚀 Publishing datasource to dataplane...'));

  const publishResponse = await publishDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

  if (!publishResponse.success) {
    const formattedError = publishResponse.formattedError || formatApiError(publishResponse);
    logger.error(chalk.red('❌ Publish failed:'));
    logger.error(formattedError);

    // Show dataplane URL and endpoint information
    if (publishResponse.errorData && publishResponse.errorData.endpointUrl) {
      logger.error(chalk.gray(`\nEndpoint URL: ${publishResponse.errorData.endpointUrl}`));
    } else if (dataplaneUrl) {
      logger.error(chalk.gray(`\nDataplane URL: ${dataplaneUrl}`));
      logger.error(chalk.gray(`System Key: ${systemKey}`));
    }

    logger.error(chalk.gray('\nFull response for debugging:'));
    logger.error(chalk.gray(JSON.stringify(publishResponse, null, 2)));
    throw new Error(`Dataplane publish failed: ${formattedError}`);
  }

  logger.log(chalk.green('\n✓ Datasource published successfully!'));
  return publishResponse;
}

/**
 * Display deployment results
 * @param {Object} datasourceConfig - Datasource configuration
 * @param {string} systemKey - System key
 * @param {string} environment - Environment key
 */
function displayDeploymentResults(datasourceConfig, systemKey, environment) {
  logger.log(chalk.blue(`\nDatasource: ${datasourceConfig.key || datasourceConfig.displayName}`));
  logger.log(chalk.blue(`System: ${systemKey}`));
  logger.log(chalk.blue(`Environment: ${environment}`));
}

/**
 * Deploys datasource to dataplane.
 * Controller and environment come from config.yaml (set via aifabrix login or aifabrix auth config).
 *
 * @async
 * @function deployDatasource
 * @param {string} appKey - Application key
 * @param {string} filePath - Path to datasource JSON file
 * @param {Object} [_options] - Deployment options (reserved)
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 */
async function deployDatasource(appKey, filePath, _options) {
  const { resolveControllerUrl } = require('../utils/controller-url');
  const { resolveEnvironment } = require('../core/config');
  const { displayCommandHeader } = require('../utils/command-header');

  validateDeploymentInputs(appKey, filePath);

  // Resolve controller and environment from config
  const controllerUrl = await resolveControllerUrl();
  const environment = await resolveEnvironment();

  // Display command header
  displayCommandHeader(controllerUrl, environment);

  logger.log(chalk.blue('📋 Deploying datasource...\n'));

  // Validate and load datasource file
  const datasourceConfig = await validateAndLoadDatasourceFile(filePath);

  // Extract systemKey
  const systemKey = datasourceConfig.systemKey;
  if (!systemKey) {
    throw new Error('systemKey is required in datasource configuration');
  }

  // Setup authentication and get dataplane URL
  const { authConfig, dataplaneUrl } = await setupDeploymentAuth(controllerUrl, environment, appKey);

  // Publish to dataplane
  await publishDatasourceToDataplane(dataplaneUrl, systemKey, authConfig, datasourceConfig);

  // Display results
  displayDeploymentResults(datasourceConfig, systemKey, environment);

  return {
    success: true,
    datasourceKey: datasourceConfig.key,
    systemKey: systemKey,
    environment: environment,
    dataplaneUrl: dataplaneUrl
  };
}

module.exports = {
  deployDatasource,
  getDataplaneUrl
};

