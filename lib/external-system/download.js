/**
 * External System Download Module
 *
 * Downloads external systems from dataplane to local development structure.
 * Supports downloading system configuration and datasources for local development.
 *
 * @fileoverview External system download functionality for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { getExternalSystemConfig } = require('../api/external-systems.api');
const { getDeploymentAuth } = require('../utils/token-manager');
const { getConfig } = require('../core/config');
const { detectAppType } = require('../utils/paths');
const logger = require('../utils/logger');
const { writeConfigFile } = require('../utils/config-format');
const { generateEnvTemplate } = require('../utils/external-system-env-helpers');
const { generateVariablesYaml, generateReadme } = require('./download-helpers');
const { resolveControllerUrl } = require('../utils/controller-url');

/**
 * Validates system type from downloaded application
 * @param {Object} application - External system configuration
 * @returns {string} System type (openapi, mcp, custom)
 * @throws {Error} If system type is invalid
 */
function validateSystemType(application) {
  if (!application || typeof application !== 'object') {
    throw new Error('Application configuration is required');
  }

  const validTypes = ['openapi', 'mcp', 'custom'];
  const systemType = application.type;

  if (!systemType || !validTypes.includes(systemType)) {
    throw new Error(`Invalid system type: ${systemType}. Must be one of: ${validTypes.join(', ')}`);
  }

  return systemType;
}

/**
 * Validates downloaded data structure before writing files
 * @param {Object} application - External system configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @throws {Error} If validation fails
 */
/**
 * Validates application configuration
 * @function validateApplicationConfig
 * @param {Object} application - Application configuration
 * @throws {Error} If validation fails
 */
function validateApplicationConfig(application) {
  if (!application || typeof application !== 'object') {
    throw new Error('Application configuration is required');
  }
  if (!application.key || typeof application.key !== 'string') {
    throw new Error('Application key is required');
  }
}

/**
 * Validates datasource configuration
 * @function validateDatasourceConfig
 * @param {Object} datasource - Datasource configuration
 * @param {string} applicationKey - Application key
 * @throws {Error} If validation fails
 */
function validateDatasourceConfig(datasource, applicationKey) {
  if (!datasource.key || typeof datasource.key !== 'string') {
    throw new Error('Datasource key is required for all datasources');
  }
  if (!datasource.systemKey || typeof datasource.systemKey !== 'string') {
    throw new Error('Datasource systemKey is required for all datasources');
  }
  if (datasource.systemKey !== applicationKey) {
    throw new Error(`Datasource systemKey (${datasource.systemKey}) does not match application key (${applicationKey})`);
  }
}

function validateDownloadedData(application, dataSources) {
  validateApplicationConfig(application);

  if (!Array.isArray(dataSources)) {
    throw new Error('DataSources must be an array');
  }

  for (const datasource of dataSources) {
    validateDatasourceConfig(datasource, application.key);
  }
}

/**
 * Handles partial download errors gracefully
 * @param {string} systemKey - System key
 * @param {Object} systemData - System data that was successfully downloaded
 * @param {Array<Error>} datasourceErrors - Array of errors from datasource downloads
 * @throws {Error} Aggregated error message
 */
function handlePartialDownload(systemKey, systemData, datasourceErrors) {
  if (datasourceErrors.length === 0) {
    return;
  }

  const errorMessages = datasourceErrors.map(err => err.message).join('\n  - ');
  throw new Error(
    `Partial download completed for system '${systemKey}', but some datasources failed:\n  - ${errorMessages}\n\n` +
    'System configuration was downloaded successfully. You may need to download datasources separately.'
  );
}

/**
 * Setup authentication and get dataplane URL
 * @async
 * @param {string} systemKey - System key
 * @param {Object} options - Download options
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Object with authConfig and dataplaneUrl
 * @throws {Error} If authentication fails
 */
async function setupAuthenticationAndDataplane(systemKey, _options, _config) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, systemKey);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
  logger.log(chalk.blue('🌐 Resolving dataplane URL...'));
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
  logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));

  return { authConfig, dataplaneUrl };
}

