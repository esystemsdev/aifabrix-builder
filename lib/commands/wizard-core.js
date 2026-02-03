/**
 * @fileoverview Wizard core functions - shared between interactive and headless modes
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { getDeploymentAuth } = require('../utils/token-manager');
const { resolveControllerUrl } = require('../utils/controller-url');
const { normalizeWizardConfigs } = require('./wizard-config-normalizer');
const {
  createWizardSession,
  updateWizardSession,
  detectType,
  generateConfig,
  validateWizardConfig,
  getDeploymentDocs,
  postDeploymentDocs
} = require('../api/wizard.api');
const { generateWizardFiles } = require('../generator/wizard');
const {
  parseOpenApiSource,
  testMcpServerConnection,
  normalizeCredentialSelectionInput,
  runCredentialSelectionLoop,
  buildConfigPreferences,
  buildConfigPayload,
  extractConfigurationFromResponse,
  throwConfigGenerationError
} = require('./wizard-core-helpers');

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
 * Full error message when dataplane returns 401 (controller accepts token, dataplane rejects it).
 * Avoids misleading "token invalid or expired" / "run login" text from the API formatter.
 * @param {string} [dataplaneUrl] - Dataplane URL (for context)
 * @param {string} [appName] - Application name for credential hint
 * @param {string} [apiMessage] - Raw message from API (e.g. "Invalid token or insufficient permissions")
 * @returns {string} Full message explaining the actual problem
 */
function formatDataplaneRejectedTokenMessage(dataplaneUrl = '', appName = null, apiMessage = '') {
  const app = appName || '<app>';
  const where = dataplaneUrl ? ` the dataplane at ${dataplaneUrl}` : ' the dataplane';
  const apiLine = apiMessage ? `\n\nResponse: ${apiMessage}` : '';
  return (
    'Failed to create wizard session.' +
    apiLine +
    `\n\nYour token is valid for the controller (aifabrix auth status shows you as authenticated), but${where} rejected the request.` +
    ' This usually means:\n' +
    '  • The dataplane is configured to accept only client credentials, not device tokens, or\n' +
    '  • There is a permission or configuration issue on the dataplane side.\n\n' +
    'What you can do:\n' +
    `  • Add client credentials to ~/.aifabrix/secrets.local.yaml as "${app}-client-idKeyVault" and "${app}-client-secretKeyVault" if the dataplane accepts them.\n` +
    '  • Contact your administrator to have the dataplane accept your token or to get the required client credentials.\n' +
    '  • Run "aifabrix doctor" for environment diagnostics.'
  );
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
    const apiMessage = sessionResponse.errorData?.message || sessionResponse.errorData?.detail || sessionResponse.error || '';
    const fullMsg = sessionResponse.status === 401
      ? formatDataplaneRejectedTokenMessage(dataplaneUrl, null, apiMessage)
      : `Failed to create wizard session: ${errorMsg}`;
    throw new Error(fullMsg);
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
 * Handle credential selection step.
 * Validation is done by the dataplane (POST /api/v1/wizard/credential-selection).
 * When action is 'select' and the API fails (e.g. credential not found), and allowRetry is true,
 * we re-prompt for credential ID/key or allow the user to skip (empty = skip).
 * @async
 * @function handleCredentialSelection
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} [configCredential] - Credential config from wizard.yaml or prompt
 * @param {Object} [options] - Options
 * @param {boolean} [options.allowRetry=true] - If true (interactive), re-prompt on failure for 'select'; if false (headless), do not re-prompt
 * @returns {Promise<string|null>} Credential ID/key or null if skipped / failed
 */
async function handleCredentialSelection(dataplaneUrl, authConfig, configCredential = null, options = {}) {
  const allowRetry = options.allowRetry !== false;
  logger.log(chalk.blue('\n\uD83D\uDCCB Step 3: Credential Selection (Optional)'));
  const selectionData = normalizeCredentialSelectionInput(configCredential);
  if (selectionData.action === 'skip') {
    logger.log(chalk.gray('  Skipping credential selection'));
    return null;
  }
  return await runCredentialSelectionLoop(dataplaneUrl, authConfig, selectionData, allowRetry);
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
      throwConfigGenerationError(generateResponse);
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
    const generatedFiles = await generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, { aiGeneratedReadme: null });
    if (systemKey && dataplaneUrl && authConfig && generatedFiles.appPath) {
      try {
        const appPath = generatedFiles.appPath;
        const deployKey = appName;
        const variablesPath = path.join(appPath, 'variables.yaml');
        const deployPath = path.join(appPath, `${deployKey}-deploy.json`);
        let variablesYaml = null;
        let deployJson = null;
        try {
          variablesYaml = await fs.readFile(variablesPath, 'utf8');
        } catch {
          // optional
        }
        try {
          const deployContent = await fs.readFile(deployPath, 'utf8');
          deployJson = JSON.parse(deployContent);
        } catch {
          // optional
        }
        const body = (variablesYaml !== null && variablesYaml !== undefined) || (deployJson !== null && deployJson !== undefined) ? { variablesYaml: variablesYaml || null, deployJson: deployJson || null } : null;
        const docsResponse = body
          ? await postDeploymentDocs(dataplaneUrl, authConfig, systemKey, body)
          : await getDeploymentDocs(dataplaneUrl, authConfig, systemKey);
        const content = docsResponse?.data?.content ?? docsResponse?.content;
        if (content && typeof content === 'string') {
          const readmePath = path.join(appPath, 'README.md');
          await fs.writeFile(readmePath, content, 'utf8');
          logger.log(chalk.gray('  Updated README.md from deployment-docs API (variables.yaml + deploy JSON).'));
        }
      } catch (e) {
        logger.log(chalk.gray(`  Could not fetch AI-generated README: ${e.message}`));
      }
    }
    spinner.stop();
    logger.log(chalk.green('\n\u2713 Wizard completed successfully!'));
    logger.log(chalk.green(`\nFiles created in: ${generatedFiles.appPath}`));
    logger.log(chalk.blue('\nNext steps:'));
    logger.log(chalk.gray(`  1. Review the generated files in integration/${appName}/`));
    logger.log(chalk.gray('  2. Update env.template with your authentication details'));
    logger.log(chalk.gray(`  3. Deploy using: node deploy.js or aifabrix deploy ${appName}`));
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
  // Prefer device token; use client token or client credentials when available.
  // Some dataplanes accept only client credentials; getDeploymentAuth tries all.
  let authConfig;
  try {
    authConfig = await getDeploymentAuth(controllerUrl, environment, appName);
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
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
  validateAndCheckAppDirectory,
  extractSessionId,
  formatDataplaneRejectedTokenMessage,
  handleModeSelection,
  handleSourceSelection,
  handleOpenApiParsing,
  handleCredentialSelection,
  handleTypeDetection,
  handleConfigurationGeneration,
  validateWizardConfiguration,
  handleFileSaving,
  setupDataplaneAndAuth
};
