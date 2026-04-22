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
const { getDeploymentAuth, requireBearerForDataplanePipeline } = require('../utils/token-manager');
const { getEnvironmentApplication } = require('../api/environments.api');
const { publishDatasourceViaPipeline } = require('../api/pipeline.api');
const { formatApiError } = require('../utils/api-error-handler');
const logger = require('../utils/logger');
const { logDataplanePipelineWarning } = require('../utils/dataplane-pipeline-warning');
const {
  sectionTitle,
  headerKeyValue,
  metadata,
  infoLine,
  formatStatusKeyValue,
  formatBlockingError,
  successGlyph,
  failureGlyph
} = require('../utils/cli-test-layout-chalk');
const {
  buildResolvedEnvMapForIntegration,
  resolveConfigurationValues
} = require('../utils/configuration-env-resolver');
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
      throw new Error('Dataplane URL not found for external system in application configuration.');
    }
    throw new Error('Dataplane URL not found in application configuration');
  }

  return dataplaneUrl;
}

/**
 * Validate deploy CLI input (file path or datasource key, same rules as `datasource validate`).
 * @param {string} fileOrKey - Path to JSON or datasource `key` under integration/<app>/
 * @throws {Error} If validation fails
 */
function validateDeployFileOrKeyInput(fileOrKey) {
  if (!fileOrKey || typeof fileOrKey !== 'string' || !fileOrKey.trim()) {
    throw new Error('File path or datasource key is required');
  }
}

/**
 * Validate and load datasource file (path or datasource key, resolved like `datasource validate`).
 * @async
 * @param {string} filePathOrKey - Path to datasource JSON or datasource `key`
 * @returns {Promise<Object>} Datasource configuration
 * @throws {Error} If validation or loading fails
 */
async function validateAndLoadDatasourceFile(filePathOrKey) {
  logger.log(infoLine('ℹ Validating datasource file'));
  const validation = await validateDatasourceFile(filePathOrKey);
  if (!validation.valid) {
    logger.log('');
    logger.error(formatBlockingError('Datasource validation failed'));
    validation.errors.forEach(error => {
      logger.error(formatBlockingError(error));
    });
    throw new Error('Datasource file validation failed');
  }

  const resolvedPath = validation.resolvedPath;
  logger.log(headerKeyValue('File:', resolvedPath));
  logger.log(`${successGlyph()} ${chalk.white('Datasource file is valid.')}`);
  logger.log('');

  const content = fs.readFileSync(resolvedPath, 'utf8');
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
 * @returns {Promise<Object>} Object with authConfig and dataplaneUrl
 */
async function setupDeploymentAuth(controllerUrl, environment, appKey) {
  const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
  logger.log(infoLine('ℹ Resolving authentication'));
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appKey);
  logger.log(`${successGlyph()} ${chalk.white('Authentication ready')}`);

  logger.log(infoLine('ℹ Resolving dataplane URL'));
  let dataplaneUrl;
  try {
    dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
    logger.log(`${metadata('Dataplane:')} ${chalk.cyan(dataplaneUrl)}`);
  } catch (error) {
    logger.error(`${failureGlyph()} ${chalk.red('Failed to resolve dataplane URL:')} ${chalk.red(error.message)}`);
    logger.error(metadata('The dataplane URL is automatically discovered from the controller.'));
    logger.error(metadata('If discovery fails, ensure you are logged in and the controller is accessible:'));
    logger.error(metadata('aifabrix login'));
    throw error;
  }

  // Validate dataplane URL
  if (!dataplaneUrl || !dataplaneUrl.trim()) {
    logger.error(`${failureGlyph()} ${chalk.red('Dataplane URL is empty.')}`);
    logger.error(metadata('The dataplane URL could not be discovered from the controller.'));
    logger.error(metadata('Ensure the dataplane service is registered in the controller.'));
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
  requireBearerForDataplanePipeline(authConfig);
  logger.log('');
  logger.log(sectionTitle('Publish'));
  logDataplanePipelineWarning();

  const publishResponse = await publishDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceConfig);

  if (!publishResponse.success) {
    const formattedError = publishResponse.formattedError || formatApiError(publishResponse);
    logger.error(`${failureGlyph()} ${chalk.red('Publish failed:')} ${chalk.red(formattedError)}`);

    // Show dataplane URL and endpoint information
    if (publishResponse.errorData && publishResponse.errorData.endpointUrl) {
      logger.error(
        `\n${metadata('Endpoint URL:')} ${chalk.cyan(publishResponse.errorData.endpointUrl)}`
      );
    } else if (dataplaneUrl) {
      logger.error(`\n${metadata('Dataplane URL:')} ${chalk.cyan(dataplaneUrl)}`);
      logger.error(headerKeyValue('System Key:', systemKey));
    }

    logger.error(metadata('\nFull response for debugging:'));
    logger.error(metadata(JSON.stringify(publishResponse, null, 2)));
    throw new Error(`Dataplane publish failed: ${formattedError}`);
  }

  logger.log(`${successGlyph()} ${chalk.white('Configuration published to dataplane.')}`);
  return publishResponse;
}

