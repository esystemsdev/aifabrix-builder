/**
 * @fileoverview Wizard core helpers - OpenAPI/MCP parsing, credential loop, config build/error formatting
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { parseOpenApi, testMcpConnection, credentialSelection } = require('../api/wizard.api');
const { listCredentials } = require('../api/credentials.api');
const { listExternalSystems, getExternalSystem } = require('../api/external-systems.api');

/**
 * Parse OpenAPI file or URL
 * @async
 * @function parseOpenApiSource
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} sourceType - Source type (openapi-file or openapi-url)
 * @param {string} sourceData - Source data (file path or URL)
 * @returns {Promise<Object|null>} OpenAPI spec or null
 */
async function parseOpenApiSource(dataplaneUrl, authConfig, sourceType, sourceData) {
  const isUrl = sourceType === 'openapi-url';
  const spinner = ora(`Parsing OpenAPI ${isUrl ? 'URL' : 'file'}...`).start();
  try {
    const parseResponse = await parseOpenApi(dataplaneUrl, authConfig, sourceData, isUrl);
    spinner.stop();
    if (!parseResponse.success) {
      throw new Error(`OpenAPI parsing failed: ${parseResponse.error || parseResponse.formattedError}`);
    }
    logger.log(chalk.green(`\u2713 OpenAPI ${isUrl ? 'URL' : 'file'} parsed successfully`));
    return parseResponse.data?.spec;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Test MCP server connection
 * @async
 * @function testMcpServerConnection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} sourceData - MCP server details JSON string
 * @returns {Promise<null>} Always returns null
 */
async function testMcpServerConnection(dataplaneUrl, authConfig, sourceData) {
  const mcpDetails = JSON.parse(sourceData);
  const spinner = ora('Testing MCP server connection...').start();
  try {
    const testResponse = await testMcpConnection(dataplaneUrl, authConfig, mcpDetails.serverUrl, mcpDetails.token);
    spinner.stop();
    if (!testResponse.success || !testResponse.data?.connected) {
      throw new Error(`MCP connection failed: ${testResponse.data?.error || 'Unable to connect'}`);
    }
    logger.log(chalk.green('\u2713 MCP server connection successful'));
  } catch (error) {
    spinner.stop();
    throw error;
  }
  return null;
}

/**
 * Normalize credential config to selection data
 * @param {Object} [configCredential] - Credential config from wizard.yaml or prompt
 * @returns {Object} Selection data for API
 */
function normalizeCredentialSelectionInput(configCredential) {
  if (!configCredential) return { action: 'skip' };
  return {
    action: configCredential.action,
    credentialConfig: configCredential.config,
    credentialIdOrKey: configCredential.credentialIdOrKey
  };
}

/**
 * Run a single credential selection API call
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} selectionData - Selection data
 * @returns {Promise<{response: Object|null, error: string|null}>}
 */
async function runCredentialAttempt(dataplaneUrl, authConfig, selectionData) {
  const spinner = ora('Processing credential selection...').start();
  try {
    const response = await credentialSelection(dataplaneUrl, authConfig, selectionData);
    spinner.stop();
    return { response, error: null };
  } catch (err) {
    spinner.stop();
    return { response: null, error: err.message || String(err) };
  }
}

/**
 * Handle credential retry prompt or fail
 * @async
 * @param {string} errorMsg - Error message
 * @param {boolean} allowRetry - Whether to allow retry (interactive)
 * @param {Object} selectionData - Current selection data
 * @returns {Promise<{done: boolean, value: null}|{done: boolean, selectionData: Object}>}
 */
async function handleCredentialRetryOrFail(errorMsg, allowRetry, selectionData) {
  const { promptForCredentialIdOrKeyRetry } = require('../generator/wizard-prompts');
  if (selectionData.action === 'select' && allowRetry) {
    const retryResult = await promptForCredentialIdOrKeyRetry(errorMsg);
    if (retryResult.skip) {
      logger.log(chalk.gray('  Skipping credential selection'));
      return { done: true, value: null };
    }
    return { done: false, selectionData: { action: 'select', credentialIdOrKey: retryResult.credentialIdOrKey } };
  }
  logger.log(chalk.yellow(`Warning: Credential selection failed: ${errorMsg}`));
  return { done: true, value: null };
}

/**
 * Run credential selection loop until success or skip
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} selectionData - Initial selection data
 * @param {boolean} allowRetry - Whether to re-prompt on failure
 * @returns {Promise<string|null>} Credential ID/key or null
 */
async function runCredentialSelectionLoop(dataplaneUrl, authConfig, selectionData, allowRetry) {
  for (;;) {
    const { response, error: attemptError } = await runCredentialAttempt(dataplaneUrl, authConfig, selectionData);
    if (attemptError) {
      const ret = await handleCredentialRetryOrFail(attemptError, allowRetry, selectionData);
      if (ret.done) return ret.value;
      selectionData = ret.selectionData;
      continue;
    }
    if (response.success) {
      const actionText = selectionData.action === 'create' ? 'created' : 'selected';
      logger.log(chalk.green(`\u2713 Credential ${actionText}`));
      return response.data?.credentialIdOrKey || null;
    }
    const errorMsg = response.error || response.formattedError || response.message || 'Unknown error';
    const ret = await handleCredentialRetryOrFail(errorMsg, allowRetry, selectionData);
    if (ret.done) return ret.value;
    selectionData = ret.selectionData;
  }
}

/**
 * Build configuration preferences from configPrefs object
 * @param {Object} [configPrefs] - Preferences from wizard.yaml
 * @returns {Object} Configuration preferences object
 */
function buildConfigPreferences(configPrefs) {
  return {
    intent: configPrefs?.intent || 'general integration',
    fieldOnboardingLevel: configPrefs?.fieldOnboardingLevel || 'full',
    enableOpenAPIGeneration: configPrefs?.enableOpenAPIGeneration !== false,
    debug: configPrefs?.debug === true,
    userPreferences: {
      enableMCP: configPrefs?.enableMCP || false,
      enableABAC: configPrefs?.enableABAC || false,
      enableRBAC: configPrefs?.enableRBAC || false
    }
  };
}

/**
 * Build configuration payload for API call
 * @param {Object} params - Parameters object
 * @param {Object} params.openapiSpec - OpenAPI specification
 * @param {Object} params.detectedType - Detected type info
 * @param {string} params.mode - Selected mode
 * @param {Object} params.prefs - Configuration preferences
 * @param {string} [params.credentialIdOrKey] - Credential ID or key
 * @param {string} [params.systemIdOrKey] - System ID or key
 * @returns {Object} Configuration payload
 */
function buildConfigPayload({ openapiSpec, detectedType, mode, prefs, credentialIdOrKey, systemIdOrKey }) {
  const detectedTypeValue = detectedType?.recommendedType || detectedType?.apiType || detectedType?.selectedType || 'record-based';
  const payload = {
    openapiSpec,
    detectedType: detectedTypeValue,
    intent: prefs.intent,
    mode,
    fieldOnboardingLevel: prefs.fieldOnboardingLevel,
    enableOpenAPIGeneration: prefs.enableOpenAPIGeneration,
    userPreferences: prefs.userPreferences
  };
  if (credentialIdOrKey) payload.credentialIdOrKey = credentialIdOrKey;
  if (systemIdOrKey) payload.systemIdOrKey = systemIdOrKey;
  if (prefs.debug) payload.debug = true;
  return payload;
}

/**
 * Build payload for platform config endpoint.
 * Schema allows only: datasourceKeys?, credentialIdOrKey?, configurationValues?, debug?
 * (additionalProperties: false - do NOT send intent, mode, fieldOnboardingLevel, etc.)
 * @param {Object} params - Parameters object
 * @param {string} [params.credentialIdOrKey] - Credential ID or key
 * @param {string[]} [params.datasourceKeys] - Datasource keys to include (defaults to all)
 * @param {Object} [params.configurationValues] - Configuration value overrides
 * @param {boolean} [params.debug] - When true, capture debug log
 * @returns {Object} Platform config payload
 */
function buildPlatformConfigPayload({ credentialIdOrKey, datasourceKeys, configurationValues, debug }) {
  const payload = {};
  if (credentialIdOrKey) payload.credentialIdOrKey = credentialIdOrKey;
  if (datasourceKeys && Array.isArray(datasourceKeys) && datasourceKeys.length > 0) {
    payload.datasourceKeys = datasourceKeys;
  }
  if (configurationValues && typeof configurationValues === 'object' && Object.keys(configurationValues).length > 0) {
    payload.configurationValues = configurationValues;
  }
  if (debug) payload.debug = true;
  return payload;
}

/**
 * Extract configuration from API response
 * @param {Object} generateResponse - API response
 * @returns {Object} Extracted configuration
 */
function extractConfigurationFromResponse(generateResponse) {
  const systemConfig = generateResponse.data?.systemConfig;
  const datasourceConfigs = generateResponse.data?.datasourceConfigs ||
    (generateResponse.data?.datasourceConfig ? [generateResponse.data.datasourceConfig] : []);
  if (!systemConfig) throw new Error('System configuration not found');
  return { systemConfig, datasourceConfigs, systemKey: generateResponse.data?.systemKey };
}

/**
 * Format API errorData as plain text (no chalk) for logging and error.message
 * @param {Object} [errorData] - API error response errorData
 * @returns {string} Plain-text validation details
 */
function formatValidationDetailsPlain(errorData) {
  if (!errorData || typeof errorData !== 'object') {
    return '';
  }
  const lines = [];
  const main = errorData.detail || errorData.title || errorData.errorDescription || errorData.message || errorData.error;
  if (main) {
    lines.push(String(main));
  }
  if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
    lines.push('Validation errors:');
    errorData.errors.forEach(err => {
      const field = err.field || err.path || (err.loc && Array.isArray(err.loc) ? err.loc.join('.') : 'validation');
      const message = err.msg || err.message || 'Invalid value';
      const value = err.value !== undefined ? ` (value: ${JSON.stringify(err.value)})` : '';
      lines.push(`  • ${field}: ${message}${value}`);
    });
  }
  if (errorData.configuration && errorData.configuration.errors) {
    const configErrs = errorData.configuration.errors;
    lines.push('Configuration errors:');
    if (Array.isArray(configErrs)) {
      configErrs.forEach(err => {
        const field = err.field || err.path || 'configuration';
        const message = err.message || 'Invalid value';
        lines.push(`  • ${field}: ${message}`);
      });
    } else if (typeof configErrs === 'object') {
      Object.keys(configErrs).forEach(key => {
        lines.push(`  • configuration.${key}: ${configErrs[key]}`);
      });
    }
  }
  return lines.join('\n');
}

