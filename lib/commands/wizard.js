/**
 * @fileoverview Wizard command handler - interactive and headless external system creation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const {
  promptForMode,
  promptForSystemIdOrKey,
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
const {
  validateAndCheckAppDirectory,
  formatDataplaneRejectedTokenMessage,
  handleOpenApiParsing,
  handleCredentialSelection,
  handleTypeDetection,
  handleConfigurationGeneration,
  validateWizardConfiguration,
  handleFileSaving,
  setupDataplaneAndAuth
} = require('./wizard-core');
const { handleWizardHeadless } = require('./wizard-headless');
const { createWizardSession, updateWizardSession } = require('../api/wizard.api');

/**
 * Extract session ID from response data
 * @function extractSessionId
 * @param {Object} responseData - Response data from API
 * @returns {string} Session ID
 * @throws {Error} If session ID not found or invalid
 */
function extractSessionId(responseData) {
  let sessionId = responseData?.data?.sessionId || responseData?.sessionId ||
                  responseData?.data?.session_id || responseData?.session_id;
  if (sessionId && typeof sessionId === 'object') {
    sessionId = sessionId.id || sessionId.sessionId || sessionId.session_id;
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error(`Session ID not found: ${JSON.stringify(responseData, null, 2)}`);
  }
  return sessionId;
}

/**
 * Handle interactive mode selection step
 * @async
 * @function handleInteractiveModeSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} [appName] - Application name (for 401 hint)
 * @returns {Promise<Object>} Object with mode and sessionId
 */
async function handleInteractiveModeSelection(dataplaneUrl, authConfig, appName) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 1: Mode Selection'));
  const mode = await promptForMode();
  let systemIdOrKey = null;
  if (mode === 'add-datasource') {
    systemIdOrKey = await promptForSystemIdOrKey();
  }
  const sessionResponse = await createWizardSession(dataplaneUrl, authConfig, mode, systemIdOrKey);
  if (!sessionResponse.success || !sessionResponse.data) {
    const errorMsg = sessionResponse.formattedError || sessionResponse.error ||
                     sessionResponse.errorData?.detail || sessionResponse.message ||
                     (sessionResponse.status ? `HTTP ${sessionResponse.status}` : 'Unknown error');
    const apiMessage = sessionResponse.errorData?.message || sessionResponse.errorData?.detail || sessionResponse.error || '';
    const fullMsg = sessionResponse.status === 401
      ? formatDataplaneRejectedTokenMessage(dataplaneUrl, appName, apiMessage)
      : `Failed to create wizard session: ${errorMsg}`;
    throw new Error(fullMsg);
  }
  const sessionId = extractSessionId(sessionResponse.data);
  return { mode, sessionId, systemIdOrKey };
}

/**
 * Handle interactive source selection step
 * @async
 * @function handleInteractiveSourceSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} sessionId - Wizard session ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} Object with sourceType and sourceData
 */
async function handleInteractiveSourceSelection(dataplaneUrl, sessionId, authConfig) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 2: Source Selection'));
  const sourceType = await promptForSourceType();
  let sourceData = null;
  const updateData = { currentStep: 1 };

  if (sourceType === 'openapi-file') {
    sourceData = await promptForOpenApiFile();
  } else if (sourceType === 'openapi-url') {
    sourceData = await promptForOpenApiUrl();
    updateData.openapiSpec = null;
  } else if (sourceType === 'mcp-server') {
    const mcpDetails = await promptForMcpServer();
    sourceData = JSON.stringify(mcpDetails);
    updateData.mcpServerUrl = mcpDetails.url || null;
  } else if (sourceType === 'known-platform') {
    sourceData = await promptForKnownPlatform();
  }

  const updateResponse = await updateWizardSession(dataplaneUrl, sessionId, authConfig, updateData);
  if (!updateResponse.success) {
    throw new Error(`Source selection failed: ${updateResponse.error || updateResponse.formattedError}`);
  }

  return { sourceType, sourceData };
}

/**
 * Handle interactive configuration generation step
 * @async
 * @function handleInteractiveConfigGeneration
 * @param {Object} options - Configuration options
 * @param {string} options.dataplaneUrl - Dataplane URL
 * @param {Object} options.authConfig - Authentication configuration
 * @param {string} options.mode - Selected mode
 * @param {Object} options.openapiSpec - OpenAPI specification
 * @param {Object} options.detectedType - Detected type info
 * @param {string} [options.credentialIdOrKey] - Credential ID or key (optional)
 * @param {string} [options.systemIdOrKey] - System ID or key (optional)
 * @returns {Promise<Object>} Generated configuration
 */
