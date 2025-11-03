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
const path = require('path');
const chalk = require('chalk');
const { readExistingEnv } = require('./env-reader');
const build = require('./build');
const appRun = require('./app-run');
const { validateTemplate, copyTemplateFiles } = require('./template-validator');
const { promptForOptions } = require('./app-prompts');
const { generateConfigFiles } = require('./app-config');
const { validateAppName, pushApp } = require('./app-push');
const { generateDockerfileForApp } = require('./app-dockerfile');
const logger = require('./utils/logger');

/**
 * Loads template variables from template's variables.yaml file
 * @async
 * @param {string} templateName - Template name
 * @returns {Promise<Object|null>} Template variables or null if not found
 */
async function loadTemplateVariables(templateName) {
  if (!templateName) {
    return null;
  }

  const yaml = require('js-yaml');
  const templatePath = path.join(__dirname, '..', 'templates', 'applications', templateName);
  const templateVariablesPath = path.join(templatePath, 'variables.yaml');

  try {
    const templateContent = await fs.readFile(templateVariablesPath, 'utf8');
    return yaml.load(templateContent);
  } catch (error) {
    // Template variables.yaml not found or invalid, continue without it
    if (error.code !== 'ENOENT') {
      logger.warn(chalk.yellow(`⚠️  Warning: Could not load template variables.yaml: ${error.message}`));
    }
    return null;
  }
}

/**
 * Updates variables.yaml file after copying from template
 * Updates app.key, displayName, and port with actual values
 * @async
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @param {Object} options - CLI options
 * @param {Object} config - Final configuration
 */