/**
 * Create and throw config generation error with optional formatted message
 * @param {Object} generateResponse - API response (error)
 * @param {Object} [options] - Optional options
 * @param {string} [options.debugManifestHint] - Hint to append when debug manifest was saved (e.g. review debug.log and fix manually)
 * @throws {Error}
 */
function throwConfigGenerationError(generateResponse, options = {}) {
  const summary = generateResponse.error || generateResponse.formattedError || 'Unknown error';
  const detailsPlain = formatValidationDetailsPlain(generateResponse.errorData);
  let message = detailsPlain
    ? `Configuration generation failed: ${summary}\n${detailsPlain}`
    : `Configuration generation failed: ${summary}`;
  if (options.debugManifestHint) {
    message += `\n\n${options.debugManifestHint}`;
  }
  const err = new Error(message);
  if (generateResponse.formattedError) {
    err.formatted = generateResponse.formattedError;
  }
  throw err;
}

/**
 * Write debug log to integration/<appName>/debug.log
 * @async
 * @param {string} appName - Application name
 * @param {string} content - Debug log content
 */
async function writeDebugLog(appName, content) {
  try {
    const dir = getIntegrationPath(appName);
    await fs.mkdir(dir, { recursive: true });
    const debugPath = path.join(dir, 'debug.log');
    await fs.writeFile(debugPath, content, 'utf8');
    logger.log(chalk.gray(`  Debug log saved to integration/${appName}/debug.log`));
  } catch (e) {
    logger.warn(`Could not save debug.log: ${e.message}`);
  }
}

