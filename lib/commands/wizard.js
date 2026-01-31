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
  promptForCredentialAction,
  promptForKnownPlatform,
  promptForUserIntent,
  promptForUserPreferences,
  promptForConfigReview,
  promptForAppName,
  promptForRunWithSavedConfig
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
const { createWizardSession, updateWizardSession, getWizardPlatforms } = require('../api/wizard.api');
const { getExternalSystem } = require('../api/external-systems.api');
const { writeWizardConfig, wizardConfigExists, validateWizardConfig } = require('../validation/wizard-config-validator');
const { appendWizardError } = require('../utils/cli-utils');
const {
  buildPreferencesForSave,
  buildWizardStateForSave,
  showWizardConfigSummary,
  ensureIntegrationDir,
  isExternalSystemForAddDatasource
} = require('./wizard-helpers');

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
 * Create wizard session with given mode and optional systemIdOrKey (no prompts)
 * @async
 * @function createSessionFromParams
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} mode - Mode ('create-system' | 'add-datasource')
 * @param {string} [systemIdOrKey] - System ID or key (for add-datasource)
 * @param {string} [appName] - Application name (for 401 hint)
 * @returns {Promise<string>} Session ID
 */
async function createSessionFromParams(dataplaneUrl, authConfig, mode, systemIdOrKey, appName) {
  const sessionResponse = await createWizardSession(dataplaneUrl, authConfig, mode, systemIdOrKey || null);
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
  return extractSessionId(sessionResponse.data);
}

/**
 * Handle interactive source selection step
 * @async
 * @function handleInteractiveSourceSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} sessionId - Wizard session ID
 * @param {Object} authConfig - Authentication configuration
 * @param {Array<{key: string, displayName?: string}>} [platforms] - Known platforms from dataplane (empty = hide "Known platform")
 * @returns {Promise<Object>} Object with sourceType and sourceData
 */
async function handleInteractiveSourceSelection(dataplaneUrl, sessionId, authConfig, platforms = []) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 2: Source Selection'));
  const sourceType = await promptForSourceType(platforms);
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
    sourceData = await promptForKnownPlatform(platforms);
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
 * @returns {Promise<Object>} Generated configuration and preferences { systemConfig, datasourceConfigs, systemKey, preferences }
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

  const result = await handleConfigurationGeneration(options.dataplaneUrl, options.authConfig, {
    mode: options.mode,
    openapiSpec: options.openapiSpec,
    detectedType: options.detectedType,
    configPrefs,
    credentialIdOrKey: options.credentialIdOrKey,
    systemIdOrKey: options.systemIdOrKey
  });

  return {
    ...result,
    preferences: buildPreferencesForSave(userIntent, preferences)
  };
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
 * Run steps 2–7 after session is created (source, credential, type, generate, review, save).
 * On any error, saves partial wizard.yaml with all collected state so far, appends to error.log, then rethrows.
 * @async
 * @param {string} appKey - Application key
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} sessionId - Wizard session ID
 * @param {Object} flowOpts - Mode, systemIdOrKey, platforms, configPath
 * @returns {Promise<Object>} Collected state (source, credential, preferences) for wizard.yaml save
 */
