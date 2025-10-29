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

    try {
      await fs.access(appPath);
      throw new Error(`Application '${appName}' already exists in builder/${appName}/`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Validate template if provided
    if (options.template) {
      await validateTemplate(options.template);
    }

    // Prompt for missing options
    const config = await promptForOptions(appName, options);

    // Create directory structure
    await fs.mkdir(appPath, { recursive: true });

    // Copy template files if template is specified
    if (options.template) {
      const copiedFiles = await copyTemplateFiles(options.template, appPath);
      console.log(chalk.green(`✓ Copied ${copiedFiles.length} file(s) from template '${options.template}'`));
    }

    // Check for existing .env file
    const existingEnv = await readExistingEnv(process.cwd());
    let envConversionMessage = '';

    if (existingEnv) {
      envConversionMessage = '\n✓ Found existing .env file - sensitive values will be converted to kv:// references';
    }

    // Generate configuration files
    await generateConfigFiles(appPath, appName, config, existingEnv);

    // Generate GitHub workflows if requested
    if (options.github) {
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

      console.log(chalk.green('✓ Generated GitHub Actions workflows:'));
      workflowFiles.forEach(file => console.log(chalk.gray(`  - ${file}`)));
    }

    // Display success message
    console.log(chalk.green('\n✓ Application created successfully!'));
    console.log(chalk.blue(`\nApplication: ${appName}`));
    console.log(chalk.blue(`Location: builder/${appName}/`));
    console.log(chalk.blue(`Language: ${config.language}`));
    console.log(chalk.blue(`Port: ${config.port}`));

    if (config.database) console.log(chalk.yellow('  - Database enabled'));
    if (config.redis) console.log(chalk.yellow('  - Redis enabled'));
    if (config.storage) console.log(chalk.yellow('  - Storage enabled'));
    if (config.authentication) console.log(chalk.yellow('  - Authentication enabled'));

    console.log(chalk.gray(envConversionMessage));

    console.log(chalk.green('\nNext steps:'));
    console.log(chalk.white('1. Copy env.template to .env and fill in your values'));
    console.log(chalk.white('2. Run: aifabrix build ' + appName));
    console.log(chalk.white('3. Run: aifabrix run ' + appName));

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
  checkImageExists: appRun.checkImageExists,
  checkContainerRunning: appRun.checkContainerRunning,
  stopAndRemoveContainer: appRun.stopAndRemoveContainer,
  checkPortAvailable: appRun.checkPortAvailable,
  generateDockerCompose: appRun.generateDockerCompose,
  waitForHealthCheck: appRun.waitForHealthCheck
};
