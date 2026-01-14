/**
 * External System Deployment Module
 *
 * Handles deployment of external systems and datasources via pipeline API
 * for external type applications.
 *
 * @fileoverview External system deployment for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const {
  deployExternalSystemViaPipeline,
  deployDatasourceViaPipeline,
  uploadApplicationViaPipeline,
  validateUploadViaPipeline,
  publishUploadViaPipeline
} = require('../api/pipeline.api');
const { getDeploymentAuth } = require('../utils/token-manager');
const { getConfig } = require('../core/config');
const logger = require('../utils/logger');
const { getDataplaneUrl } = require('../datasource/deploy');
const { detectAppType } = require('../utils/paths');
const { generateExternalSystemApplicationSchema } = require('../generator/external');
const {
  loadVariablesYaml,
  validateSystemFiles,
  validateDatasourceFiles,
  extractSystemKey
} = require('./deploy-helpers');

/**
 * Loads variables.yaml for an application
 * @async
 * @function loadVariablesYaml
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Variables configuration
 * @throws {Error} If file cannot be loaded
 */
/**
 * Validates external system files exist
 * @async
 * @function validateExternalSystemFiles
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Validation result with file paths
 * @throws {Error} If validation fails
 */

async function validateExternalSystemFiles(appName) {
  const variables = await loadVariablesYaml(appName);

  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in variables.yaml');
  }

  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appName);

  // For new structure, files are in same folder (schemaBasePath is usually './')
  // For backward compatibility, support old schemas/ subfolder
  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const schemasPath = path.isAbsolute(schemaBasePath)
    ? schemaBasePath
    : path.join(appPath, schemaBasePath);

  // Validate system files
  const systemFilesList = variables.externalIntegration.systems || [];
  if (systemFilesList.length === 0) {
    throw new Error('No external system files specified in externalIntegration.systems');
  }
  const systemFiles = await validateSystemFiles(systemFilesList, appName, schemasPath);

  // Validate datasource files
  const datasourceFilesList = variables.externalIntegration.dataSources || [];
  const datasourceFiles = await validateDatasourceFiles(datasourceFilesList, appPath, schemasPath);

  // Extract systemKey from system file
  const systemKey = extractSystemKey(systemFiles[0]);

  return {
    systemFiles,
    datasourceFiles,
    systemKey
  };
}

/**
 * Deploys external system to dataplane (build step - deploy, not publish)
 * @async
 * @function buildExternalSystem
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @returns {Promise<void>} Resolves when deployment completes
 * @throws {Error} If deployment fails
 */
/**
 * Validates and prepares deployment configuration
 * @async
 * @function prepareDeploymentConfig
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment configuration
 */
async function prepareDeploymentConfig(appName, options) {
  const { systemFiles, datasourceFiles, systemKey } = await validateExternalSystemFiles(appName);

  const config = await getConfig();
  const environment = options.environment || 'dev';
  const controllerUrl = options.controller || config.deployment?.controllerUrl || 'http://localhost:3000';
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  return { systemFiles, datasourceFiles, systemKey, environment, controllerUrl, authConfig };
}

/**
 * Gets dataplane URL from controller
 * @async
 * @function getDataplaneUrlForDeployment
 * @param {string} controllerUrl - Controller URL
 * @param {string} appName - Application name
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<string>} Dataplane URL
 */
async function getDataplaneUrlForDeployment(controllerUrl, appName, environment, authConfig) {
  logger.log(chalk.blue('🌐 Getting dataplane URL from controller...'));
  const dataplaneUrl = await getDataplaneUrl(controllerUrl, appName, environment, authConfig);
  logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));
  return dataplaneUrl;
}

/**
 * Deploys external system via pipeline
 * @async
 * @function deploySystem
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} systemFilePath - Path to system file
 * @param {string} systemKey - System key
 * @returns {Promise<void>}
 */
async function deploySystem(dataplaneUrl, authConfig, systemFilePath, systemKey) {
  logger.log(chalk.blue(`Deploying external system: ${systemKey}...`));
  const systemContent = await fs.readFile(systemFilePath, 'utf8');
  const systemJson = JSON.parse(systemContent);

  const systemResponse = await deployExternalSystemViaPipeline(dataplaneUrl, authConfig, systemJson);

  if (!systemResponse.success) {
    throw new Error(`Failed to deploy external system: ${systemResponse.error || systemResponse.formattedError}`);
  }

  logger.log(chalk.green(`✓ External system deployed: ${systemKey}`));
}

/**
 * Deploys a single datasource via pipeline
 * @async
 * @function deploySingleDatasource
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration
 * @param {string} datasourceFile - Path to datasource file
 * @returns {Promise<void>}
 */