async function updateTemplateVariables(appPath, appName, options, config) {
  const variablesPath = path.join(appPath, 'variables.yaml');
  try {
    const yaml = require('js-yaml');
    const variablesContent = await fs.readFile(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    // Override app.key with the actual app name
    if (variables.app) {
      variables.app.key = appName;
    }

    // Update app name if it's still the template name
    if (variables.app?.displayName && variables.app.displayName.toLowerCase().includes('miso')) {
      variables.app.displayName = appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Update port if provided via CLI options
    if (options.port && config.port && variables.port !== config.port) {
      variables.port = config.port;
    }

    // Write updated variables.yaml
    await fs.writeFile(variablesPath, yaml.dump(variables, { indent: 2, lineWidth: 120, noRefs: true }));
  } catch (error) {
    // If we can't update variables.yaml, continue anyway
    if (error.code !== 'ENOENT') {
      logger.warn(chalk.yellow(`⚠️  Warning: Could not update variables.yaml: ${error.message}`));
    }
  }
}

/**
 * Displays success message after app creation
 * @param {string} appName - Application name
 * @param {Object} config - Final configuration
 * @param {string} envConversionMessage - Environment conversion message
 */
function displaySuccessMessage(appName, config, envConversionMessage) {
  logger.log(chalk.green('\n✓ Application created successfully!'));
  logger.log(chalk.blue(`\nApplication: ${appName}`));
  logger.log(chalk.blue(`Location: builder/${appName}/`));
  logger.log(chalk.blue(`Language: ${config.language}`));
  logger.log(chalk.blue(`Port: ${config.port}`));

  if (config.database) logger.log(chalk.yellow('  - Database enabled'));
  if (config.redis) logger.log(chalk.yellow('  - Redis enabled'));
  if (config.storage) logger.log(chalk.yellow('  - Storage enabled'));
  if (config.authentication) logger.log(chalk.yellow('  - Authentication enabled'));

  logger.log(chalk.gray(envConversionMessage));

  logger.log(chalk.green('\nNext steps:'));
  logger.log(chalk.white('1. Copy env.template to .env and fill in your values'));
  logger.log(chalk.white('2. Run: aifabrix build ' + appName));
  logger.log(chalk.white('3. Run: aifabrix run ' + appName));
}

/**
 * Validates that app directory doesn't already exist
 * @async
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @throws {Error} If directory already exists
 */
async function validateAppDirectoryNotExists(appPath, appName) {
  try {
    await fs.access(appPath);
    throw new Error(`Application '${appName}' already exists in builder/${appName}/`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Handles GitHub workflow generation if requested
 * @async
 * @param {Object} options - Creation options
 * @param {Object} config - Final configuration
 */
async function handleGitHubWorkflows(options, config) {
  if (!options.github) {
    return;
  }

  const githubGen = require('./github-generator');

  // Parse github-steps if provided
  const githubSteps = options.githubSteps
    ? options.githubSteps.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [];

  const workflowFiles = await githubGen.generateGithubWorkflows(
    process.cwd(),
    config,
    {
      mainBranch: options.mainBranch || 'main',
      uploadCoverage: true,
      githubSteps: githubSteps
    }
  );

  logger.log(chalk.green('✓ Generated GitHub Actions workflows:'));
  workflowFiles.forEach(file => logger.log(chalk.gray(`  - ${file}`)));
}

/**
 * Merges port from template variables if not in options
 * @param {Object} merged - Merged options object
 * @param {Object} templateVariables - Template variables
 */
function mergePort(merged, templateVariables) {
  if (!merged.port && templateVariables.port) {
    merged.port = templateVariables.port;
  }
}

/**
 * Merges language from template variables if not in options
 * @param {Object} merged - Merged options object
 * @param {Object} templateVariables - Template variables
 */
function mergeLanguage(merged, templateVariables) {
  if (!merged.language && templateVariables.build?.language) {
    merged.language = templateVariables.build.language;
  }
}

/**
 * Merges service requirements from template variables if not in options
 * @param {Object} merged - Merged options object
 * @param {Object} templateVariables - Template variables
 */
function mergeServices(merged, templateVariables) {
  // Database: use template requires.database if not specified in options
  if (!Object.prototype.hasOwnProperty.call(merged, 'database') &&
      templateVariables.requires?.database !== undefined) {
    merged.database = templateVariables.requires.database;
  }

  // Redis: use template requires.redis if not specified in options
  if (!Object.prototype.hasOwnProperty.call(merged, 'redis') &&
      templateVariables.requires?.redis !== undefined) {
    merged.redis = templateVariables.requires.redis;
  }

  // Storage: use template requires.storage if not specified in options
  if (!Object.prototype.hasOwnProperty.call(merged, 'storage') &&
      templateVariables.requires?.storage !== undefined) {
    merged.storage = templateVariables.requires.storage;
  }
}

/**
 * Merges authentication from template variables if not in options
 * @param {Object} merged - Merged options object
 * @param {Object} templateVariables - Template variables
 */
function mergeAuthentication(merged, templateVariables) {
  if (!Object.prototype.hasOwnProperty.call(merged, 'authentication') &&
      templateVariables.authentication !== undefined) {
    merged.authentication = !!templateVariables.authentication;
  }
}

/**
 * Merges template variables with command-line options
 * Template variables take precedence over defaults but can be overridden by CLI options
 * @param {Object} options - Command-line options
 * @param {Object} templateVariables - Template variables from variables.yaml
 * @returns {Object} Merged options
 */
function mergeTemplateVariables(options, templateVariables) {
  if (!templateVariables) {
    return options;
  }

  const merged = { ...options };

  mergePort(merged, templateVariables);
  mergeLanguage(merged, templateVariables);
  mergeServices(merged, templateVariables);
  mergeAuthentication(merged, templateVariables);

  return merged;
}

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
async function createApp(appName, options = {}) {
  try {
    // Validate app name format
    validateAppName(appName);

    // Check if directory already exists
    const builderPath = path.join(process.cwd(), 'builder');
    const appPath = path.join(builderPath, appName);
    await validateAppDirectoryNotExists(appPath, appName);

    // Validate template if provided
    if (options.template) {
      await validateTemplate(options.template);
    }

    // Load template variables if template is specified
    const templateVariables = await loadTemplateVariables(options.template);

    // Merge template variables with options before prompting
    const mergedOptions = mergeTemplateVariables(options, templateVariables);

    // Prompt for missing options
    const config = await promptForOptions(appName, mergedOptions);

    // Create directory structure
    await fs.mkdir(appPath, { recursive: true });

    // Copy template files if template is specified
    if (options.template) {
      const copiedFiles = await copyTemplateFiles(options.template, appPath);
      logger.log(chalk.green(`✓ Copied ${copiedFiles.length} file(s) from template '${options.template}'`));

      // Update app.key and port in variables.yaml if it was copied from template
      await updateTemplateVariables(appPath, appName, options, config);
    }

    // Check for existing .env file
    const existingEnv = await readExistingEnv(process.cwd());
    const envConversionMessage = existingEnv
      ? '\n✓ Found existing .env file - sensitive values will be converted to kv:// references'
      : '';

    // Generate configuration files (will skip variables.yaml if it exists from template)
    await generateConfigFiles(appPath, appName, config, existingEnv);

    // Generate GitHub workflows if requested
    await handleGitHubWorkflows(options, config);

    // Display success message
    displaySuccessMessage(appName, config, envConversionMessage);

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
  const appDeploy = require('./app-deploy');
  return appDeploy.deployApp(appName, options);
}

module.exports = {
  createApp,
  buildApp,
  runApp,
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
