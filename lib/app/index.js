/**
 * AI Fabrix Builder Application Management
 *
 * This module handles application building, running, and deployment.
 * Includes runtime detection, Dockerfile generation, and container management.
 *
 * @fileoverview Application build and run management for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const { readExistingEnv } = require('../core/env-reader');
const build = require('../build/index');
const appRun = require('./run');
const { promptForOptions } = require('./prompts');
const { generateConfigFiles } = require('./config');
const { pushApp } = require('./push');
const { generateDockerfileForApp } = require('./dockerfile');
const { loadTemplateVariables, updateTemplateVariables, mergeTemplateVariables } = require('../utils/template-helpers');
const { validateTemplate } = require('../validation/template');
const auditLogger = require('../core/audit-logger');
const { downApp } = require('./down');
const { getAppPath } = require('../utils/paths');
const { displaySuccessMessage } = require('./display');
const {
  validateAppDirectoryNotExists,
  getBaseDirForAppType,
  handleGitHubWorkflows,
  validateAppCreation,
  processTemplateFiles,
  setupAppFiles
} = require('./helpers');

/**
 * Creates new application with scaffolded configuration files
 * Prompts for configuration options and generates builder/ folder structure
 *
 * @async
 * @function createApp
 * @param {string} appName - Name of the application to create
 * @param {Object} options - Creation options
 * @param {number} [options.port] - Application port
 * @param {boolean} [options.database] - Requires database
 * @param {boolean} [options.redis] - Requires Redis
 * @param {boolean} [options.storage] - Requires file storage
 * @param {boolean} [options.authentication] - Requires authentication/RBAC
 * @param {string} [options.language] - Runtime language (typescript/python)
 * @param {string} [options.template] - Template to use (e.g., controller, keycloak)
 * @returns {Promise<void>} Resolves when app is created
 * @throws {Error} If creation fails
 *
 * @example
 * await createApp('myapp', { port: 3000, database: true, language: 'typescript' });
 * // Creates builder/ with variables.yaml, env.template, rbac.yaml
 */
/**
 * Validates app name and initial setup
 * @function validateAppNameAndSetup
 * @param {string} appName - Application name
 * @param {Object} options - Options
 * @returns {Object} Initial paths and type
 */
function validateAppNameAndSetup(appName, options) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required');
  }

  const initialType = options.type || 'webapp';
  const baseDir = getBaseDirForAppType(initialType);
  const appPath = getAppPath(appName, initialType);

  return { initialType, baseDir, appPath };
}

/**
 * Handles template validation and loading
 * @async
 * @function handleTemplateSetup
 * @param {Object} options - Options
 * @returns {Promise<Object>} Merged options with template variables
 */
async function handleTemplateSetup(options) {
  if (options.template) {
    await validateTemplate(options.template);
  }
  const templateVariables = await loadTemplateVariables(options.template);
  return mergeTemplateVariables(options, templateVariables);
}

/**
 * Validates and prepares final app path
 * @async
 * @function prepareFinalAppPath
 * @param {string} appName - Application name
 * @param {Object} config - Configuration
 * @param {string} initialAppPath - Initial app path
 * @returns {Promise<string>} Final app path
 */
async function prepareFinalAppPath(appName, config, initialAppPath) {
  const finalBaseDir = getBaseDirForAppType(config.type);
  const finalAppPath = getAppPath(appName, config.type);

  // If path changed, validate the new path
  if (finalAppPath !== initialAppPath) {
    await validateAppDirectoryNotExists(finalAppPath, appName, finalBaseDir);
  }

  return finalAppPath;
}

/**
 * Generates all application files
 * @async
 * @function generateApplicationFiles
 * @param {string} finalAppPath - Final app path
 * @param {string} appName - Application name
 * @param {Object} config - Configuration
 * @param {Object} options - Options
 * @returns {Promise<string>} Environment conversion message
 */
async function generateApplicationFiles(finalAppPath, appName, config, options) {
  await fs.mkdir(finalAppPath, { recursive: true });
  await processTemplateFiles(options.template, finalAppPath, appName, options, config);

  const existingEnv = await readExistingEnv(process.cwd());
  const envConversionMessage = existingEnv
    ? '\n✓ Found existing .env file - sensitive values will be converted to kv:// references'
    : '';

  await generateConfigFiles(finalAppPath, appName, config, existingEnv);

  // Generate external system files if type is external
  if (config.type === 'external') {
    const externalGenerator = require('../external-system/generator');
    await externalGenerator.generateExternalSystemFiles(finalAppPath, appName, config);
  }

  if (options.app) {
    await setupAppFiles(appName, finalAppPath, config, options);
  }

  await handleGitHubWorkflows(options, config);
  return envConversionMessage;
}