/**
 * Write systemConfig and datasourceConfig from error response for manual fix
 * @async
 * @param {string} appName - Application name
 * @param {Object} [systemConfig] - System config from errorData
 * @param {Object|Object[]} [datasourceConfig] - Datasource config(s) from errorData
 * @returns {Promise<string[]>} Names of saved files
 */
async function writeDebugManifest(appName, systemConfig, datasourceConfig) {
  const saved = [];
  try {
    const dir = getIntegrationPath(appName);
    await fs.mkdir(dir, { recursive: true });
    if (systemConfig && typeof systemConfig === 'object') {
      const systemPath = path.join(dir, 'debug-system.yaml');
      await fs.writeFile(systemPath, yaml.dump(systemConfig, { lineWidth: -1 }), 'utf8');
      saved.push('debug-system.yaml');
      logger.log(chalk.gray(`  Debug manifest saved to integration/${appName}/debug-system.yaml`));
    }
    if (datasourceConfig !== undefined && datasourceConfig !== null) {
      const configs = Array.isArray(datasourceConfig) ? datasourceConfig : [datasourceConfig];
      if (configs.length > 0 && configs.every(c => c && typeof c === 'object')) {
        const datasourcePath = path.join(dir, 'debug-datasource.yaml');
        const toWrite = configs.length === 1 ? configs[0] : configs;
        await fs.writeFile(datasourcePath, yaml.dump(toWrite, { lineWidth: -1 }), 'utf8');
        saved.push('debug-datasource.yaml');
        logger.log(chalk.gray(`  Debug manifest saved to integration/${appName}/debug-datasource.yaml`));
      }
    }
  } catch (e) {
    logger.warn(`Could not save debug manifest: ${e.message}`);
  }
  return saved;
}

