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
const { validateTemplate, copyTemplateFiles, copyAppFiles } = require('./template-validator');
const { promptForOptions } = require('./app-prompts');
const { generateConfigFiles } = require('./app-config');
const { validateAppName, pushApp } = require('./app-push');
const { generateDockerfileForApp } = require('./app-dockerfile');
const { loadTemplateVariables, updateTemplateVariables, mergeTemplateVariables } = require('./utils/template-helpers');
const logger = require('./utils/logger');

/**
 * Displays success message after app creation
 * @param {string} appName - Application name
 * @param {Object} config - Final configuration
 * @param {string} envConversionMessage - Environment conversion message
 */
function displaySuccessMessage(appName, config, envConversionMessage, hasAppFiles = false) {
  logger.log(chalk.green('\n✓ Application created successfully!'));
  logger.log(chalk.blue(`\nApplication: ${appName}`));
  logger.log(chalk.blue(`Location: builder/${appName}/`));
  if (hasAppFiles) {
    logger.log(chalk.blue(`Application files: apps/${appName}/`));
  }
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
async function validateAppDirectoryNotExists(appPath, appName, baseDir = 'builder') {
  try {
    await fs.access(appPath);
    throw new Error(`Application '${appName}' already exists in ${baseDir}/${appName}/`);
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
 * Validates app creation prerequisites
 * @async
 * @function validateAppCreation
 * @param {string} appName - Application name
 * @param {Object} options - Creation options
 * @param {string} appPath - Application directory path
 * @throws {Error} If validation fails
 */
async function validateAppCreation(appName, options, appPath) {
  validateAppName(appName);
  await validateAppDirectoryNotExists(appPath, appName, 'builder');

  if (!options.app) {
    return;
  }

  const appsPath = path.join(process.cwd(), 'apps', appName);
  try {
    await fs.access(appsPath);
    throw new Error(`Application '${appName}' already exists in apps/${appName}/`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Processes template files if template is specified
 * @async
 * @function processTemplateFiles
 * @param {string} template - Template name
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @param {Object} options - Creation options
 * @param {Object} config - Final configuration
 * @throws {Error} If template processing fails
 */
async function processTemplateFiles(template, appPath, appName, options, config) {
  if (!template) {
    return;
  }

  await validateTemplate(template);
  const copiedFiles = await copyTemplateFiles(template, appPath);
  logger.log(chalk.green(`✓ Copied ${copiedFiles.length} file(s) from template '${template}'`));
  await updateTemplateVariables(appPath, appName, options, config);
}

/**
 * Updates variables.yaml for --app flag
 * @async
 * @function updateVariablesForAppFlag
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @throws {Error} If update fails
 */
async function updateVariablesForAppFlag(appPath, appName) {
  try {
    const yaml = require('js-yaml');
    const variablesPath = path.join(appPath, 'variables.yaml');
    const variablesContent = await fs.readFile(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    if (variables.build) {
      variables.build.context = '../..';
      variables.build.envOutputPath = `apps/${appName}/.env`;
    } else {
      variables.build = {
        context: '../..',
        envOutputPath: `apps/${appName}/.env`
      };
    }

    await fs.writeFile(variablesPath, yaml.dump(variables, { indent: 2, lineWidth: 120, noRefs: true }));
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Warning: Could not update variables.yaml: ${error.message}`));
  }
}

/**
 * Gets language from config or variables.yaml
 * @async
 * @function getLanguageForAppFiles
 * @param {string} language - Language from config
 * @param {string} appPath - Application directory path
 * @returns {Promise<string>} Language to use
 * @throws {Error} If language cannot be determined
 */
async function getLanguageForAppFiles(language, appPath) {
  if (language) {
    return language;
  }

  const yaml = require('js-yaml');
  const variablesPath = path.join(appPath, 'variables.yaml');
  const variablesContent = await fs.readFile(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);
  const languageFromYaml = variables?.build?.language;

  if (!languageFromYaml) {
    throw new Error('Language not specified and could not be determined from variables.yaml. Use --language flag or ensure variables.yaml contains build.language');
  }

  return languageFromYaml;
}

/**
 * Sets up apps directory and copies application files
 * @async
 * @function setupAppFiles
 * @param {string} appName - Application name
 * @param {string} appPath - Application directory path
 * @param {Object} config - Final configuration
 * @param {Object} options - Creation options
 * @throws {Error} If setup fails
 */
async function setupAppFiles(appName, appPath, config, options) {
  const appsPath = path.join(process.cwd(), 'apps', appName);
  await fs.mkdir(appsPath, { recursive: true });
  await updateVariablesForAppFlag(appPath, appName);

  const language = await getLanguageForAppFiles(config.language || options.language, appPath);
  const copiedFiles = await copyAppFiles(language, appsPath);
  logger.log(chalk.green(`✓ Copied ${copiedFiles.length} application file(s) to apps/${appName}/`));
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
    // Validate appName early
    if (!appName || typeof appName !== 'string') {
      throw new Error('Application name is required');
    }

    const builderPath = path.join(process.cwd(), 'builder');
    const appPath = path.join(builderPath, appName);

    await validateAppCreation(appName, options, appPath);

    if (options.template) {
      await validateTemplate(options.template);
    }

    const templateVariables = await loadTemplateVariables(options.template);
    const mergedOptions = mergeTemplateVariables(options, templateVariables);
    const config = await promptForOptions(appName, mergedOptions);

    await fs.mkdir(appPath, { recursive: true });
    await processTemplateFiles(options.template, appPath, appName, options, config);

    const existingEnv = await readExistingEnv(process.cwd());
    const envConversionMessage = existingEnv
      ? '\n✓ Found existing .env file - sensitive values will be converted to kv:// references'
      : '';

    await generateConfigFiles(appPath, appName, config, existingEnv);

    if (options.app) {
      await setupAppFiles(appName, appPath, config, options);
    }

    await handleGitHubWorkflows(options, config);
    displaySuccessMessage(appName, config, envConversionMessage, options.app);
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
