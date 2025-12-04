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
const { getDeploymentAuth } = require('./utils/token-manager');
const { authenticatedApiCall } = require('./utils/api');
const { formatApiError } = require('./utils/api-error-handler');
const logger = require('./utils/logger');
const { validateDatasourceFile } = require('./datasource-validate');

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
  // Call controller API to get application details
  // Expected: GET /api/v1/environments/{env}/applications/{appKey}
  const endpoint = `${controllerUrl}/api/v1/environments/${environment}/applications/${appKey}`;

  let response;
  if (authConfig.type === 'bearer' && authConfig.token) {
    response = await authenticatedApiCall(endpoint, {}, authConfig.token);
  } else {
    // For credentials, we'd need to use a different API call method
    // For now, use bearer token approach
    throw new Error('Bearer token authentication required for getting dataplane URL');
  }

  if (!response.success || !response.data) {
    const formattedError = response.formattedError || formatApiError(response);
    throw new Error(`Failed to get application from controller: ${formattedError}`);
  }

  // Extract dataplane URL from application response
  // This is a placeholder - actual response structure may vary
  const application = response.data.data || response.data;
  const dataplaneUrl = application.dataplaneUrl || application.dataplane?.url || application.configuration?.dataplaneUrl;

  if (!dataplaneUrl) {
    logger.error(chalk.red('❌ Dataplane URL not found in application response'));
    logger.error(chalk.gray('\nApplication response:'));
    logger.error(chalk.gray(JSON.stringify(application, null, 2)));
    throw new Error('Dataplane URL not found in application configuration');
  }

  return dataplaneUrl;
}

/**
 * Deploys datasource to dataplane
 *
 * @async
 * @function deployDatasource
 * @param {string} appKey - Application key
 * @param {string} filePath - Path to datasource JSON file
 * @param {Object} options - Deployment options
 * @param {string} options.controller - Controller URL
 * @param {string} options.environment - Environment key
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 */
async function deployDatasource(appKey, filePath, options) {
  if (!appKey || typeof appKey !== 'string') {
    throw new Error('Application key is required');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required');
  }
  if (!options.controller) {
    throw new Error('Controller URL is required (--controller)');
  }
  if (!options.environment) {
    throw new Error('Environment is required (-e, --environment)');
  }

  logger.log(chalk.blue('📋 Deploying datasource...\n'));

  // Validate datasource file
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

  // Load datasource configuration
  const content = fs.readFileSync(filePath, 'utf8');
  let datasourceConfig;
  try {
    datasourceConfig = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse datasource file: ${error.message}`);
  }

  // Extract systemKey
  const systemKey = datasourceConfig.systemKey;
  if (!systemKey) {
    throw new Error('systemKey is required in datasource configuration');
  }

  // Get authentication
  logger.log(chalk.blue('🔐 Getting authentication...'));
  const authConfig = await getDeploymentAuth(options.controller, options.environment, appKey);
  logger.log(chalk.green('✓ Authentication successful'));

  // Get dataplane URL from controller
  logger.log(chalk.blue('🌐 Getting dataplane URL from controller...'));
  const dataplaneUrl = await getDataplaneUrl(options.controller, appKey, options.environment, authConfig);
  logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));

  // Publish to dataplane (using publish endpoint)
  logger.log(chalk.blue('\n🚀 Publishing datasource to dataplane...'));
  const publishEndpoint = `${dataplaneUrl}/api/v1/pipeline/${systemKey}/publish`;

  // Prepare publish request - send datasource configuration directly
  let publishResponse;
  if (authConfig.type === 'bearer' && authConfig.token) {
    publishResponse = await authenticatedApiCall(
      publishEndpoint,
      {
        method: 'POST',
        body: JSON.stringify(datasourceConfig)
      },
      authConfig.token
    );
  } else {
    throw new Error('Bearer token authentication required for dataplane publish');
  }

  if (!publishResponse.success) {
    const formattedError = publishResponse.formattedError || formatApiError(publishResponse);
    logger.error(chalk.red('❌ Publish failed:'));
    logger.error(formattedError);
    throw new Error(`Dataplane publish failed: ${formattedError}`);
  }

  logger.log(chalk.green('\n✓ Datasource published successfully!'));
  logger.log(chalk.blue(`\nDatasource: ${datasourceConfig.key || datasourceConfig.displayName}`));
  logger.log(chalk.blue(`System: ${systemKey}`));
  logger.log(chalk.blue(`Environment: ${options.environment}`));

  return {
    success: true,
    datasourceKey: datasourceConfig.key,
    systemKey: systemKey,
    environment: options.environment,
    dataplaneUrl: dataplaneUrl
  };
}

module.exports = {
  deployDatasource,
  getDataplaneUrl
};