async function deploySingleDatasource(dataplaneUrl, systemKey, authConfig, datasourceFile) {
  const datasourceName = path.basename(datasourceFile, '.json');
  logger.log(chalk.blue(`Deploying datasource: ${datasourceName}...`));

  const datasourceContent = await fs.readFile(datasourceFile, 'utf8');
  const datasourceJson = JSON.parse(datasourceContent);

  const datasourceResponse = await deployDatasourceViaPipeline(dataplaneUrl, systemKey, authConfig, datasourceJson);

  if (!datasourceResponse.success) {
    throw new Error(`Failed to deploy datasource ${datasourceName}: ${datasourceResponse.error || datasourceResponse.formattedError}`);
  }

  logger.log(chalk.green(`✓ Datasource deployed: ${datasourceName}`));
}

/**
 * Deploys all datasources
 * @async
 * @function deployAllDatasources
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration
 * @param {string[]} datasourceFiles - Array of datasource file paths
 * @returns {Promise<void>}
 */
async function deployAllDatasources(dataplaneUrl, systemKey, authConfig, datasourceFiles) {
  for (const datasourceFile of datasourceFiles) {
    await deploySingleDatasource(dataplaneUrl, systemKey, authConfig, datasourceFile);
  }
}

async function buildExternalSystem(appName, options = {}) {
  try {
    logger.log(chalk.blue(`\n🔨 Building external system: ${appName}`));

    const { systemFiles, datasourceFiles, systemKey, environment, controllerUrl, authConfig } = await prepareDeploymentConfig(appName, options);
    const dataplaneUrl = await getDataplaneUrlForDeployment(controllerUrl, appName, environment, authConfig);

    await deploySystem(dataplaneUrl, authConfig, systemFiles[0], systemKey);
    await deployAllDatasources(dataplaneUrl, systemKey, authConfig, datasourceFiles);

    logger.log(chalk.green('\n✅ External system built successfully!'));
    logger.log(chalk.blue(`System: ${systemKey}`));
    logger.log(chalk.blue(`Datasources: ${datasourceFiles.length}`));
  } catch (error) {
    throw new Error(`Failed to build external system: ${error.message}`);
  }
}

/**
 * Validate deployment prerequisites
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Validation result with systemFiles, datasourceFiles, and systemKey
 */
async function validateDeploymentPrerequisites(appName) {
  const { systemFiles: _systemFiles, datasourceFiles, systemKey } = await validateExternalSystemFiles(appName);
  return { systemFiles: _systemFiles, datasourceFiles, systemKey };
}

/**
 * Prepare deployment files and get authentication
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Object with applicationSchema, authConfig, controllerUrl, environment, and systemKey
 */
async function prepareDeploymentFiles(appName, options) {
  logger.log(chalk.blue('📋 Generating application schema...'));
  const applicationSchema = await generateExternalSystemApplicationSchema(appName);
  logger.log(chalk.green('✓ Application schema generated'));

  const config = await getConfig();
  const environment = options.environment || 'dev';
  const controllerUrl = options.controller || config.deployment?.controllerUrl || 'http://localhost:3000';
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  const { systemKey } = await validateDeploymentPrerequisites(appName);

  return { applicationSchema, authConfig, controllerUrl, environment, systemKey };
}

/**
 * Upload application and get upload ID
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} applicationSchema - Application schema
 * @returns {Promise<string>} Upload ID
 * @throws {Error} If upload fails
 */
async function uploadApplication(dataplaneUrl, authConfig, applicationSchema) {
  logger.log(chalk.blue('📤 Uploading application configuration...'));
  const uploadResponse = await uploadApplicationViaPipeline(dataplaneUrl, authConfig, applicationSchema);

  if (!uploadResponse.success || !uploadResponse.data) {
    throw new Error(`Failed to upload application: ${uploadResponse.error || uploadResponse.formattedError || 'Unknown error'}`);
  }

  const uploadData = uploadResponse.data.data || uploadResponse.data;
  const uploadId = uploadData.uploadId || uploadData.id;

  if (!uploadId) {
    throw new Error('Upload ID not found in upload response');
  }

  logger.log(chalk.green(`✓ Upload successful (ID: ${uploadId})`));
  return uploadId;
}

/**
 * Validate upload and display changes
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} uploadId - Upload ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<void>}
 * @throws {Error} If validation fails
 */
/**
 * Displays validation changes
 * @function displayValidationChanges
 * @param {Object[]} changes - Array of changes
 */