async function doWizardSteps(appKey, dataplaneUrl, authConfig, sessionId, flowOpts, state) {
  const { mode, systemIdOrKey, platforms } = flowOpts;
  const { sourceType, sourceData } = await handleInteractiveSourceSelection(
    dataplaneUrl, sessionId, authConfig, platforms
  );
  state.source = { type: sourceType };
  if (sourceType === 'openapi-file') state.source.filePath = sourceData;
  else if (sourceType === 'openapi-url') state.source.url = sourceData;
  else if (sourceType === 'mcp-server') state.source.serverUrl = JSON.parse(sourceData).serverUrl;
  else if (sourceType === 'known-platform') state.source.platform = sourceData;

  const openapiSpec = await handleOpenApiParsing(dataplaneUrl, authConfig, sourceType, sourceData);
  const credentialAction = await promptForCredentialAction();
  const configCredential = credentialAction.action === 'skip'
    ? { action: 'skip' }
    : { action: credentialAction.action, credentialIdOrKey: credentialAction.credentialIdOrKey };
  state.credential = configCredential;
  const credentialIdOrKey = await handleCredentialSelection(dataplaneUrl, authConfig, configCredential);

  const detectedType = await handleTypeDetection(dataplaneUrl, authConfig, openapiSpec);
  const genResult = await handleInteractiveConfigGeneration({
    dataplaneUrl,
    authConfig,
    mode,
    openapiSpec,
    detectedType,
    credentialIdOrKey,
    systemIdOrKey
  });
  const { systemConfig, datasourceConfigs, systemKey, preferences: savedPrefs } = genResult;
  state.preferences = savedPrefs || {};

  const finalConfigs = await handleConfigurationReview(dataplaneUrl, authConfig, systemConfig, datasourceConfigs);
  if (!finalConfigs) return null;

  await handleFileSaving(
    appKey,
    finalConfigs.systemConfig,
    finalConfigs.datasourceConfigs,
    systemKey || appKey,
    dataplaneUrl,
    authConfig
  );
  return state;
}

async function runWizardStepsAfterSession(appKey, dataplaneUrl, authConfig, sessionId, flowOpts) {
  const { mode, systemIdOrKey, configPath } = flowOpts;
  const state = { appKey, mode, systemIdOrKey: mode === 'add-datasource' ? systemIdOrKey : undefined };

  const savePartialOnError = async(err) => {
    state.preferences = state.preferences || {};
    if (configPath) {
      try {
        await writeWizardConfig(configPath, buildWizardStateForSave(state));
      } catch (e) {
        logger.warn(`Could not save partial wizard.yaml: ${e.message}`);
      }
    }
    await appendWizardError(appKey, err);
    err.wizardResumeMessage = `To resume: aifabrix wizard ${appKey}\nSee integration/${appKey}/error.log for details.`;
    err.wizardPartialSaved = true;
  };

  try {
    return await doWizardSteps(appKey, dataplaneUrl, authConfig, sessionId, flowOpts, state);
  } catch (err) {
    await savePartialOnError(err);
    throw err;
  }
}

/**
 * Execute wizard flow steps (interactive mode). Mode and systemIdOrKey are already set; creates session then runs steps 2–7.
 * @async
 * @function executeWizardFlow
 * @param {string} appKey - Application/integration key (folder name under integration/)
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} flowOpts - Flow options (mode, systemIdOrKey, configPath)
 * @returns {Promise<void>} Resolves when wizard flow completes
 */
async function executeWizardFlow(appKey, dataplaneUrl, authConfig, flowOpts = {}) {
  const { mode, systemIdOrKey, configPath } = flowOpts;

  logger.log(chalk.blue('\n\uD83D\uDCCB Step 1: Create Session'));
  const sessionId = await createSessionFromParams(dataplaneUrl, authConfig, mode, systemIdOrKey, appKey);
  logger.log(chalk.green('\u2713 Session created'));

  const platforms = await getWizardPlatforms(dataplaneUrl, authConfig);
  const state = await runWizardStepsAfterSession(appKey, dataplaneUrl, authConfig, sessionId, {
    mode,
    systemIdOrKey,
    platforms,
    configPath
  });
  if (!state) return;

  if (configPath) {
    await writeWizardConfig(configPath, buildWizardStateForSave(state));
  }
}

/**
 * Load wizard config from configPath if it exists (for prefill)
 * @param {string} [configPath] - Path to wizard.yaml (e.g. integration/<app>/wizard.yaml)
 * @param {string} [appName] - App name (for log message)
 * @returns {Promise<Object|null>} Loaded config or null
 */
