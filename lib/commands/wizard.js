/**
 * @fileoverview Wizard command handler - interactive and headless external system creation
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-lines */

const chalk = require('chalk');
const logger = require('../utils/logger');
const {
  promptForMode,
  promptForExistingSystem,
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
  extractSessionId,
  handleSourceSelection,
  handleOpenApiParsing,
  handleCredentialSelection,
  handleTypeDetection,
  handleEntitySelection,
  handleConfigurationGeneration,
  validateWizardConfiguration,
  handleFileSaving,
  setupDataplaneAndAuth,
  resolveCredentialConfig,
  fetchSystemsListForAddDatasource,
  resolveExternalSystemForAddDatasource
} = require('./wizard-core');
const { handleWizardHeadless } = require('./wizard-headless');
const { createWizardSession, updateWizardSession, getWizardPlatforms, getPreview } = require('../api/wizard.api');
const { writeWizardConfig, wizardConfigExists, validateWizardConfig } = require('../validation/wizard-config-validator');
const { appendWizardError } = require('../utils/cli-utils');
const {
  buildPreferencesForSave,
  buildWizardStateForSave,
  showWizardConfigSummary,
  ensureIntegrationDir
} = require('./wizard-helpers');
const { humanizeAppKey } = require('../generator/wizard-prompts-secondary');
const { formatSuccessLine } = require('../utils/cli-layout-chalk');

/**
 * Map resolved source type/data onto wizard state.source.
 * @param {Object} state - Mutable wizard state
 * @param {string} sourceType - Source type key
 * @param {unknown} sourceData - Raw source payload from prompts
 */
function applySourceSelectionToState(state, sourceType, sourceData) {
  state.source = { type: sourceType };
  if (sourceType === 'openapi-file') state.source.filePath = sourceData;
  else if (sourceType === 'openapi-url') state.source.url = sourceData;
  else if (sourceType === 'mcp-server') state.source.serverUrl = JSON.parse(sourceData).serverUrl;
  else if (sourceType === 'known-platform') state.source.platform = sourceData;
}

/**
 * Interactive or prefill source selection (Step 2).
 * @returns {Promise<{ sourceType: string, sourceData: unknown }>}
 */
async function resolveWizardSourcePhase(dataplaneUrl, sessionId, authConfig, platforms, prefill) {
  if (prefill?.source?.type) {
    logger.log(chalk.gray(
      `Using source from wizard.yaml (${prefill.source.type}). Skipping source prompts.`
    ));
    return handleSourceSelection(dataplaneUrl, sessionId, authConfig, prefill.source);
  }
  return handleInteractiveSourceSelection(dataplaneUrl, sessionId, authConfig, platforms);
}

/**
 * Credential selection with optional prefill (Step 3).
 * @returns {Promise<string>} credentialIdOrKey for generation step
 */
async function resolveWizardCredentialPhase(dataplaneUrl, authConfig, prefill, state) {
  if (prefill?.credential) {
    state.credential = prefill.credential;
    return handleCredentialSelection(dataplaneUrl, authConfig, prefill.credential);
  }
  const credentialAction = await promptForCredentialAction();
  const configCredential = await resolveCredentialConfig(dataplaneUrl, authConfig, credentialAction);
  state.credential = configCredential;
  return handleCredentialSelection(dataplaneUrl, authConfig, configCredential);
}

/**
 * Collect user intent and UI preferences (Step 5), with optional wizard.yaml prefill.
 * @returns {Promise<{ userIntent: string, preferences: Object, hasPrefillIntent: boolean }>}
 */