async function handleInteractiveConfigGeneration(options) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 5: User Preferences'));
  const userIntent = await promptForUserIntent();
  const preferences = await promptForUserPreferences();

  const configPrefs = {
    intent: userIntent,
    enableMCP: preferences.mcp,
    enableABAC: preferences.abac,
    enableRBAC: preferences.rbac
  };

  return await handleConfigurationGeneration(options.dataplaneUrl, options.authConfig, {
    mode: options.mode,
    openapiSpec: options.openapiSpec,
    detectedType: options.detectedType,
    configPrefs,
    credentialIdOrKey: options.credentialIdOrKey,
    systemIdOrKey: options.systemIdOrKey
  });
}

/**
 * Handle configuration review and validation step (interactive mode only)
 * @async
 * @function handleConfigurationReview
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Datasource configurations
 * @returns {Promise<Object>} Final configurations
 */
async function handleConfigurationReview(dataplaneUrl, authConfig, systemConfig, datasourceConfigs) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 6-7: Review & Validate'));
  const reviewResult = await promptForConfigReview(systemConfig, datasourceConfigs);

  if (reviewResult.action === 'cancel') {
    logger.log(chalk.yellow('Wizard cancelled.'));
    return null;
  }

  const finalSystemConfig = reviewResult.systemConfig || systemConfig;
  const finalDatasourceConfigs = reviewResult.datasourceConfigs || datasourceConfigs;

  await validateWizardConfiguration(dataplaneUrl, authConfig, finalSystemConfig, finalDatasourceConfigs);

  return { systemConfig: finalSystemConfig, datasourceConfigs: finalDatasourceConfigs };
}

/**
 * Execute wizard flow steps (interactive mode)
 * @async
 * @function executeWizardFlow
 * @param {string} appName - Application name
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<void>} Resolves when wizard flow completes
 */
async function executeWizardFlow(appName, dataplaneUrl, authConfig) {
  // Step 1: Mode Selection
  const { mode, sessionId, systemIdOrKey } = await handleInteractiveModeSelection(dataplaneUrl, authConfig, appName);

  // Step 2: Source Selection
  const { sourceType, sourceData } = await handleInteractiveSourceSelection(dataplaneUrl, sessionId, authConfig);

  // Parse OpenAPI (part of step 2)
  const openapiSpec = await handleOpenApiParsing(dataplaneUrl, authConfig, sourceType, sourceData);

  // Step 3: Credential Selection (optional)
  const credentialIdOrKey = await handleCredentialSelection(dataplaneUrl, authConfig);

  // Step 4: Detect Type
  const detectedType = await handleTypeDetection(dataplaneUrl, authConfig, openapiSpec);

  // Step 5: Generate Configuration
  const { systemConfig, datasourceConfigs, systemKey } = await handleInteractiveConfigGeneration({
    dataplaneUrl,
    authConfig,
    mode,
    openapiSpec,
    detectedType,
    credentialIdOrKey,
    systemIdOrKey
  });

  // Step 6-7: Review & Validate
  const finalConfigs = await handleConfigurationReview(dataplaneUrl, authConfig, systemConfig, datasourceConfigs);
  if (!finalConfigs) return;

  // Step 7: Save Files
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
 * @param {string} [options.config] - Path to wizard.yaml config file (headless mode)
 * @returns {Promise<void>} Resolves when wizard completes
 * @throws {Error} If wizard fails
 */
async function handleWizard(options = {}) {
  // Check if headless mode (config file provided)
  if (options.config) {
    return await handleWizardHeadless(options);
  }

  logger.log(chalk.blue('\n\uD83E\uDDD9 AI Fabrix External System Wizard\n'));

  // Get or prompt for app name
  let appName = options.app;
  if (!appName) {
    appName = await promptForAppName();
  }

  // Validate app name and check directory
  const shouldContinue = await validateAndCheckAppDirectory(appName, true);
  if (!shouldContinue) {
    return;
  }

  // Get dataplane URL and authentication
  const { dataplaneUrl, authConfig } = await setupDataplaneAndAuth(options, appName);

  // Execute wizard flow
  await executeWizardFlow(appName, dataplaneUrl, authConfig);
}

module.exports = { handleWizard, handleWizardHeadless };