async function loadWizardConfigIfExists(configPath, appName) {
  if (!configPath) return null;
  const displayPath = appName ? `integration/${appName}/wizard.yaml` : configPath;
  try {
    const exists = await wizardConfigExists(configPath);
    if (!exists) {
      logger.log(chalk.gray(`No saved state at ${displayPath}; starting from step 1.`));
      return null;
    }
    const result = await validateWizardConfig(configPath, { validateFilePaths: false });
    if (result.valid && result.config) {
      logger.log(chalk.green(`Loaded saved state from ${displayPath}. Resuming with saved choices.`));
      return result.config;
    }
    if (result.errors?.length) {
      logger.log(chalk.yellow(`Loaded ${displayPath} but it has errors; prompting for missing fields.`));
    }
  } catch (e) {
    logger.log(chalk.gray(`Could not load wizard config from ${displayPath}: ${e.message}`));
  }
  return null;
}

/**
 * Resolve appKey, configPath, dataplane and auth for "create-system" mode
 * @param {Object} options - Command options
 * @param {Object} [loadedConfig] - Loaded wizard config
 * @returns {Promise<Object|null>} { appKey, configPath, dataplaneUrl, authConfig } or null if cancelled
 */
async function resolveCreateNewPath(options, loadedConfig) {
  const appName = options.app || loadedConfig?.appName || (await promptForAppName(loadedConfig?.appName));
  const shouldContinue = await validateAndCheckAppDirectory(appName, true);
  if (!shouldContinue) return null;
  const appKey = appName;
  const configPath = await ensureIntegrationDir(appKey);
  const { dataplaneUrl, authConfig } = await setupDataplaneAndAuth(options, appName);
  return { appKey, configPath, dataplaneUrl, authConfig };
}

/**
 * Resolve appKey, configPath, dataplane and auth for "add-datasource" mode (validates system)
 * @param {Object} options - Command options
 * @param {Object} [loadedConfig] - Loaded wizard config
 * @returns {Promise<Object>} { appKey, configPath, dataplaneUrl, authConfig, systemIdOrKey }
 */
async function resolveAddDatasourcePath(options, loadedConfig) {
  let systemIdOrKey = loadedConfig?.systemIdOrKey || (await promptForSystemIdOrKey(loadedConfig?.systemIdOrKey));
  const { dataplaneUrl, authConfig } = await setupDataplaneAndAuth(options, systemIdOrKey || 'wizard');
  let systemResponse;
  for (;;) {
    try {
      systemResponse = await getExternalSystem(dataplaneUrl, systemIdOrKey, authConfig);
      const sys = systemResponse?.data || systemResponse;
      if (sys && (systemResponse?.data || systemResponse?.success)) {
        if (!isExternalSystemForAddDatasource(sys)) {
          logger.log(chalk.red('Cannot add datasource to a webapp. Please enter an external system ID or key.'));
          systemIdOrKey = await promptForSystemIdOrKey(systemIdOrKey);
          continue;
        }
        break;
      }
    } catch (err) {
      logger.log(chalk.red(`System not found or error: ${err.message}`));
    }
    systemIdOrKey = await promptForSystemIdOrKey(systemIdOrKey);
  }
  const sys = systemResponse?.data || systemResponse;
  const appKey = sys?.key || sys?.systemKey || systemIdOrKey;
  const configPath = await ensureIntegrationDir(appKey);
  return { appKey, configPath, dataplaneUrl, authConfig, systemIdOrKey };
}

/**
 * On wizard error: append to error.log, save partial wizard.yaml, set resume message
 * @param {string} appKey - Application key
 * @param {string} [configPath] - Path to wizard.yaml
 * @param {string} mode - Wizard mode
 * @param {string} [systemIdOrKey] - System ID (add-datasource)
 * @param {Error} error - The error
 */