async function collectIntentAndPreferences(preferencesPrefill) {
  const prefillPrefs = preferencesPrefill;
  const hasPrefillIntent =
    prefillPrefs &&
    typeof prefillPrefs.intent === 'string' &&
    prefillPrefs.intent.trim().length > 0;

  if (hasPrefillIntent) {
    logger.log(chalk.gray(
      'Using preferences from wizard.yaml (intent and toggles). Skipping preference prompts.'
    ));
    const level = prefillPrefs.fieldOnboardingLevel;
    const validLevel = level === 'standard' || level === 'minimal' ? level : 'full';
    return {
      userIntent: prefillPrefs.intent.trim(),
      preferences: {
        fieldOnboardingLevel: validLevel,
        mcp: Boolean(prefillPrefs.enableMCP),
        abac: Boolean(prefillPrefs.enableABAC),
        rbac: Boolean(prefillPrefs.enableRBAC)
      },
      hasPrefillIntent: true
    };
  }

  const userIntent = await promptForUserIntent();
  const preferences = await promptForUserPreferences();
  return { userIntent, preferences, hasPrefillIntent: false };
}

/**
 * Run Step 5 (generate), Step 6–7 (review), and save files; updates state.preferences.
 * @param {Object} payload
 * @param {string} payload.appKey - Application key
 * @param {string} payload.dataplaneUrl - Dataplane URL
 * @param {Object} payload.authConfig - Auth configuration
 * @param {string} payload.sessionId - Wizard session ID
 * @param {Object} payload.state - Mutable wizard state
 * @param {Object} payload.flowOpts - Flow options (mode, systemIdOrKey, debug, prefill, etc.)
 * @param {Object} payload.genInput - Generation inputs (openapiSpec, detectedType, credential…)
 * @returns {Promise<Object|null>} Updated state or null if review cancelled
 */
async function completeWizardGenerateReviewSave(payload) {
  const {
    appKey,
    dataplaneUrl,
    authConfig,
    sessionId,
    state,
    flowOpts,
    genInput
  } = payload;
  const { mode, systemIdOrKey, debug, prefill } = flowOpts;
  const genResult = await handleInteractiveConfigGeneration({
    dataplaneUrl,
    authConfig,
    mode,
    openapiSpec: genInput.openapiSpec,
    detectedType: genInput.detectedType,
    credentialIdOrKey: genInput.credentialIdOrKey,
    systemIdOrKey,
    sourceType: genInput.sourceType,
    sourceData: genInput.sourceData,
    entityName: genInput.entityName,
    appName: appKey,
    debug,
    systemDisplayName: flowOpts.systemDisplayName,
    preferencesPrefill: prefill?.preferences
  });
  const { systemConfig, datasourceConfigs, systemKey, preferences: savedPrefs } = genResult;
  state.preferences = savedPrefs || {};

  const finalConfigs = await handleConfigurationReview(
    dataplaneUrl,
    authConfig,
    sessionId,
    systemConfig,
    datasourceConfigs,
    { appKey, debug }
  );
  if (!finalConfigs) return null;

  await handleFileSaving(
    appKey,
    finalConfigs.systemConfig,
    finalConfigs.datasourceConfigs,
    systemKey || appKey,
    {
      dataplaneUrl,
      authConfig,
      enableRBAC: Boolean(savedPrefs?.enableRBAC)
    }
  );
  return state;
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
 * @param {Object} [options.preferencesPrefill] - From wizard.yaml `preferences` (skip Step 5 prompts when intent is set)
 * @returns {Promise<Object>} Generated configuration and preferences { systemConfig, datasourceConfigs, systemKey, preferences }
 */
async function handleInteractiveConfigGeneration(options) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 5: User Preferences'));

  const { userIntent, preferences, hasPrefillIntent } = await collectIntentAndPreferences(
    options.preferencesPrefill
  );

  const configPrefs = {
    intent: userIntent,
    fieldOnboardingLevel: preferences.fieldOnboardingLevel || 'full',
    enableMCP: preferences.mcp,
    enableABAC: preferences.abac,
    enableRBAC: preferences.rbac,
    enableOpenAPIGeneration: hasPrefillIntent
      ? options.preferencesPrefill?.enableOpenAPIGeneration !== false
      : true,
    debug: options.debug === true
  };

  const result = await handleConfigurationGeneration(options.dataplaneUrl, options.authConfig, {
    mode: options.mode,
    openapiSpec: options.openapiSpec,
    detectedType: options.detectedType,
    configPrefs,
    credentialIdOrKey: options.credentialIdOrKey,
    systemIdOrKey: options.systemIdOrKey,
    sourceType: options.sourceType,
    platformKey: options.sourceType === 'known-platform' ? options.sourceData : undefined,
    entityName: options.entityName,
    appName: options.appName,
    systemDisplayName: options.systemDisplayName
  });

  return {
    ...result,
    preferences: buildPreferencesForSave(userIntent, preferences, { debug: options.debug })
  };
}

