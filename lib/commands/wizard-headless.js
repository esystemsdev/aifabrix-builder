/**
 * @fileoverview Wizard headless mode handler - non-interactive external system creation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const {
  validateWizardConfig: validateWizardConfigFile,
  displayValidationResults
} = require('../validation/wizard-config-validator');
const {
  validateAndCheckAppDirectory,
  handleModeSelection,
  handleSourceSelection,
  handleOpenApiParsing,
  handleCredentialSelection,
  handleTypeDetection,
  handleConfigurationGeneration,
  validateWizardConfiguration,
  handleFileSaving,
  setupDataplaneAndAuth
} = require('./wizard-core');

/**
 * Execute wizard flow from config file (headless mode)
 * @async
 * @function executeWizardFromConfig
 * @param {Object} wizardConfig - Validated wizard configuration
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<void>} Resolves when wizard flow completes
 * @throws {Error} If wizard flow fails
 */
async function executeWizardFromConfig(wizardConfig, dataplaneUrl, authConfig) {
  const { appName, mode, systemIdOrKey, source, credential, preferences } = wizardConfig;

  // Step 1: Create Session
  const { sessionId } = await handleModeSelection(dataplaneUrl, authConfig, mode, systemIdOrKey);

  // Step 2: Source Selection & Parse
  const { sourceType, sourceData } = await handleSourceSelection(dataplaneUrl, sessionId, authConfig, source);

  // Parse OpenAPI
  const openapiSpec = await handleOpenApiParsing(dataplaneUrl, authConfig, sourceType, sourceData);

  // Step 3: Credential Selection (no retry prompt in headless)
  const credentialIdOrKey = await handleCredentialSelection(dataplaneUrl, authConfig, credential, { allowRetry: false });

  // Step 4: Detect Type
  const detectedType = await handleTypeDetection(dataplaneUrl, authConfig, openapiSpec);

  // Step 5: Generate Configuration
  const { systemConfig, datasourceConfigs, systemKey } = await handleConfigurationGeneration(dataplaneUrl, authConfig, {
    mode,
    openapiSpec,
    detectedType,
    configPrefs: preferences,
    credentialIdOrKey,
    systemIdOrKey
  });

  // Step 6: Validate Configuration
  await validateWizardConfiguration(dataplaneUrl, authConfig, systemConfig, datasourceConfigs);

  // Step 7: Save Files
  await handleFileSaving(
    appName,
    systemConfig,
    datasourceConfigs,
    systemKey || appName,
    dataplaneUrl,
    authConfig
  );
}

/**
 * Handle wizard command in headless mode (config file)
 * @async
 * @function handleWizardHeadless
 * @param {Object} options - Command options
 * @param {string} options.config - Path to wizard.yaml config file
 * @returns {Promise<void>} Resolves when wizard completes
 * @throws {Error} If wizard fails
 */
async function handleWizardHeadless(options) {
  logger.log(chalk.blue('\n\uD83E\uDDD9 AI Fabrix External System Wizard (Headless Mode)\n'));
  logger.log(chalk.gray(`Reading configuration from: ${options.config}`));

  // Validate wizard config file
  const validationResult = await validateWizardConfigFile(options.config);
  if (!validationResult.valid) {
    displayValidationResults(validationResult);
    throw new Error('Wizard configuration validation failed');
  }
  logger.log(chalk.green('\u2713 Configuration file validated'));

  const wizardConfig = validationResult.config;
  const appName = wizardConfig.appName;

  // Validate app name and check directory (non-interactive)
  const shouldContinue = await validateAndCheckAppDirectory(appName, false);
  if (!shouldContinue) {
    return;
  }

  // Get dataplane URL and authentication (controller/environment from config.yaml)
  const { dataplaneUrl, authConfig } = await setupDataplaneAndAuth(options, appName);

  // Execute wizard flow from config
  await executeWizardFromConfig(wizardConfig, dataplaneUrl, authConfig);
}

module.exports = { handleWizardHeadless, executeWizardFromConfig };