/**
 * Logs application creation for audit
 * @async
 * @function logApplicationCreation
 * @param {string} appName - Application name
 * @param {Object} config - Configuration
 * @param {Object} options - Options
 */
async function logApplicationCreation(appName, config, options) {
  await auditLogger.logApplicationCreation(appName, {
    language: config.language,
    port: config.port,
    database: config.database,
    redis: config.redis,
    storage: config.storage,
    authentication: config.authentication,
    template: options.template,
    api: null // Local operation, no API involved
  });
}

async function createApp(appName, options = {}) {
  try {
    const { appPath } = validateAppNameAndSetup(appName, options);
    await validateAppCreation(appName, options, appPath, getBaseDirForAppType(options.type || 'webapp'));

    const mergedOptions = await handleTemplateSetup(options);
    const config = await promptForOptions(appName, mergedOptions);

    const finalAppPath = await prepareFinalAppPath(appName, config, appPath);
    const envConversionMessage = await generateApplicationFiles(finalAppPath, appName, config, options);

    displaySuccessMessage(appName, config, envConversionMessage, options.app, finalAppPath);
    await logApplicationCreation(appName, config, options);
  } catch (error) {
    throw new Error(`Failed to create application: ${error.message}`);
  }
}

/**
 * Builds a container image for the specified application
 * Auto-detects runtime and generates Dockerfile if needed
 *
 * @async
 * @function buildApp
 * @param {string} appName - Name of the application to build
 * @param {Object} options - Build options
 * @param {string} [options.language] - Override language detection
 * @param {boolean} [options.forceTemplate] - Force rebuild from template
 * @param {string} [options.tag] - Image tag (default: latest)
 * @returns {Promise<string>} Image tag that was built
 * @throws {Error} If build fails or app configuration is invalid
 *
 * @example
 * const imageTag = await buildApp('myapp', { language: 'typescript' });
 * // Returns: 'myapp:latest'
 */
async function buildApp(appName, options = {}) {
  return build.buildApp(appName, options);
}

/**
 * Detects the runtime language of an application
 * Analyzes project files to determine TypeScript, Python, etc.
 *
 * @function detectLanguage
 * @param {string} appPath - Path to application directory
 * @returns {string} Detected language ('typescript', 'python', etc.)
 * @throws {Error} If language cannot be detected
 *
 * @example
 * const language = detectLanguage('./myapp');
 * // Returns: 'typescript'
 */
function detectLanguage(appPath) {
  return build.detectLanguage(appPath);
}

/**
 * Generates a Dockerfile from template based on detected language
 * Uses Handlebars templates to create optimized Dockerfiles
 *
 * @async
 * @function generateDockerfile
 * @param {string} appPath - Path to application directory
 * @param {string} language - Target language ('typescript', 'python')
 * @param {Object} config - Application configuration from variables.yaml
 * @returns {Promise<string>} Path to generated Dockerfile
 * @throws {Error} If template generation fails
 *
 * @example
 * const dockerfilePath = await generateDockerfile('./myapp', 'typescript', config);
 * // Returns: './myapp/.aifabrix/Dockerfile.typescript'
 */
async function generateDockerfile(appPath, language, config) {
  return build.generateDockerfile(appPath, language, config);
}

/**
 * Runs the application locally using Docker
 * Starts container with proper port mapping and environment
 *
 * @async
 * @function runApp
 * @param {string} appName - Name of the application to run
 * @param {Object} options - Run options
 * @param {number} [options.port] - Override local port
 * @param {boolean} [options.debug] - Enable debug output
 * @returns {Promise<void>} Resolves when app is running
 * @throws {Error} If run fails or app is not built
 *
 * @example
 * await runApp('myapp', { port: 3001 });
 * // Application is now running on localhost:3001
 */
async function runApp(appName, options = {}) {
  return appRun.runApp(appName, options);
}

/**
 * Deploys application to controller
 * @async
 * @function deployApp
 * @param {string} appName - Name of the application
 * @param {Object} options - Deployment options
 * @returns {Promise<void>} Resolves when deployment is complete
 */
async function deployApp(appName, options = {}) {
  const appDeploy = require('./deploy');
  return appDeploy.deployApp(appName, options);
}

module.exports = {
  createApp,
  buildApp,
  runApp,
  downApp,
  detectLanguage,
  generateDockerfile,
  generateDockerfileForApp,
  pushApp,
  deployApp,
  loadTemplateVariables,
  updateTemplateVariables,
  mergeTemplateVariables,
  checkImageExists: appRun.checkImageExists,
  checkContainerRunning: appRun.checkContainerRunning,
  stopAndRemoveContainer: appRun.stopAndRemoveContainer,
  checkPortAvailable: appRun.checkPortAvailable,
  generateDockerCompose: appRun.generateDockerCompose,
  waitForHealthCheck: appRun.waitForHealthCheck
};
