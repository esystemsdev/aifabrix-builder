/**
 * @fileoverview Wizard core functions - shared between interactive and headless modes
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-lines */
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { getDeploymentAuth, getDeviceOnlyAuth } = require('../utils/token-manager');
const { resolveControllerUrl } = require('../utils/controller-url');
const { normalizeWizardConfigs } = require('./wizard-config-normalizer');
const {
  createWizardSession,
  updateWizardSession,
  parseOpenApi,
  credentialSelection,
  detectType,
  generateConfig,
  validateWizardConfig,
  getDeploymentDocs,
  testMcpConnection
} = require('../api/wizard.api');
const { generateWizardFiles } = require('../generator/wizard');

/**
 * Validate app name and check if directory exists
 * @async
 * @function validateAndCheckAppDirectory
 * @param {string} appName - Application name
 * @param {boolean} [interactive=true] - Whether to prompt for confirmation
 * @returns {Promise<boolean>} True if should continue, false if cancelled
 */
async function validateAndCheckAppDirectory(appName, interactive = true) {
  if (!/^[a-z0-9-_]+$/.test(appName)) {
    throw new Error('Application name must contain only lowercase letters, numbers, hyphens, and underscores');
  }
  const appPath = path.join(process.cwd(), 'integration', appName);
  try {
    await fs.access(appPath);
    if (interactive) {
      const { overwrite } = await require('inquirer').prompt([{
        type: 'confirm', name: 'overwrite',
        message: `Directory ${appPath} already exists. Overwrite?`, default: false
      }]);
      if (!overwrite) {
        logger.log(chalk.yellow('Wizard cancelled.')); return false;
      }
    } else {
      logger.log(chalk.yellow(`Warning: Directory ${appPath} exists. Overwriting...`));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return true;
}

/**
 * Extract session ID from response data
 * @function extractSessionId
 * @param {Object} responseData - Response data from API
 * @returns {string} Session ID
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
 * Handle mode selection step - create wizard session
 * @async
 * @function handleModeSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} [configMode] - Mode from config file
 * @param {string} [systemIdOrKey] - System ID or key
 * @returns {Promise<Object>} Object with mode and sessionId
 */
async function handleModeSelection(dataplaneUrl, authConfig, configMode = null, systemIdOrKey = null) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 1: Create Session'));
  const mode = configMode || 'create-system';
  const sessionResponse = await createWizardSession(dataplaneUrl, authConfig, mode, systemIdOrKey);
  if (!sessionResponse.success || !sessionResponse.data) {
    const errorMsg = sessionResponse.formattedError || sessionResponse.error ||
      sessionResponse.errorData?.detail || 'Unknown error';
    throw new Error(`Failed to create wizard session: ${errorMsg}`);
  }
  const sessionId = extractSessionId(sessionResponse.data);
  logger.log(chalk.green(`\u2713 Session created: ${sessionId}`));
  return { mode, sessionId };
}

/**
 * Handle source selection step
 * @async
 * @function handleSourceSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} sessionId - Wizard session ID
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [configSource] - Source config from wizard.yaml
 * @returns {Promise<Object>} Object with sourceType and sourceData
 */
async function handleSourceSelection(dataplaneUrl, sessionId, authConfig, configSource = null) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 2: Parse OpenAPI'));
  let sourceType, sourceData = null;
  const updateData = { currentStep: 1 };
  if (configSource) {
    sourceType = configSource.type;
    if (sourceType === 'openapi-file') sourceData = configSource.filePath;
    else if (sourceType === 'openapi-url') {
      sourceData = configSource.url;
      updateData.openapiSpec = null;
    } else if (sourceType === 'mcp-server') {
      sourceData = JSON.stringify({ serverUrl: configSource.serverUrl, token: configSource.token });
      updateData.mcpServerUrl = configSource.serverUrl;
    } else if (sourceType === 'known-platform') sourceData = configSource.platform;
  }
  const updateResponse = await updateWizardSession(dataplaneUrl, sessionId, authConfig, updateData);
  if (!updateResponse.success) {
    throw new Error(`Source selection failed: ${updateResponse.error || updateResponse.formattedError}`);
  }
  return { sourceType, sourceData };
}

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
 * Handle OpenAPI parsing step
 * @async
 * @function handleOpenApiParsing
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} sourceType - Source type
 * @param {string} sourceData - Source data
 * @returns {Promise<Object|null>} OpenAPI spec or null
 */
async function handleOpenApiParsing(dataplaneUrl, authConfig, sourceType, sourceData) {
  if (sourceType === 'openapi-file' || sourceType === 'openapi-url') {
    return await parseOpenApiSource(dataplaneUrl, authConfig, sourceType, sourceData);
  }
  if (sourceType === 'mcp-server') {
    return await testMcpServerConnection(dataplaneUrl, authConfig, sourceData);
  }
  if (sourceType === 'known-platform' && sourceData) {
    const platformKey = String(sourceData).toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const filePath = process.env[`${platformKey}_OPENAPI_FILE`];
    const url = process.env[`${platformKey}_OPENAPI_URL`];
    if (filePath) return await parseOpenApiSource(dataplaneUrl, authConfig, 'openapi-file', filePath);
    if (url) return await parseOpenApiSource(dataplaneUrl, authConfig, 'openapi-url', url);
  }
  return null;
}