/**
 * Display deployment results
 * @param {Object} datasourceConfig - Datasource configuration
 * @param {string} systemKey - System key
 * @param {string} environment - Environment key
 */
function displayDeploymentResults(datasourceConfig, systemKey, environment) {
  const datasourceLabel = datasourceConfig.key || datasourceConfig.displayName || '(unknown)';
  logger.log('');
  logger.log(sectionTitle('Result'));
  logger.log(headerKeyValue('Datasource:', datasourceLabel));
  logger.log(headerKeyValue('System:', systemKey));
  logger.log(headerKeyValue('Environment:', environment));
  logger.log('');
  logger.log(formatStatusKeyValue('ok', '✔'));
}

function logDatasourceUploadSectionHeader() {
  logger.log('');
  logger.log(sectionTitle('Datasource upload'));
  logger.log(metadata('Publish one datasource JSON to the dataplane'));
  logger.log('');
}

/**
 * Deploys datasource to dataplane.
 * Controller and environment come from config.yaml (set via aifabrix login or aifabrix auth config).
 *
 * @async
 * @function deployDatasource
 * @param {string} fileOrKey - Path to datasource JSON file, or datasource `key` under integration/<app>/ (same resolution as `datasource validate`)
 * @param {Object} [_options] - Deployment options (reserved)
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 */
async function deployDatasource(fileOrKey, _options) {
  const { resolveControllerUrl } = require('../utils/controller-url');
  const { resolveEnvironment } = require('../core/config');
  const { displayCommandHeader } = require('../utils/command-header');

  validateDeployFileOrKeyInput(fileOrKey);

  // Resolve controller and environment from config
  const controllerUrl = await resolveControllerUrl();
  const environment = await resolveEnvironment();

  // Display command header
  displayCommandHeader(controllerUrl, environment);
  logDatasourceUploadSectionHeader();

  // Validate and load datasource file (resolves key → path like validate)
  const datasourceConfig = await validateAndLoadDatasourceFile(fileOrKey.trim());

  // Extract systemKey (required in JSON; also used as controller app key for external systems)
  const systemKey = datasourceConfig.systemKey;
  if (!systemKey) {
    throw new Error('systemKey is required in datasource configuration');
  }

  if (Array.isArray(datasourceConfig.configuration) && datasourceConfig.configuration.length > 0) {
    const { envMap, secrets } = await buildResolvedEnvMapForIntegration(systemKey);
    resolveConfigurationValues(datasourceConfig.configuration, envMap, secrets, systemKey);
  }

  // Setup authentication and get dataplane URL (application key matches systemKey for external integrations)
  const { authConfig, dataplaneUrl } = await setupDeploymentAuth(controllerUrl, environment, systemKey);

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

