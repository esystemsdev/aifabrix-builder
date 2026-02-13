/**
 * AI Fabrix Builder - App Register Configuration Utilities
 *
 * Configuration extraction and loading for application registration
 *
 * @fileoverview Configuration utilities for app registration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('./logger');
const { detectAppType, resolveApplicationConfigPath } = require('./paths');
const { loadConfigFile } = require('./config-format');
const { getContainerPort, getLocalPort } = require('./port-resolver');

// createApp is imported dynamically in createMinimalAppIfNeeded to handle test mocking

/**
 * Load application config for an application (application.yaml, application.json, or legacy).
 * @async
 * @param {string} appKey - Application key
 * @returns {Promise<{variables: Object, created: boolean}>} Variables and creation flag
 */
async function loadVariablesYaml(appKey) {
  const { appPath } = await detectAppType(appKey);
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    const variables = loadConfigFile(configPath);
    return { variables, created: false };
  } catch (error) {
    const isNotFound = error.code === 'ENOENT' || (error.message && error.message.includes('not found'));
    if (isNotFound) {
      logger.log(chalk.yellow(`⚠️  Application config not found for ${appKey}`));
      logger.log(chalk.yellow('📝 Creating minimal configuration...\n'));
      return { variables: null, created: true };
    }
    throw new Error(`Failed to read application config: ${error.message}`);
  }
}

/**
 * Create minimal application configuration if needed
 * @async
 * @param {string} appKey - Application key
 * @param {Object} options - Registration options
 * @returns {Promise<Object>} Variables after creation
 */
async function createMinimalAppIfNeeded(appKey, options) {
  // Re-import createApp to check current availability (handles dynamic mocking in tests)
  const { createApp: currentCreateApp } = require('../app');
  if (!currentCreateApp) {
    throw new Error('Cannot auto-create application: createApp function not available');
  }

  await currentCreateApp(appKey, {
    port: options.port,
    language: 'typescript',
    database: false,
    redis: false,
    storage: false,
    authentication: false
  });

  const appTypeResult = await detectAppType(appKey);
  if (!appTypeResult || !appTypeResult.appPath) {
    throw new Error('Failed to detect app type after creation');
  }
  const { appPath } = appTypeResult;
  const configPath = resolveApplicationConfigPath(appPath);
  return loadConfigFile(configPath);
}

/**
 * Builds image reference string from variables
 * Format: repository:tag (e.g., aifabrix/miso-controller:latest or myregistry.azurecr.io/miso-controller:v1.0.0)
 * @param {Object} variables - Variables from application config
 * @param {string} appKey - Application key (fallback)
 * @returns {string} Image reference string
 */
function buildImageReference(variables, appKey) {
  const imageName = variables.image?.name || variables.app?.key || appKey;
  const registry = variables.image?.registry;
  const tag = variables.image?.tag || 'latest';
  return registry ? `${registry}/${imageName}:${tag}` : `${imageName}:${tag}`;
}

/**
 * Extract URL from external system JSON file for registration
 * @async
 * @param {string} appKey - Application key
 * @param {Object} externalIntegration - External integration config from application config
 * @returns {Promise<{url: string, apiKey?: string}>} URL and optional API key
 */
/**
 * Resolves system file path
 * @function resolveSystemFilePath
 * @param {string} appPath - Application path
 * @param {string} schemaBasePath - Schema base path
 * @param {string} systemFileName - System file name
 * @returns {string} Resolved system file path
 */
function resolveSystemFilePath(appPath, schemaBasePath, systemFileName) {
  return path.isAbsolute(schemaBasePath)
    ? path.join(schemaBasePath, systemFileName)
    : path.join(appPath, schemaBasePath, systemFileName);
}

/**
 * Base URL is no longer read from manifest; Controller resolves from configuration at deploy time.
 * @function extractUrlFromSystemJson
 * @param {Object} _systemJson - System JSON object (unused; kept for call-site compatibility)
 * @param {string} _systemFileName - System file name (unused)
 * @returns {undefined} URL is not supplied from manifest
 */
function extractUrlFromSystemJson(_systemJson, _systemFileName) {
  return undefined;
}

/**
 * Extracts API key from system JSON if present
 * @function extractApiKeyFromSystemJson
 * @param {Object} systemJson - System JSON object
 * @returns {string|undefined} API key or undefined
 */