/**
 * Download system configuration from dataplane
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Object with application and dataSources
 * @throws {Error} If download fails
 */
async function downloadSystemConfiguration(dataplaneUrl, systemKey, authConfig) {
  logger.log(chalk.blue(`📡 Downloading system configuration: ${systemKey}`));
  const response = await getExternalSystemConfig(dataplaneUrl, systemKey, authConfig);

  if (!response.success || !response.data) {
    throw new Error(`Failed to download system configuration: ${response.error || response.formattedError || 'Unknown error'}`);
  }

  const downloadData = response.data.data || response.data;
  let application = downloadData.application;
  let dataSources = downloadData.dataSources || [];

  // Handle case where datasources are inline in application.configuration.dataSources
  if (!application && downloadData.configuration) {
    application = downloadData;
  }
  if (application && application.configuration && Array.isArray(application.configuration.dataSources)) {
    dataSources = [...dataSources, ...application.configuration.dataSources];
    // Remove inline datasources from application to avoid duplication
    const { dataSources: _inlineDataSources, ...configWithoutDataSources } = application.configuration;
    application = { ...application, configuration: configWithoutDataSources };
  }

  if (!application) {
    throw new Error('Application configuration not found in download response');
  }

  return { application, dataSources };
}

/**
 * Generate files in temporary directory
 * @async
 * @param {string} tempDir - Temporary directory path
 * @param {string} systemKey - System key
 * @param {Object} application - Application configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @returns {Promise<Object>} Object with file paths
 * @throws {Error} If file generation fails
 */
/**
 * Generates system file
 * @async
 * @function generateSystemFile
 * @param {string} tempDir - Temporary directory
 * @param {string} systemKey - System key
 * @param {Object} application - Application object
 * @returns {Promise<string>} System file path
 */
async function generateSystemFile(tempDir, systemKey, application) {
  const systemFileName = `${systemKey}-system.yaml`;
  const systemFilePath = path.join(tempDir, systemFileName);
  writeConfigFile(systemFilePath, application);
  return systemFilePath;
}

/**
 * Generates datasource files
 * @async
 * @function generateDatasourceFiles
 * @param {string} tempDir - Temporary directory
 * @param {string} systemKey - System key
 * @param {Array} dataSources - Array of datasource objects
 * @returns {Promise<Object>} Object with datasourceFiles array and datasourceErrors array
 */
async function generateDatasourceFiles(tempDir, systemKey, dataSources) {
  const datasourceErrors = [];
  const datasourceFiles = [];
  for (const datasource of dataSources) {
    try {
      const datasourceKey = datasource.key || '';
      // Extract datasource key (remove system key prefix if present)
      let datasourceKeyOnly;
      if (datasourceKey.startsWith(`${systemKey}-`)) {
        datasourceKeyOnly = datasourceKey.substring(systemKey.length + 1);
      } else {
        const entityType = datasource.entityType || datasource.entityKey || datasourceKey.split('-').pop();
        datasourceKeyOnly = entityType;
      }
      const datasourceFileName = `${systemKey}-datasource-${datasourceKeyOnly}.yaml`;
      const datasourceFilePath = path.join(tempDir, datasourceFileName);
      writeConfigFile(datasourceFilePath, datasource);
      datasourceFiles.push(datasourceFilePath);
    } catch (error) {
      datasourceErrors.push(new Error(`Failed to write datasource ${datasource.key}: ${error.message}`));
    }
  }
  return { datasourceFiles, datasourceErrors };
}

/**
 * Generates configuration files (application.yaml, env.template, README.md)
 * @async
 * @function generateConfigFiles
 * @param {string} tempDir - Temporary directory
 * @param {string} systemKey - System key
 * @param {Object} application - Application object
 * @param {Array} dataSources - Array of datasource objects
 * @returns {Promise<Object>} Object with file paths
 */
