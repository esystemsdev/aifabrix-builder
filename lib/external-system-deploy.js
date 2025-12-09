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
const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { authenticatedApiCall } = require('./utils/api');
const { getDeploymentAuth } = require('./utils/token-manager');
const { getConfig } = require('./config');
const logger = require('./utils/logger');
const { getDataplaneUrl } = require('./datasource-deploy');
const { detectAppType, getDeployJsonPath } = require('./utils/paths');
const { generateExternalSystemApplicationSchema } = require('./generator');

/**
 * Loads variables.yaml for an application
 * @async
 * @function loadVariablesYaml
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Variables configuration
 * @throws {Error} If file cannot be loaded
 */
async function loadVariablesYaml(appName) {
  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');
  const content = await fs.readFile(variablesPath, 'utf8');
  return yaml.load(content);
}

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
  const systemFiles = [];
  if (variables.externalIntegration.systems && variables.externalIntegration.systems.length > 0) {
    for (const systemFile of variables.externalIntegration.systems) {
      // Try new naming first: <app-name>-deploy.json in same folder
      const newSystemPath = getDeployJsonPath(appName, 'external', true);
      if (fsSync.existsSync(newSystemPath)) {
        systemFiles.push(newSystemPath);
      } else {
        // Fall back to specified path
        const systemPath = path.join(schemasPath, systemFile);
        try {
          await fs.access(systemPath);
          systemFiles.push(systemPath);
        } catch {
          throw new Error(`External system file not found: ${systemPath} (also checked: ${newSystemPath})`);
        }
      }
    }
  } else {
    throw new Error('No external system files specified in externalIntegration.systems');
  }

  // Validate datasource files (naming: <app-name>-deploy-<datasource-key>.json)
  const datasourceFiles = [];
  if (variables.externalIntegration.dataSources && variables.externalIntegration.dataSources.length > 0) {
    for (const datasourceFile of variables.externalIntegration.dataSources) {
      // Try same folder first (new structure)
      const datasourcePath = path.join(appPath, datasourceFile);
      try {
        await fs.access(datasourcePath);
        datasourceFiles.push(datasourcePath);
      } catch {
        // Fall back to schemaBasePath
        const fallbackPath = path.join(schemasPath, datasourceFile);
        try {
          await fs.access(fallbackPath);
          datasourceFiles.push(fallbackPath);
        } catch {
          throw new Error(`External datasource file not found: ${datasourcePath} or ${fallbackPath}`);
        }
      }
    }
  }

  // Extract systemKey from system file (remove -deploy.json suffix if present)
  const systemFileName = path.basename(systemFiles[0], '.json');
  const systemKey = systemFileName.replace(/-deploy$/, '');

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
async function buildExternalSystem(appName, options = {}) {
  try {
    logger.log(chalk.blue(`\n🔨 Building external system: ${appName}`));

    // Validate files
    const { systemFiles, datasourceFiles, systemKey } = await validateExternalSystemFiles(appName);

    // Get authentication
    const config = await getConfig();
    const environment = options.environment || 'dev';
    const controllerUrl = options.controller || config.deployment?.controllerUrl || 'http://localhost:3000';
    const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

    if (!authConfig.token && !authConfig.clientId) {
      throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
    }

    // Get dataplane URL from controller
    logger.log(chalk.blue('🌐 Getting dataplane URL from controller...'));
    const dataplaneUrl = await getDataplaneUrl(controllerUrl, appName, environment, authConfig);
    logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));

    // Deploy external system
    logger.log(chalk.blue(`Deploying external system: ${systemKey}...`));
    const systemContent = await fs.readFile(systemFiles[0], 'utf8');
    const systemJson = JSON.parse(systemContent);

    const systemResponse = await authenticatedApiCall(
      `${dataplaneUrl}/api/v1/pipeline/deploy`,
      {
        method: 'POST',
        body: JSON.stringify(systemJson)
      },
      authConfig.token
    );

    if (!systemResponse.success) {
      throw new Error(`Failed to deploy external system: ${systemResponse.error || systemResponse.formattedError}`);
    }

    logger.log(chalk.green(`✓ External system deployed: ${systemKey}`));

    // Deploy datasources
    for (const datasourceFile of datasourceFiles) {
      const datasourceName = path.basename(datasourceFile, '.json');
      logger.log(chalk.blue(`Deploying datasource: ${datasourceName}...`));

      const datasourceContent = await fs.readFile(datasourceFile, 'utf8');
      const datasourceJson = JSON.parse(datasourceContent);

      const datasourceResponse = await authenticatedApiCall(
        `${dataplaneUrl}/api/v1/pipeline/${systemKey}/deploy`,
        {
          method: 'POST',
          body: JSON.stringify(datasourceJson)
        },
        authConfig.token
      );

      if (!datasourceResponse.success) {
        throw new Error(`Failed to deploy datasource ${datasourceName}: ${datasourceResponse.error || datasourceResponse.formattedError}`);
      }

      logger.log(chalk.green(`✓ Datasource deployed: ${datasourceName}`));
    }

    logger.log(chalk.green('\n✅ External system built successfully!'));
    logger.log(chalk.blue(`System: ${systemKey}`));
    logger.log(chalk.blue(`Datasources: ${datasourceFiles.length}`));
  } catch (error) {
    throw new Error(`Failed to build external system: ${error.message}`);
  }
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

    // Validate files
    const { systemFiles: _systemFiles, datasourceFiles, systemKey } = await validateExternalSystemFiles(appName);

    // Generate application-schema.json structure
    logger.log(chalk.blue('📋 Generating application schema...'));
    const applicationSchema = await generateExternalSystemApplicationSchema(appName);
    logger.log(chalk.green('✓ Application schema generated'));

    // Get authentication
    const config = await getConfig();
    const environment = options.environment || 'dev';
    const controllerUrl = options.controller || config.deployment?.controllerUrl || 'http://localhost:3000';
    const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

    if (!authConfig.token && !authConfig.clientId) {
      throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
    }

    // Get dataplane URL from controller
    logger.log(chalk.blue('🌐 Getting dataplane URL from controller...'));
    const dataplaneUrl = await getDataplaneUrl(controllerUrl, appName, environment, authConfig);
    logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));

    // Step 1: Upload application
    logger.log(chalk.blue('📤 Uploading application configuration...'));
    const uploadResponse = await authenticatedApiCall(
      `${dataplaneUrl}/api/v1/pipeline/upload`,
      {
        method: 'POST',
        body: JSON.stringify(applicationSchema)
      },
      authConfig.token
    );

    if (!uploadResponse.success || !uploadResponse.data) {
      throw new Error(`Failed to upload application: ${uploadResponse.error || uploadResponse.formattedError || 'Unknown error'}`);
    }

    const uploadData = uploadResponse.data.data || uploadResponse.data;
    const uploadId = uploadData.uploadId || uploadData.id;

    if (!uploadId) {
      throw new Error('Upload ID not found in upload response');
    }

    logger.log(chalk.green(`✓ Upload successful (ID: ${uploadId})`));

    // Step 2: Validate upload (optional, can be skipped)
    if (!options.skipValidation) {
      logger.log(chalk.blue('🔍 Validating upload...'));
      const validateResponse = await authenticatedApiCall(
        `${dataplaneUrl}/api/v1/pipeline/upload/${uploadId}/validate`,
        {
          method: 'POST'
        },
        authConfig.token
      );

      if (!validateResponse.success || !validateResponse.data) {
        throw new Error(`Validation failed: ${validateResponse.error || validateResponse.formattedError || 'Unknown error'}`);
      }

      const validateData = validateResponse.data.data || validateResponse.data;

      // Display changes
      if (validateData.changes && validateData.changes.length > 0) {
        logger.log(chalk.blue('\n📋 Changes to be published:'));
        for (const change of validateData.changes) {
          const changeType = change.type || 'unknown';
          const changeEntity = change.entity || change.key || 'unknown';
          const emoji = changeType === 'new' ? '➕' : changeType === 'modified' ? '✏️' : '🗑️';
          logger.log(chalk.gray(`  ${emoji} ${changeType}: ${changeEntity}`));
        }
      }

      if (validateData.summary) {
        logger.log(chalk.blue(`\n📊 Summary: ${validateData.summary}`));
      }

      logger.log(chalk.green('✓ Validation successful'));
    } else {
      logger.log(chalk.yellow('⚠ Skipping validation step'));
    }

    // Step 3: Publish application
    const generateMcpContract = options.generateMcpContract !== false; // Default to true
    logger.log(chalk.blue(`📢 Publishing application (MCP contract: ${generateMcpContract ? 'enabled' : 'disabled'})...`));

    const publishResponse = await authenticatedApiCall(
      `${dataplaneUrl}/api/v1/pipeline/upload/${uploadId}/publish?generateMcpContract=${generateMcpContract}`,
      {
        method: 'POST'
      },
      authConfig.token
    );

    if (!publishResponse.success || !publishResponse.data) {
      throw new Error(`Failed to publish application: ${publishResponse.error || publishResponse.formattedError || 'Unknown error'}`);
    }

    const publishData = publishResponse.data.data || publishResponse.data;

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