function extractApiKeyFromSystemJson(systemJson) {
  if (!systemJson.authentication?.apikey?.key) {
    return undefined;
  }

  // If it's a kv:// reference, we can't resolve it here, so leave it undefined
  // The API will handle kv:// references
  const keyValue = systemJson.authentication.apikey.key;
  if (keyValue.startsWith('kv://') || keyValue.startsWith('{{')) {
    return undefined;
  }

  return keyValue;
}

/**
 * Handles file read errors
 * @function handleFileReadError
 * @param {Error} error - Error object
 * @param {string} systemFilePath - System file path
 * @throws {Error} Formatted error
 */
function handleFileReadError(error, systemFilePath) {
  if (error.code === 'ENOENT') {
    throw new Error(`External system file not found: ${systemFilePath}`);
  }
  throw new Error(`Failed to read external system file: ${error.message}`);
}

async function extractExternalIntegrationUrl(appKey, externalIntegration) {
  if (!externalIntegration || !externalIntegration.systems || externalIntegration.systems.length === 0) {
    throw new Error('externalIntegration.systems is required for external type applications');
  }

  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appKey);
  const schemaBasePath = externalIntegration.schemaBasePath || './';
  const systemFileName = externalIntegration.systems[0];

  // Resolve system file path (handle both relative and absolute paths)
  const systemFilePath = resolveSystemFilePath(appPath, schemaBasePath, systemFileName);

  try {
    const systemJson = loadConfigFile(systemFilePath);
    const url = extractUrlFromSystemJson(systemJson, systemFileName);
    const apiKey = extractApiKeyFromSystemJson(systemJson);
    return { url, apiKey };
  } catch (error) {
    handleFileReadError(error, systemFilePath);
  }
}

/**
 * Extract application configuration from application config
 * @async
 * @param {Object} variables - Variables from YAML file
 * @param {string} appKey - Application key
 * @param {Object} options - Registration options
 * @returns {Promise<Object>} Extracted configuration
 */
/**
 * Extracts external app configuration
 * @async
 * @function extractExternalAppConfiguration
 * @param {string} appKey - Application key
 * @param {Object} variables - Variables object
 * @param {string} appKeyFromFile - App key from file
 * @param {string} displayName - Display name
 * @param {string} description - Description
 * @returns {Promise<Object>} External app configuration
 */
async function extractExternalAppConfiguration(appKey, variables, appKeyFromFile, displayName, description) {
  const { url, apiKey } = await extractExternalIntegrationUrl(appKey, variables.externalIntegration);
  const externalIntegration = {};
  if (url !== undefined && url !== null) {
    externalIntegration.url = url;
  }
  if (apiKey) {
    externalIntegration.apiKey = apiKey;
  }

  return {
    appKey: appKeyFromFile,
    displayName,
    description,
    appType: 'external',
    externalIntegration,
    port: null,
    image: null,
    language: null
  };
}

/**
 * Extracts webapp/service configuration
 * @function extractWebappConfiguration
 * @param {Object} variables - Variables object
 * @param {string} appKeyFromFile - App key from file
 * @param {string} displayName - Display name
 * @param {string} description - Description
 * @param {Object} options - Options object
 * @returns {Object} Webapp configuration
 */
function extractWebappConfiguration(variables, appKeyFromFile, displayName, description, options) {
  const appType = variables.build?.language === 'typescript' ? 'webapp' : 'service';
  const registryMode = variables.image?.registryMode || 'external';
  const port = options.port ?? getContainerPort(variables, 3000);
  const localPort = getLocalPort(variables, port);
  const language = variables.build?.language || 'typescript';
  const image = buildImageReference(variables, appKeyFromFile);
  const url = variables.app?.url || variables.deployment?.dataplaneUrl || variables.deployment?.appUrl || null;

  return {
    appKey: appKeyFromFile,
    displayName,
    description,
    appType,
    registryMode,
    port,
    localPort,
    image,
    language,
    url
  };
}

async function extractAppConfiguration(variables, appKey, options) {
  const appKeyFromFile = variables.app?.key || appKey;
  const displayName = variables.app?.name || options.name || appKey;
  const description = variables.app?.description || '';

  if (variables.app?.type === 'external') {
    return await extractExternalAppConfiguration(appKey, variables, appKeyFromFile, displayName, description);
  }

  return extractWebappConfiguration(variables, appKeyFromFile, displayName, description, options);
}

module.exports = {
  loadVariablesYaml,
  createMinimalAppIfNeeded,
  buildImageReference,
  extractAppConfiguration,
  extractExternalIntegrationUrl
};