/**
 * Handle credential selection step
 * @async
 * @function handleCredentialSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [configCredential] - Credential config from wizard.yaml
 * @returns {Promise<string|null>} Credential ID/key or null if skipped
 */
async function handleCredentialSelection(dataplaneUrl, authConfig, configCredential = null) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 3: Credential Selection (Optional)'));
  const selectionData = configCredential ? {
    action: configCredential.action,
    credentialConfig: configCredential.config,
    credentialIdOrKey: configCredential.credentialIdOrKey
  } : { action: 'skip' };
  if (selectionData.action === 'skip') {
    logger.log(chalk.gray('  Skipping credential selection'));
    return null;
  }
  const spinner = ora('Processing credential selection...').start();
  try {
    const response = await credentialSelection(dataplaneUrl, authConfig, selectionData);
    spinner.stop();
    if (!response.success) {
      logger.log(chalk.yellow(`Warning: Credential selection failed: ${response.error}`));
      return null;
    }
    const actionText = selectionData.action === 'create' ? 'created' : 'selected';
    logger.log(chalk.green(`\u2713 Credential ${actionText}`));
    return response.data?.credentialIdOrKey || null;
  } catch (error) {
    spinner.stop();
    logger.log(chalk.yellow(`Warning: Credential selection failed: ${error.message}`));
    return null;
  }
}

/**
 * Handle type detection step
 * @async
 * @function handleTypeDetection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} openapiSpec - OpenAPI specification
 * @returns {Promise<Object|null>} Detected type or null
 */
async function handleTypeDetection(dataplaneUrl, authConfig, openapiSpec) {
  if (!openapiSpec) return null;
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 4: Detect Type'));
  const spinner = ora('Detecting API type...').start();
  try {
    const detectResponse = await detectType(dataplaneUrl, authConfig, openapiSpec);
    spinner.stop();
    if (detectResponse.success && detectResponse.data) {
      const detectedType = detectResponse.data;
      const recommendedType = detectedType.recommendedType || detectedType.apiType || 'unknown';
      logger.log(chalk.green(`\u2713 API type detected: ${recommendedType}`));
      return detectedType;
    }
  } catch (error) {
    spinner.stop();
    logger.log(chalk.yellow(`Warning: Type detection failed: ${error.message}`));
  }
  return null;
}

/**
 * Build configuration preferences from configPrefs object
 * @function buildConfigPreferences
 * @param {Object} [configPrefs] - Preferences from wizard.yaml
 * @returns {Object} Configuration preferences object
 */
function buildConfigPreferences(configPrefs) {
  return {
    intent: configPrefs?.intent || 'general integration',
    fieldOnboardingLevel: configPrefs?.fieldOnboardingLevel || 'full',
    enableOpenAPIGeneration: configPrefs?.enableOpenAPIGeneration !== false,
    userPreferences: {
      enableMCP: configPrefs?.enableMCP || false,
      enableABAC: configPrefs?.enableABAC || false,
      enableRBAC: configPrefs?.enableRBAC || false
    }
  };
}

/**
 * Build configuration payload for API call
 * @function buildConfigPayload
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
  return payload;
}

/**
 * Extract configuration from API response
 * @function extractConfigurationFromResponse
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
 * Handle configuration generation step
 * @async
 * @function handleConfigurationGeneration
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Configuration options
 * @param {string} options.mode - Selected mode
 * @param {Object} options.openapiSpec - OpenAPI specification
 * @param {Object} options.detectedType - Detected type info
 * @param {Object} [options.configPrefs] - Preferences from wizard.yaml
 * @param {string} [options.credentialIdOrKey] - Credential ID or key (optional)
 * @param {string} [options.systemIdOrKey] - System ID or key (optional)
 * @returns {Promise<Object>} Generated configuration
 */
