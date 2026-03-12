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
const { discoverEntities } = require('../api/wizard.api');
const { validateEntityNameForOpenApi } = require('../validation/wizard-datasource-validation');

/**
 * Validate entityName for headless config (throws if invalid)
 * @async
 * @param {string} entityName - Entity from source
 * @param {Object} openapiSpec - OpenAPI spec
 * @param {string} sourceType - Source type
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Auth config
 * @throws {Error} If entityName invalid
 */
async function validateHeadlessEntityName(entityName, openapiSpec, sourceType, dataplaneUrl, authConfig) {
  if (!entityName || !openapiSpec || sourceType === 'known-platform') return;
  const discoverResponse = await discoverEntities(dataplaneUrl, authConfig, openapiSpec);
  const entities = discoverResponse?.data?.entities || [];
  const validation = validateEntityNameForOpenApi(entityName, entities);
  if (!validation.valid) {
    const available = entities.map(e => e.name).join(', ');
    throw new Error(`Invalid entityName '${entityName}'. Available from discover-entities: ${available || 'none'}`);
  }
}

/**
 * Execute wizard flow from config file (headless mode)
 * @async
 * @function executeWizardFromConfig
 * @param {Object} wizardConfig - Validated wizard configuration
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [opts] - Optional overrides
 * @param {boolean} [opts.debug] - Enable debug (CLI --debug); overrides wizard.yaml preferences.debug
 * @returns {Promise<void>} Resolves when wizard flow completes
 * @throws {Error} If wizard flow fails
 */
async function executeWizardFromConfig(wizardConfig, dataplaneUrl, authConfig, opts = {}) {
  const { appName, mode, systemIdOrKey, source, credential, preferences } = wizardConfig;
  const configPrefs = { ...preferences };
  if (opts.debug === true) configPrefs.debug = true;

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

  await validateHeadlessEntityName(source?.entityName, openapiSpec, sourceType, dataplaneUrl, authConfig);

  // Step 5: Generate Configuration
  const { systemConfig, datasourceConfigs, systemKey } = await handleConfigurationGeneration(dataplaneUrl, authConfig, {
    mode,
    openapiSpec,
    detectedType,
    configPrefs,
    credentialIdOrKey,
    systemIdOrKey,
    sourceType,
    platformKey: sourceType === 'known-platform' ? sourceData : undefined,
    datasourceKeys: source?.datasourceKeys,
    configurationValues: source?.configurationValues,
    entityName: source?.entityName,
    appName,
    systemDisplayName: wizardConfig.systemDisplayName
  });

  // Step 6: Validate Configuration
  const debugOpts = opts.debug ? { debug: true, appName } : {};
  await validateWizardConfiguration(dataplaneUrl, authConfig, systemConfig, datasourceConfigs, debugOpts);

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
  if (options.debug) {
    logger.log(chalk.gray('[DEBUG] Wizard debug mode enabled'));
  }

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
  await executeWizardFromConfig(wizardConfig, dataplaneUrl, authConfig, { debug: options.debug });
}

module.exports = { handleWizardHeadless, executeWizardFromConfig };
