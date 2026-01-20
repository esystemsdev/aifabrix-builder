/**
 * @fileoverview Wizard command handler - interactive external system creation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const config = require('../core/config');
const { getDeviceOnlyAuth } = require('../utils/token-manager');
const { getDataplaneUrl } = require('../datasource/deploy');
const { resolveControllerUrl } = require('../utils/controller-url');
const {
  createWizardSession,
  updateWizardSession,
  parseOpenApi,
  detectType,
  generateConfig,
  validateWizardConfig,
  getDeploymentDocs
} = require('../api/wizard.api');
const {
  promptForMode,
  promptForSourceType,
  promptForOpenApiFile,
  promptForOpenApiUrl,
  promptForMcpServer,
  promptForKnownPlatform,
  promptForUserIntent,
  promptForUserPreferences,
  promptForConfigReview,
  promptForAppName
} = require('../generator/wizard-prompts');
const { generateWizardFiles } = require('../generator/wizard');

/**
 * Validate app name and check if directory exists
 * @async
 * @function validateAndCheckAppDirectory
 * @param {string} appName - Application name
 * @returns {Promise<boolean>} True if should continue, false if cancelled
 * @throws {Error} If validation fails
 */
async function validateAndCheckAppDirectory(appName) {
  if (!/^[a-z0-9-_]+$/.test(appName)) {
    throw new Error('Application name must contain only lowercase letters, numbers, hyphens, and underscores');
  }
  const appPath = path.join(process.cwd(), 'integration', appName);
  try {
    await fs.access(appPath);
    const { overwrite } = await require('inquirer').prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Directory ${appPath} already exists. Overwrite?`,
      default: false
    }]);
    if (!overwrite) {
      logger.log(chalk.yellow('Wizard cancelled.'));
      return false;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  return true;
}

/**
 * Handle mode selection step - create wizard session
 * @async
 * @function handleModeSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Object with mode and sessionId
 * @throws {Error} If mode selection fails
 */
async function handleModeSelection(dataplaneUrl, authConfig) {
  logger.log(chalk.blue('\n📋 Step 1: Mode Selection'));
  const mode = await promptForMode();
  const sessionResponse = await createWizardSession(dataplaneUrl, authConfig, mode);
  if (!sessionResponse.success || !sessionResponse.data) {
    const errorMsg = sessionResponse.formattedError ||
                     sessionResponse.error ||
                     sessionResponse.errorData?.detail ||
                     sessionResponse.message ||
                     (sessionResponse.status ? `HTTP ${sessionResponse.status}` : 'Unknown error');
    throw new Error(`Failed to create wizard session: ${errorMsg}`);
  }
  const sessionId = sessionResponse.data.data?.sessionId || sessionResponse.data.sessionId;
  if (!sessionId) {
    throw new Error('Session ID not found in response');
  }
  return { mode, sessionId };
}

/**
 * Handle source selection step - update wizard session
 * @async
 * @function handleSourceSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} sessionId - Wizard session ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Object with sourceType and sourceData
 * @throws {Error} If source selection fails
 */
async function handleSourceSelection(dataplaneUrl, sessionId, authConfig) {
  logger.log(chalk.blue('\n📋 Step 2: Source Selection'));
  const sourceType = await promptForSourceType();
  let sourceData = null;
  const updateData = { currentStep: 1 };

  if (sourceType === 'openapi-file') {
    const filePath = await promptForOpenApiFile();
    sourceData = filePath;
  } else if (sourceType === 'openapi-url') {
    const url = await promptForOpenApiUrl();
    sourceData = url;
    updateData.openapiSpec = null; // Will be set after parsing
  } else if (sourceType === 'mcp-server') {
    const mcpDetails = await promptForMcpServer();
    sourceData = JSON.stringify(mcpDetails);
    updateData.mcpServerUrl = mcpDetails.url || null;
  } else if (sourceType === 'known-platform') {
    const platform = await promptForKnownPlatform();
    sourceData = platform;
  }

  const updateResponse = await updateWizardSession(dataplaneUrl, sessionId, authConfig, updateData);
  if (!updateResponse.success) {
    throw new Error(`Source selection failed: ${updateResponse.error || updateResponse.formattedError}`);
  }

  return { sourceType, sourceData };
}

/**
 * Parse OpenAPI file
 * @async
 * @function parseOpenApiFile
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} sourceData - Source data (file path)
 * @returns {Promise<Object>} OpenAPI spec
 * @throws {Error} If parsing fails
 */
async function parseOpenApiFile(dataplaneUrl, authConfig, sourceData) {
  logger.log(chalk.blue('\n📋 Step 3: Parsing OpenAPI File'));
  const spinner = ora('Parsing OpenAPI file...').start();
  try {
    const parseResponse = await parseOpenApi(dataplaneUrl, authConfig, sourceData);
    spinner.stop();
    if (!parseResponse.success) {
      throw new Error(`OpenAPI parsing failed: ${parseResponse.error || parseResponse.formattedError}`);
    }
    logger.log(chalk.green('✓ OpenAPI file parsed successfully'));
    return parseResponse.data?.spec;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Handle OpenAPI parsing step
 * @async
 * @function handleOpenApiParsing
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} sourceType - Source type
 * @param {string} sourceData - Source data
 * @returns {Promise<Object|null>} OpenAPI spec or null
 * @throws {Error} If parsing fails
 */
async function handleOpenApiParsing(dataplaneUrl, authConfig, sourceType, sourceData) {
  if (sourceType === 'openapi-file') {
    return await parseOpenApiFile(dataplaneUrl, authConfig, sourceData);
  }
  if (sourceType === 'openapi-url') {
    logger.log(chalk.blue('\n📋 Step 3: Parsing OpenAPI URL'));
    logger.log(chalk.green('✓ OpenAPI URL processed'));
    return null;
  }
  return null;
}

/**
 * Handle type detection step
 * @async
 * @function handleTypeDetection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} openApiSpec - OpenAPI specification
 * @returns {Promise<Object|null>} Detected type or null
 */
async function handleTypeDetection(dataplaneUrl, authConfig, openApiSpec) {
  if (!openApiSpec) {
    return null;
  }

  logger.log(chalk.blue('\n📋 Step 4: Detecting API Type'));
  const spinner = ora('Detecting API type...').start();
  try {
    const detectResponse = await detectType(dataplaneUrl, authConfig, openApiSpec);
    spinner.stop();
    if (detectResponse.success && detectResponse.data) {
      const detectedType = detectResponse.data;
      logger.log(chalk.green(`✓ API type detected: ${detectedType.apiType || 'unknown'}`));
      if (detectedType.category) {
        logger.log(chalk.gray(`  Category: ${detectedType.category}`));
      }
      return detectedType;
    }
  } catch (error) {
    spinner.stop();
    logger.log(chalk.yellow(`⚠ Type detection failed: ${error.message}`));
  }
  return null;
}

/**
 * Handle configuration generation step
 * @async
 * @function handleConfigurationGeneration
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} mode - Selected mode
 * @param {string} sourceType - Source type
 * @param {Object} openApiSpec - OpenAPI specification
 * @returns {Promise<Object>} Generated configuration with systemConfig, datasourceConfigs, and systemKey
 * @throws {Error} If generation fails
 */
async function handleConfigurationGeneration(dataplaneUrl, authConfig, mode, sourceType, openApiSpec) {
  logger.log(chalk.blue('\n📋 Step 5: User Preferences'));
  const userIntent = await promptForUserIntent();
  const preferences = await promptForUserPreferences();

  logger.log(chalk.blue('\n📋 Step 6: Generating Configuration'));
  const spinner = ora('Generating configuration via AI (this may take 10-30 seconds)...').start();
  try {
    const generateResponse = await generateConfig(dataplaneUrl, authConfig, {
      mode,
      sourceType,
      openApiSpec,
      userIntent,
      preferences
    });
    spinner.stop();
    if (!generateResponse.success) {
      throw new Error(`Configuration generation failed: ${generateResponse.error || generateResponse.formattedError}`);
    }

    const systemConfig = generateResponse.data?.systemConfig;
    const datasourceConfigs = generateResponse.data?.datasourceConfigs || [];
    const systemKey = generateResponse.data?.systemKey;

    if (!systemConfig) {
      throw new Error('System configuration not found in generation response');
    }

    logger.log(chalk.green('✓ Configuration generated successfully'));
    return { systemConfig, datasourceConfigs, systemKey };
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Validate wizard configuration
 * @async
 * @function validateWizardConfiguration
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Datasource configurations
 * @throws {Error} If validation fails
 */
async function validateWizardConfiguration(dataplaneUrl, authConfig, systemConfig, datasourceConfigs) {
  const validateSpinner = ora('Validating configuration...').start();
  try {
    const validateResponse = await validateWizardConfig(dataplaneUrl, authConfig, systemConfig, datasourceConfigs);
    validateSpinner.stop();
    if (!validateResponse.success || !validateResponse.data?.valid) {
      const errors = validateResponse.data?.errors || [];
      const errorMsg = errors.length > 0
        ? errors.map(e => e.message || e).join(', ')
        : validateResponse.error || validateResponse.formattedError || 'Validation failed';
      throw new Error(`Configuration validation failed: ${errorMsg}`);
    }
    logger.log(chalk.green('✓ Configuration validated successfully'));
    if (validateResponse.data?.warnings && validateResponse.data.warnings.length > 0) {
      logger.log(chalk.yellow('\n⚠ Warnings:'));
      validateResponse.data.warnings.forEach(warning => {
        logger.log(chalk.yellow(`  - ${warning.message || warning}`));
      });
    }
  } catch (error) {
    validateSpinner.stop();
    throw error;
  }
}

/**
 * Handle configuration review and validation step
 * @async
 * @function handleConfigurationReview
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Datasource configurations
 * @returns {Promise<Object>} Final configurations with systemConfig and datasourceConfigs
 * @throws {Error} If validation fails
 */
async function handleConfigurationReview(dataplaneUrl, authConfig, systemConfig, datasourceConfigs) {
  logger.log(chalk.blue('\n📋 Step 7: Review & Validate'));
  const reviewResult = await promptForConfigReview(systemConfig, datasourceConfigs);

  if (reviewResult.action === 'cancel') {
    logger.log(chalk.yellow('Wizard cancelled.'));
    return null;
  }

  // Use edited configs if user edited them
  const finalSystemConfig = reviewResult.systemConfig || systemConfig;
  const finalDatasourceConfigs = reviewResult.datasourceConfigs || datasourceConfigs;

  // Validate configuration
  await validateWizardConfiguration(dataplaneUrl, authConfig, finalSystemConfig, finalDatasourceConfigs);

  return { systemConfig: finalSystemConfig, datasourceConfigs: finalDatasourceConfigs };
}

/**
 * Handle file saving step
 * @async
 * @function handleFileSaving
 * @param {string} appName - Application name
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Datasource configurations
 * @param {string} systemKey - System key
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Generated files information
 * @throws {Error} If file saving fails
 */
async function handleFileSaving(appName, systemConfig, datasourceConfigs, systemKey, dataplaneUrl, authConfig) {
  logger.log(chalk.blue('\n📋 Step 8: Saving Files'));
  const saveSpinner = ora('Saving files...').start();
  try {
    let aiGeneratedReadme = null;
    if (systemKey && dataplaneUrl && authConfig) {
      try {
        const docsResponse = await getDeploymentDocs(dataplaneUrl, authConfig, systemKey);
        if (docsResponse.success && docsResponse.data?.content) {
          aiGeneratedReadme = docsResponse.data.content;
          logger.log(chalk.gray('  ✓ Fetched AI-generated README.md from dataplane'));
        }
      } catch (error) {
        logger.log(chalk.gray(`  ⚠ Could not fetch AI-generated README: ${error.message}`));
      }
    }
    const generatedFiles = await generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, { aiGeneratedReadme });
    saveSpinner.stop();
    logger.log(chalk.green('\n✓ Wizard completed successfully!'));
    logger.log(chalk.green(`\nFiles created in: ${generatedFiles.appPath}`));
    logger.log(chalk.blue('\nNext steps:'));
    [`  1. Review the generated files in integration/${appName}/`, '  2. Update env.template with your authentication details', `  3. Deploy using: ./deploy.sh or .\\deploy.ps1 (or aifabrix deploy ${appName})`].forEach(step => logger.log(chalk.gray(step)));
    return generatedFiles;
  } catch (error) {
    saveSpinner.stop();
    throw error;
  }
}

/**
 * Execute wizard flow steps
 * @async
 * @function executeWizardFlow
 * @param {string} appName - Application name
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<void>} Resolves when wizard flow completes
 * @throws {Error} If wizard flow fails
 */
async function executeWizardFlow(appName, dataplaneUrl, authConfig) {
  // Step 1: Mode Selection - Create wizard session
  const { mode, sessionId } = await handleModeSelection(dataplaneUrl, authConfig);

  // Step 2: Source Selection - Update session
  const { sourceType, sourceData } = await handleSourceSelection(dataplaneUrl, sessionId, authConfig);

  // Step 3: Parse OpenAPI (if applicable)
  const openApiSpec = await handleOpenApiParsing(dataplaneUrl, authConfig, sourceType, sourceData);

  // Step 4: Detect Type (optional, if OpenAPI spec available)
  await handleTypeDetection(dataplaneUrl, authConfig, openApiSpec);

  // Step 5-6: Generate Configuration
  const { systemConfig, datasourceConfigs, systemKey } = await handleConfigurationGeneration(
    dataplaneUrl,
    authConfig,
    mode,
    sourceType,
    openApiSpec
  );

  // Step 7: Review & Validate
  const finalConfigs = await handleConfigurationReview(dataplaneUrl, authConfig, systemConfig, datasourceConfigs);
  if (!finalConfigs) {
    return; // User cancelled
  }

  // Step 8: Save Files
  await handleFileSaving(
    appName,
    finalConfigs.systemConfig,
    finalConfigs.datasourceConfigs,
    systemKey || appName,
    dataplaneUrl,
    authConfig
  );
}

/**
 * Handle wizard command
 * @async
 * @function handleWizard
 * @param {Object} options - Command options
 * @param {string} [options.app] - Application name
 * @param {string} [options.controller] - Controller URL
 * @param {string} [options.environment] - Environment key
 * @param {string} [options.dataplane] - Dataplane URL (overrides controller lookup)
 * @returns {Promise<void>} Resolves when wizard completes
 * @throws {Error} If wizard fails
 */
async function handleWizard(options = {}) {
  logger.log(chalk.blue('\n🧙 AI Fabrix External System Wizard\n'));

  // Get or prompt for app name
  let appName = options.app;
  if (!appName) {
    appName = await promptForAppName();
  }

  // Validate app name and check directory
  const shouldContinue = await validateAndCheckAppDirectory(appName);
  if (!shouldContinue) {
    return;
  }

  // Get dataplane URL and authentication
  const { dataplaneUrl, authConfig } = await setupDataplaneAndAuth(options, appName);

  // Execute wizard flow
  await executeWizardFlow(appName, dataplaneUrl, authConfig);
}

/**
 * Setup dataplane URL and authentication
 * @async
 * @function setupDataplaneAndAuth
 * @param {Object} options - Command options
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Object with dataplaneUrl and authConfig
 * @throws {Error} If setup fails
 */
async function setupDataplaneAndAuth(options, appName) {
  const configData = await config.getConfig();
  const environment = options.environment || 'dev';
  const controllerUrl = await resolveControllerUrl(options, configData);
  // Wizard requires device token authentication (user-level), not client credentials
  const authConfig = await getDeviceOnlyAuth(controllerUrl);

  let dataplaneUrl = options.dataplane;
  if (!dataplaneUrl) {
    logger.log(chalk.blue('🌐 Getting dataplane URL from controller...'));
    try {
      dataplaneUrl = await getDataplaneUrl(controllerUrl, 'dataplane', environment, authConfig);
      logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));
    } catch (error) {
      const example = `aifabrix wizard -a ${appName} --dataplane https://dataplane.example.com -e ${environment} -c ${controllerUrl}`;
      throw new Error(`${error.message}\n\n💡 For new applications, provide the dataplane URL using:\n   --dataplane <dataplane-url>\n\n   Example: ${example}`);
    }
  }

  return { dataplaneUrl, authConfig };
}
module.exports = { handleWizard };