async function handleConfigurationGeneration(dataplaneUrl, authConfig, options) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 5: Generate Configuration'));
  const prefs = buildConfigPreferences(options.configPrefs);
  const spinner = ora('Generating configuration via AI (10-30 seconds)...').start();
  try {
    const configPayload = buildConfigPayload({
      openapiSpec: options.openapiSpec,
      detectedType: options.detectedType,
      mode: options.mode,
      prefs,
      credentialIdOrKey: options.credentialIdOrKey,
      systemIdOrKey: options.systemIdOrKey
    });
    const generateResponse = await generateConfig(dataplaneUrl, authConfig, configPayload);
    spinner.stop();
    if (!generateResponse.success) {
      throw new Error(`Configuration generation failed: ${generateResponse.error || generateResponse.formattedError}`);
    }
    const result = extractConfigurationFromResponse(generateResponse);
    const normalized = normalizeWizardConfigs(result.systemConfig, result.datasourceConfigs);
    logger.log(chalk.green('\u2713 Configuration generated successfully'));
    return {
      systemConfig: normalized.systemConfig,
      datasourceConfigs: normalized.datasourceConfigs,
      systemKey: result.systemKey
    };
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
 */
// eslint-disable-next-line max-statements
async function validateWizardConfiguration(dataplaneUrl, authConfig, systemConfig, datasourceConfigs) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 6: Validate Configuration'));
  const spinner = ora('Validating configuration...').start();
  try {
    const configs = Array.isArray(datasourceConfigs) ? datasourceConfigs : [datasourceConfigs];
    const warnings = [];
    for (const datasourceConfig of configs) {
      const validateResponse = await validateWizardConfig(dataplaneUrl, authConfig, systemConfig, datasourceConfig);
      const isValid = validateResponse.success && (validateResponse.data?.valid || validateResponse.data?.isValid);
      if (!isValid) {
        const errors = validateResponse.data?.errors || validateResponse.errorData?.errors || [];
        const errorDetail = validateResponse.errorData?.detail || validateResponse.errorData?.message;
        const errorMsg = errors.length > 0 ? errors.map(e => e.message || e).join(', ') : errorDetail || validateResponse.error || 'Validation failed';
        spinner.stop();
        throw new Error(`Configuration validation failed: ${errorMsg}`);
      }
      if (validateResponse.data?.warnings?.length > 0) warnings.push(...validateResponse.data.warnings);
    }
    spinner.stop();
    logger.log(chalk.green('\u2713 Configuration validated successfully'));
    if (warnings.length > 0) {
      logger.log(chalk.yellow('\n\u26A0 Warnings:'));
      warnings.forEach(w => logger.log(chalk.yellow(`  - ${w.message || w}`)));
    }
  } catch (error) {
    spinner.stop();
    throw error;
  }
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
 */
async function handleFileSaving(appName, systemConfig, datasourceConfigs, systemKey, dataplaneUrl, authConfig) {
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 7: Save Files'));
  const spinner = ora('Saving files...').start();
  try {
    let aiGeneratedReadme = null;
    if (systemKey && dataplaneUrl && authConfig) {
      try {
        const docsResponse = await getDeploymentDocs(dataplaneUrl, authConfig, systemKey);
        if (docsResponse.success && docsResponse.data?.content) aiGeneratedReadme = docsResponse.data.content;
      } catch (e) {
        logger.log(chalk.gray(`  Could not fetch AI-generated README: ${e.message}`));
      }
    }
    const generatedFiles = await generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, { aiGeneratedReadme });
    spinner.stop();
    logger.log(chalk.green('\n\u2713 Wizard completed successfully!'));
    logger.log(chalk.green(`\nFiles created in: ${generatedFiles.appPath}`));
    logger.log(chalk.blue('\nNext steps:'));
    logger.log(chalk.gray(`  1. Review the generated files in integration/${appName}/`));
    logger.log(chalk.gray('  2. Update env.template with your authentication details'));
    logger.log(chalk.gray(`  3. Deploy using: ./deploy.sh or aifabrix deploy ${appName}`));
    return generatedFiles;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Setup dataplane URL and authentication
 * @async
 * @function setupDataplaneAndAuth
 * @param {Object} options - Command options
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Object with dataplaneUrl and authConfig
 */
async function setupDataplaneAndAuth(options, appName) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  let authConfig;
  try {
    // For wizard mode creating new external systems, use device-only auth
    // since the app doesn't exist yet. Device token is sufficient for
    // discovering the dataplane URL and running the wizard.
    authConfig = await getDeviceOnlyAuth(controllerUrl);
  } catch (error) {
    // Fallback to getDeploymentAuth if device-only auth fails
    // (e.g., for add-datasource mode where app might exist)
    try {
      authConfig = await getDeploymentAuth(controllerUrl, environment, appName);
    } catch (fallbackError) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }
  const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
  let dataplaneUrl;
  try {
    dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
  } catch (error) {
    throw new Error(
      `${error.message}\n\n` +
      'The dataplane URL is automatically discovered from the controller.\n' +
      'If discovery fails, ensure you are logged in and the controller is accessible:\n' +
      '   aifabrix login'
    );
  }
  return { dataplaneUrl, authConfig };
}

module.exports = {
  validateAndCheckAppDirectory, extractSessionId, handleModeSelection, handleSourceSelection, handleOpenApiParsing,
  handleCredentialSelection, handleTypeDetection, handleConfigurationGeneration, validateWizardConfiguration,
  handleFileSaving, setupDataplaneAndAuth
};