/**
 * Save debug manifest on error and throw
 * @param {Object} generateResponse - API error response
 * @param {Object} opts - Options
 * @param {boolean} opts.enableDebug - Whether debug was enabled
 * @param {string} [opts.appName] - App name for writing files
 */
async function saveDebugManifestOnErrorAndThrow(generateResponse, opts) {
  const { enableDebug, appName } = opts;
  let debugManifestHint = null;
  if (enableDebug && appName) {
    const errorData = generateResponse.errorData || {};
    const debugLog = errorData.debugLog;
    if (debugLog && typeof debugLog === 'string') {
      await writeDebugLog(appName, debugLog);
    }
    const systemConfig = errorData.systemConfig;
    const datasourceConfig = errorData.datasourceConfig || errorData.datasourceConfigs;
    const savedManifest = await writeDebugManifest(appName, systemConfig, datasourceConfig);
    if (debugLog || savedManifest.length > 0) {
      const files = [debugLog && 'debug.log', ...savedManifest].filter(Boolean).join(', ');
      debugManifestHint = `Debug manifest saved to integration/${appName}/ (${files}). Review the log and fix the manifest manually, then run: aifabrix wizard ${appName}`;
    }
  }
  throwConfigGenerationError(generateResponse, { debugManifestHint });
}

/** Throws with validation error; saves debug manifest when options.debug and options.appName are set. */
async function throwValidationFailureWithDebug(validateResponse, systemConfig, configs, errorMsg, options) {
  if (!options.debug || !options.appName) throw new Error(`Configuration validation failed: ${errorMsg}`);
  const errorData = validateResponse.errorData || validateResponse.data || {};
  const debugLog = errorData.debugLog;
  if (debugLog && typeof debugLog === 'string') await writeDebugLog(options.appName, debugLog);
  const savedManifest = await writeDebugManifest(
    options.appName, errorData.systemConfig || systemConfig, errorData.datasourceConfig || errorData.datasourceConfigs || configs
  );
  if (!debugLog && savedManifest.length === 0) throw new Error(`Configuration validation failed: ${errorMsg}`);
  const files = [debugLog && 'debug.log', ...savedManifest].filter(Boolean).join(', ');
  throw new Error(`Configuration validation failed: ${errorMsg}\n\nDebug manifest saved to integration/${options.appName}/ (${files}). Review the log and fix the manifest manually, then run: aifabrix wizard ${options.appName}`);
}