async function generateConfigFiles(tempDir, systemKey, application, dataSources) {
  // Generate application.yaml
  const variables = generateVariablesYaml(systemKey, application, dataSources);
  const variablesPath = path.join(tempDir, 'application.yaml');
  await fs.writeFile(variablesPath, yaml.dump(variables, { indent: 2, lineWidth: 120, noRefs: true }), 'utf8');

  // Generate env.template
  const envTemplate = generateEnvTemplate(application);
  const envTemplatePath = path.join(tempDir, 'env.template');
  await fs.writeFile(envTemplatePath, envTemplate, 'utf8');

  // Generate README.md
  const readme = generateReadme(systemKey, application, dataSources);
  const readmePath = path.join(tempDir, 'README.md');
  await fs.writeFile(readmePath, readme, 'utf8');

  return { variablesPath, envTemplatePath, readmePath };
}

async function generateFilesInTempDir(tempDir, systemKey, application, dataSources) {
  const systemFilePath = await generateSystemFile(tempDir, systemKey, application);

  const { datasourceFiles, datasourceErrors } = await generateDatasourceFiles(tempDir, systemKey, dataSources);

  // Handle partial downloads
  if (datasourceErrors.length > 0) {
    handlePartialDownload(systemKey, application, datasourceErrors);
  }

  const { variablesPath, envTemplatePath, readmePath } = await generateConfigFiles(tempDir, systemKey, application, dataSources);

  return {
    systemFilePath,
    variablesPath,
    envTemplatePath,
    readmePath,
    datasourceFiles
  };
}

/**
 * Move files from temporary directory to final location
 * @async
 * @param {string} tempDir - Temporary directory path
 * @param {string} finalPath - Final destination path
 * @param {string} systemKey - System key
 * @param {Object} filePaths - Object with file paths
 * @throws {Error} If file move fails
 */
async function moveFilesToFinalLocation(tempDir, finalPath, systemKey, filePaths) {
  logger.log(chalk.blue(`📁 Creating directory: ${finalPath}`));
  await fs.mkdir(finalPath, { recursive: true });

  const systemFileName = `${systemKey}-system.json`;
  const filesToMove = [
    { from: filePaths.systemFilePath, to: path.join(finalPath, systemFileName) },
    { from: filePaths.variablesPath, to: path.join(finalPath, 'application.yaml') },
    { from: filePaths.envTemplatePath, to: path.join(finalPath, 'env.template') },
    { from: filePaths.readmePath, to: path.join(finalPath, 'README.md') }
  ];

  for (const dsFile of filePaths.datasourceFiles) {
    const fileName = path.basename(dsFile);
    filesToMove.push({ from: dsFile, to: path.join(finalPath, fileName) });
  }

  for (const file of filesToMove) {
    await fs.copyFile(file.from, file.to);
    logger.log(chalk.green(`✓ Created: ${path.relative(process.cwd(), file.to)}`));
  }
}

/**
 * Validate system key format
 * @param {string} systemKey - System key to validate
 * @throws {Error} If system key format is invalid
 */
function validateSystemKeyFormat(systemKey) {
  if (!systemKey || typeof systemKey !== 'string') {
    throw new Error('System key is required and must be a string');
  }
  if (!/^[a-z0-9-_]+$/.test(systemKey)) {
    throw new Error('System key must contain only lowercase letters, numbers, hyphens, and underscores');
  }
}

/**
 * Handle dry run mode
 * @param {string} systemKey - System key
 * @param {string} dataplaneUrl - Dataplane URL
 */
function handleDryRun(systemKey, dataplaneUrl) {
  logger.log(chalk.yellow('🔍 Dry run mode - would download from:'));
  logger.log(chalk.gray(`  ${dataplaneUrl}/api/v1/external/systems/${systemKey}/config`));
  logger.log(chalk.yellow('\nWould create:'));
  logger.log(chalk.gray(`  integration/${systemKey}/`));
  logger.log(chalk.gray(`  integration/${systemKey}/application.yaml`));
  logger.log(chalk.gray(`  integration/${systemKey}/${systemKey}-system.yaml`));
  logger.log(chalk.gray(`  integration/${systemKey}/env.template`));
  logger.log(chalk.gray(`  integration/${systemKey}/README.md`));
}