function displayValidationChanges(changes) {
  if (changes && changes.length > 0) {
    logger.log(chalk.blue('\n📋 Changes to be published:'));
    for (const change of changes) {
      const changeType = change.type || 'unknown';
      const changeEntity = change.entity || change.key || 'unknown';
      const emoji = changeType === 'new' ? '➕' : changeType === 'modified' ? '✏️' : '🗑️';
      logger.log(chalk.gray(`  ${emoji} ${changeType}: ${changeEntity}`));
    }
  }
}

/**
 * Validates upload response
 * @function validateUploadResponse
 * @param {Object} validateResponse - Validation response
 * @returns {Object} Validation data
 * @throws {Error} If validation failed
 */
function validateUploadResponse(validateResponse) {
  if (!validateResponse.success || !validateResponse.data) {
    throw new Error(`Validation failed: ${validateResponse.error || validateResponse.formattedError || 'Unknown error'}`);
  }

  return validateResponse.data.data || validateResponse.data;
}

async function validateUpload(dataplaneUrl, uploadId, authConfig) {
  logger.log(chalk.blue('🔍 Validating upload...'));
  const validateResponse = await validateUploadViaPipeline(dataplaneUrl, uploadId, authConfig);

  const validateData = validateUploadResponse(validateResponse);

  displayValidationChanges(validateData.changes);

  if (validateData.summary) {
    logger.log(chalk.blue(`\n📊 Summary: ${validateData.summary}`));
  }

  logger.log(chalk.green('✓ Validation successful'));
}

/**
 * Publish application
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} uploadId - Upload ID
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Publish options
 * @param {boolean} [options.generateMcpContract] - Generate MCP contract (default: true)
 * @returns {Promise<Object>} Publish response data
 * @throws {Error} If publish fails
 */
async function publishApplication(dataplaneUrl, uploadId, authConfig, options) {
  const generateMcpContract = options.generateMcpContract !== false; // Default to true
  logger.log(chalk.blue(`📢 Publishing application (MCP contract: ${generateMcpContract ? 'enabled' : 'disabled'})...`));

  const publishResponse = await publishUploadViaPipeline(dataplaneUrl, uploadId, authConfig, { generateMcpContract });

  if (!publishResponse.success || !publishResponse.data) {
    throw new Error(`Failed to publish application: ${publishResponse.error || publishResponse.formattedError || 'Unknown error'}`);
  }

  return publishResponse.data.data || publishResponse.data;
}

/**
 * Publishes external system to dataplane using application-level workflow
 * Uses upload → validate → publish workflow for atomic deployment
 * @async
 * @function deployExternalSystem
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {string} [options.controller] - Controller URL
 * @param {boolean} [options.skipValidation] - Skip validation step and go straight to publish
 * @param {boolean} [options.generateMcpContract] - Generate MCP contract (default: true)
 * @returns {Promise<void>} Resolves when deployment completes
 * @throws {Error} If deployment fails
 */
async function deployExternalSystem(appName, options = {}) {
  try {
    logger.log(chalk.blue(`\n🚀 Publishing external system: ${appName}`));

    // Validate prerequisites
    const { datasourceFiles } = await validateDeploymentPrerequisites(appName);

    // Prepare deployment files and get authentication
    const { applicationSchema, authConfig, controllerUrl, environment, systemKey } = await prepareDeploymentFiles(appName, options);

    // Get dataplane URL from controller
    logger.log(chalk.blue('🌐 Getting dataplane URL from controller...'));
    const dataplaneUrl = await getDataplaneUrl(controllerUrl, appName, environment, authConfig);
    logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));

    // Step 1: Upload application
    const uploadId = await uploadApplication(dataplaneUrl, authConfig, applicationSchema);

    // Step 2: Validate upload (optional, can be skipped)
    if (!options.skipValidation) {
      await validateUpload(dataplaneUrl, uploadId, authConfig);
    } else {
      logger.log(chalk.yellow('⚠ Skipping validation step'));
    }

    // Step 3: Publish application
    const publishData = await publishApplication(dataplaneUrl, uploadId, authConfig, options);

    // Display success summary
    logger.log(chalk.green('\n✅ External system published successfully!'));
    logger.log(chalk.blue(`System: ${systemKey}`));
    if (publishData.systems && publishData.systems.length > 0) {
      logger.log(chalk.blue(`Published systems: ${publishData.systems.length}`));
    }
    if (publishData.dataSources && publishData.dataSources.length > 0) {
      logger.log(chalk.blue(`Published datasources: ${publishData.dataSources.length}`));
    } else {
      logger.log(chalk.blue(`Datasources: ${datasourceFiles.length}`));
    }
  } catch (error) {
    throw new Error(`Failed to deploy external system: ${error.message}`);
  }
}

module.exports = {
  buildExternalSystem,
  deployExternalSystem,
  validateExternalSystemFiles
};