/**
 * Resolve credential config from user action (select/skip/create)
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Auth config
 * @param {Object} credentialAction - Result from promptForCredentialAction
 * @returns {Promise<Object>} configCredential for handleCredentialSelection
 */
async function resolveCredentialConfig(dataplaneUrl, authConfig, credentialAction) {
  const { promptForExistingCredential } = require('../generator/wizard-prompts');
  if (credentialAction.action !== 'select') {
    return credentialAction.action === 'skip' ? { action: 'skip' } : { action: credentialAction.action };
  }
  let credentialsList = [];
  try {
    const listResponse = await listCredentials(dataplaneUrl, authConfig, {
      activeOnly: true,
      pageSize: 100
    });
    const body = listResponse?.data ?? listResponse;
    const inner = Array.isArray(body) ? body : (body?.data ?? body);
    credentialsList = Array.isArray(inner) ? inner : (inner?.credentials ?? inner?.items ?? []) || [];
  } catch (_) {
    credentialsList = [];
  }
  const selected = await promptForExistingCredential(Array.isArray(credentialsList) ? credentialsList : []);
  return { action: 'select', credentialIdOrKey: selected.credentialIdOrKey };
}

/**
 * Fetch external systems list from dataplane
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Auth config
 * @returns {Promise<Object[]>} Systems list
 */
async function fetchSystemsListForAddDatasource(dataplaneUrl, authConfig) {
  try {
    const listResponse = await listExternalSystems(dataplaneUrl, authConfig, { pageSize: 100 });
    const body = listResponse?.data ?? listResponse;
    const inner = Array.isArray(body) ? body : (body?.data ?? body);
    const list = Array.isArray(inner) ? inner : (inner?.items ?? inner?.systems ?? []) || [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

/**
 * Resolve and validate external system for add-datasource (prompt until valid)
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Auth config
 * @param {Object[]} systemsList - Systems list
 * @param {string} initialSystemIdOrKey - Initial system ID or key
 * @returns {Promise<{systemResponse: Object, systemIdOrKey: string}>}
 */
async function resolveExternalSystemForAddDatasource(dataplaneUrl, authConfig, systemsList, initialSystemIdOrKey) {
  const { promptForExistingSystem } = require('../generator/wizard-prompts');
  const { isExternalSystemForAddDatasource } = require('./wizard-helpers');
  let systemIdOrKey = initialSystemIdOrKey;
  let systemResponse;
  for (;;) {
    try {
      systemResponse = await getExternalSystem(dataplaneUrl, systemIdOrKey, authConfig);
      const sys = systemResponse?.data || systemResponse;
      if (sys && (systemResponse?.data || systemResponse?.success)) {
        if (!isExternalSystemForAddDatasource(sys)) {
          logger.log(chalk.red('Cannot add datasource to a webapp. Please select an external system.'));
        } else {
          break;
        }
      }
    } catch (err) {
      logger.log(chalk.red(`System not found or error: ${err.message}`));
    }
    systemIdOrKey = await promptForExistingSystem(systemsList, systemIdOrKey);
  }
  return { systemResponse, systemIdOrKey };
}

module.exports = {
  parseOpenApiSource,
  testMcpServerConnection,
  normalizeCredentialSelectionInput,
  runCredentialSelectionLoop,
  buildConfigPreferences,
  buildConfigPayload,
  buildPlatformConfigPayload,
  extractConfigurationFromResponse,
  formatValidationDetailsPlain,
  throwConfigGenerationError,
  writeDebugLog,
  writeDebugManifest,
  saveDebugManifestOnErrorAndThrow,
  throwValidationFailureWithDebug,
  resolveCredentialConfig,
  fetchSystemsListForAddDatasource,
  resolveExternalSystemForAddDatasource
};