/**
 * Validate and log downloaded data
 * @param {Object} application - Application configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @returns {string} System type
 */
function validateAndLogDownloadedData(application, dataSources) {
  logger.log(chalk.blue('🔍 Validating downloaded data...'));
  validateDownloadedData(application, dataSources);
  const systemType = validateSystemType(application);
  logger.log(chalk.green(`✓ System type: ${systemType}`));
  logger.log(chalk.green(`✓ Found ${dataSources.length} datasource(s)`));
  return systemType;
}

/**
 * Process downloaded system (generate files, move, cleanup)
 * @async
 * @param {string} systemKey - System key
 * @param {Object} application - Application configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @param {string} tempDir - Temporary directory path
 * @returns {Promise<string>} Final destination path
 * @throws {Error} If processing fails
 */
async function processDownloadedSystem(systemKey, application, dataSources, tempDir) {
  // Generate files in temporary folder first
  const filePaths = await generateFilesInTempDir(tempDir, systemKey, application, dataSources);

  // Determine final destination (integration folder)
  const { appPath } = await detectAppType(systemKey);
  const finalPath = appPath || path.join(process.cwd(), 'integration', systemKey);

  // Move files from temp to final location
  await moveFilesToFinalLocation(tempDir, finalPath, systemKey, filePaths);

  // Clean up temporary folder
  await fs.rm(tempDir, { recursive: true, force: true });

  return finalPath;
}

/**
 * Display download success message
 * @param {string} systemKey - System key
 * @param {string} finalPath - Final destination path
 * @param {number} datasourceCount - Number of datasources
 */
function displayDownloadSuccess(systemKey, finalPath, datasourceCount) {
  logger.log(chalk.green('\n✅ External system downloaded successfully!'));
  logger.log(chalk.blue(`Location: ${finalPath}`));
  logger.log(chalk.blue(`System: ${systemKey}`));
  logger.log(chalk.blue(`Datasources: ${datasourceCount}`));
}

/**
 * Downloads external system from dataplane to local development structure
 * @async
 * @function downloadExternalSystem
 * @param {string} systemKey - System key or ID
 * @param {Object} options - Download options
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {string} [options.controller] - Controller URL
 * @param {boolean} [options.dryRun] - Show what would be downloaded without actually downloading
 * @returns {Promise<void>} Resolves when download completes
 * @throws {Error} If download fails
 */
async function downloadExternalSystem(systemKey, options = {}) {
  validateSystemKeyFormat(systemKey);

  try {
    logger.log(chalk.blue(`\n📥 Downloading external system: ${systemKey}`));

    // Get authentication and dataplane URL
    const config = await getConfig();
    const { authConfig, dataplaneUrl } = await setupAuthenticationAndDataplane(systemKey, options, config);

    // Handle dry run
    if (options.dryRun) {
      handleDryRun(systemKey, dataplaneUrl);
      return;
    }

    // Download system configuration
    const { application, dataSources } = await downloadSystemConfiguration(dataplaneUrl, systemKey, authConfig);

    // Validate downloaded data
    validateAndLogDownloadedData(application, dataSources);

    // Create temporary folder for validation
    const tempDir = path.join(os.tmpdir(), `aifabrix-download-${systemKey}-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const finalPath = await processDownloadedSystem(systemKey, application, dataSources, tempDir);
      displayDownloadSuccess(systemKey, finalPath, dataSources.length);
    } catch (error) {
      // Clean up temporary folder on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  } catch (error) {
    throw new Error(`Failed to download external system: ${error.message}`);
  }
}

module.exports = {
  downloadExternalSystem,
  validateSystemType,
  validateDownloadedData,
  generateVariablesYaml,
  generateReadme,
  generateEnvTemplate,
  handlePartialDownload
};