/**
 * Handle configuration review and validation step (interactive mode only)
 * Fetches preview summary from dataplane; falls back to YAML dump if preview unavailable.
 * @async
 * @function handleConfigurationReview
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} sessionId - Wizard session ID
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Datasource configurations
 * @param {Object} [opts] - Optional options
 * @param {string} [opts.appKey] - App key for debug manifest path
 * @param {boolean} [opts.debug] - When true, save debug manifest on validation failure
 * @returns {Promise<Object|null>} Final configurations or null if cancelled
 */
async function handleConfigurationReview(dataplaneUrl, authConfig, sessionId, systemConfig, datasourceConfigs, opts = {}) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 6-7: Review & Validate'));

  let preview = null;
  try {
    const previewResponse = await getPreview(dataplaneUrl, sessionId, authConfig);
    if (previewResponse?.success && previewResponse?.data) {
      preview = previewResponse.data;
    }
  } catch {
    // Fall back to YAML display
  }
  if (!preview) {
    logger.warn('Preview unavailable, showing full configuration.');
  }

  const reviewResult = await promptForConfigReview({ preview, systemConfig, datasourceConfigs, appKey: opts.appKey });

  if (reviewResult.action === 'cancel') {
    logger.log(chalk.yellow('Wizard cancelled.'));
    return null;
  }

  const finalSystemConfig = reviewResult.systemConfig || systemConfig;
  const finalDatasourceConfigs = reviewResult.datasourceConfigs || datasourceConfigs;

  await validateWizardConfiguration(dataplaneUrl, authConfig, finalSystemConfig, finalDatasourceConfigs, {
    debug: opts.debug,
    appName: opts.appKey
  });

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
  const { platforms, prefill } = flowOpts;

  const { sourceType, sourceData } = await resolveWizardSourcePhase(
    dataplaneUrl,
    sessionId,
    authConfig,
    platforms,
    prefill
  );
  applySourceSelectionToState(state, sourceType, sourceData);

  const openapiSpec = await handleOpenApiParsing(dataplaneUrl, authConfig, sourceType, sourceData);
  const credentialIdOrKey = await resolveWizardCredentialPhase(dataplaneUrl, authConfig, prefill, state);

  const detectedType = await handleTypeDetection(dataplaneUrl, authConfig, openapiSpec);
  const prefillEntityName = prefill?.source?.entityName;
  const entityName = openapiSpec && sourceType !== 'known-platform'
    ? await handleEntitySelection(dataplaneUrl, authConfig, openapiSpec, prefillEntityName) : null;
  if (entityName && state.source) {
    state.source.entityName = entityName;
  }
  return completeWizardGenerateReviewSave({
    appKey,
    dataplaneUrl,
    authConfig,
    sessionId,
    state,
    flowOpts,
    genInput: {
      openapiSpec,
      detectedType,
      credentialIdOrKey,
      sourceType,
      sourceData,
      entityName: entityName || undefined
    }
  });
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
  const { mode, systemIdOrKey, configPath, debug, systemDisplayName, prefill } = flowOpts;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Wizard debug mode enabled for app: ${appKey}`));
  }
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 1: Create Session'));
  const sessionId = await createSessionFromParams(dataplaneUrl, authConfig, mode, systemIdOrKey, appKey);
  logger.log(formatSuccessLine('Session created'));

  const platforms = mode === 'add-datasource' ? [] : await getWizardPlatforms(dataplaneUrl, authConfig);
  const state = await runWizardStepsAfterSession(appKey, dataplaneUrl, authConfig, sessionId, {
    mode,
    systemIdOrKey,
    platforms,
    configPath,
    debug: flowOpts.debug,
    systemDisplayName,
    prefill
  });
  if (!state) return;

  if (configPath) {
    await writeWizardConfig(configPath, buildWizardStateForSave(state));
  }
}

/**
 * Load wizard config from configPath if it exists (for prefill)
 * @param {string} [configPath] - Path to wizard.yaml (e.g. integration/<systemKey>/wizard.yaml)
 * @param {string} [appName] - App name (for log message)
 * @returns {Promise<Object|null>} Loaded config or null
 */
/**
 * Load wizard.yaml when present. Returns full valid config, or invalid-but-parsed config for interactive prefill.
 *
 * @returns {Promise<{ valid: true, config: Object } | { valid: false, config: Object, errors: string[] } | null>}
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
      return { valid: true, config: result.config };
    }
    if (result.errors?.length) {
      logger.log(chalk.yellow(
        `Loaded ${displayPath} but it does not fully validate; prefilling from file where possible.`
      ));
      result.errors.forEach(err => logger.log(chalk.gray(`  • ${err}`)));
    }
    if (result.config) {
      return { valid: false, config: result.config, errors: result.errors || [] };
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
  const { dataplaneUrl, authConfig } = await setupDataplaneAndAuth(
    options,
    loadedConfig?.systemIdOrKey || loadedConfig?.appKey || 'wizard'
  );
  const systemsList = await fetchSystemsListForAddDatasource(dataplaneUrl, authConfig);
  const initialSystemIdOrKey = loadedConfig?.systemIdOrKey || (await promptForExistingSystem(systemsList, loadedConfig?.systemIdOrKey));
  const { systemResponse, systemIdOrKey } = await resolveExternalSystemForAddDatasource(
    dataplaneUrl, authConfig, systemsList, initialSystemIdOrKey
  );
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
 * @param {string} [options.configPath] - Resolved path integration/<systemKey>/wizard.yaml for load/save
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
  const prefill = options.wizardPrefill;
  const allowAddDatasource = !options.app;
  const mode = allowAddDatasource ? await promptForMode(undefined, true) : 'create-system';
  const resolved = mode === 'create-system'
    ? await resolveCreateNewPath(options, prefill || null)
    : await resolveAddDatasourcePath(options, prefill || null);
  if (!resolved) return;
  const { appKey, configPath, dataplaneUrl, authConfig } = resolved;
  const systemIdOrKey = mode === 'add-datasource' ? resolved.systemIdOrKey : undefined;
  const systemDisplayName = options.systemDisplayName || options.displayName || prefill?.systemDisplayName ||
    (mode === 'create-system' ? humanizeAppKey(appKey) : undefined);
  try {
    await executeWizardFlow(appKey, dataplaneUrl, authConfig, {
      mode,
      systemIdOrKey,
      configPath,
      debug: options.debug,
      systemDisplayName,
      prefill: prefill || undefined
    });
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
  const loadResult = await loadWizardConfigIfExists(options.configPath, options.app);
  if (loadResult?.valid && loadResult.config) {
    return await handleWizardWithSavedConfig(options, loadResult.config, displayPath);
  }
  if (loadResult?.config && loadResult.valid === false) {
    return await handleWizardInteractive({ ...options, wizardPrefill: loadResult.config });
  }
  return await handleWizardInteractive(options);
}
module.exports = { handleWizard, handleWizardHeadless };