async function handleWizardError(appKey, configPath, mode, systemIdOrKey, error) {
  await appendWizardError(appKey, error);
  if (!error.wizardPartialSaved && configPath) {
    const partial = buildWizardStateForSave({
      appKey,
      mode,
      systemIdOrKey: mode === 'add-datasource' ? systemIdOrKey : undefined
    });
    try {
      await writeWizardConfig(configPath, partial);
    } catch (e) {
      logger.warn(`Could not save partial wizard.yaml: ${e.message}`);
    }
  }
  error.wizardResumeMessage = `To resume: aifabrix wizard ${appKey}\nSee integration/${appKey}/error.log for details.`;
}

/**
 * Handle wizard command (mode-first, load/save wizard.yaml, error.log on failure)
 * @async
 * @function handleWizard
 * @param {Object} options - Command options
 * @param {string} [options.app] - Application name (from positional or -a)
 * @param {string} [options.config] - Path to wizard.yaml (headless mode)
 * @param {string} [options.configPath] - Resolved path integration/<app>/wizard.yaml for load/save
 * @returns {Promise<void>} Resolves when wizard completes
 * @throws {Error} If wizard fails (wizardResumeMessage set when appKey known)
 */
async function handleWizardSilent(options) {
  if (!options.configPath) {
    throw new Error('--silent requires an app name (e.g. aifabrix wizard test --silent)');
  }
  const result = await validateWizardConfig(options.configPath, { validateFilePaths: false });
  if (!result.valid || !result.config) {
    const displayPath = options.app ? `integration/${options.app}/wizard.yaml` : '';
    const errMsg = result.errors?.length ? result.errors.join('; ') : 'Invalid or missing wizard.yaml';
    throw new Error(`Cannot run --silent: ${displayPath} is invalid or missing. ${errMsg}`);
  }
  return await handleWizardHeadless({ ...options, config: options.configPath });
}

async function handleWizardWithSavedConfig(options, loadedConfig, displayPath) {
  showWizardConfigSummary(loadedConfig, displayPath);
  const runWithSaved = await promptForRunWithSavedConfig();
  if (!runWithSaved) {
    logger.log(chalk.gray(`To change settings, edit ${displayPath} and run: aifabrix wizard ${options.app}`));
    return;
  }
  logger.log(chalk.gray(`Running with saved config from ${displayPath}...\n`));
  return await handleWizardHeadless({ ...options, config: options.configPath });
}

async function handleWizardInteractive(options) {
  const mode = await promptForMode();
  const resolved = mode === 'create-system'
    ? await resolveCreateNewPath(options, null)
    : await resolveAddDatasourcePath(options, null);
  if (!resolved) return;
  const { appKey, configPath, dataplaneUrl, authConfig } = resolved;
  const systemIdOrKey = mode === 'add-datasource' ? resolved.systemIdOrKey : undefined;
  try {
    await executeWizardFlow(appKey, dataplaneUrl, authConfig, { mode, systemIdOrKey, configPath });
    logger.log(chalk.gray(`To change settings, edit integration/${appKey}/wizard.yaml and run: aifabrix wizard ${appKey}`));
  } catch (error) {
    await handleWizardError(appKey, configPath, mode, systemIdOrKey, error);
    throw error;
  }
}

async function handleWizard(options = {}) {
  if (options.config) {
    return await handleWizardHeadless(options);
  }
  const displayPath = options.app ? `integration/${options.app}/wizard.yaml` : '';
  if (options.silent && options.app) {
    return await handleWizardSilent(options);
  }
  logger.log(chalk.blue('\n\uD83E\uDDD9 AI Fabrix External System Wizard\n'));
  const loadedConfig = await loadWizardConfigIfExists(options.configPath, options.app);
  if (loadedConfig) {
    return await handleWizardWithSavedConfig(options, loadedConfig, displayPath);
  }
  return await handleWizardInteractive(options);
}

module.exports = { handleWizard, handleWizardHeadless };
