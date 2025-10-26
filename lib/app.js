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
const inquirer = require('inquirer');
const chalk = require('chalk');
const yaml = require('js-yaml');
const { generateVariablesYaml, generateEnvTemplate, generateRbacYaml } = require('./templates');
const { readExistingEnv, generateEnvTemplate: generateEnvTemplateFromReader } = require('./env-reader');
const build = require('./build');
const appRun = require('./app-run');
const pushUtils = require('./push');

/**
 * Validate application name format
 * @param {string} appName - Application name to validate
 * @throws {Error} If app name is invalid
 */
function validateAppName(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required');
  }

  // App name should be lowercase, alphanumeric with dashes, 3-40 characters
  const nameRegex = /^[a-z0-9-]{3,40}$/;
  if (!nameRegex.test(appName)) {
    throw new Error('Application name must be 3-40 characters, lowercase letters, numbers, and dashes only');
  }

  // Cannot start or end with dash
  if (appName.startsWith('-') || appName.endsWith('-')) {
    throw new Error('Application name cannot start or end with a dash');
  }

  // Cannot have consecutive dashes
  if (appName.includes('--')) {
    throw new Error('Application name cannot have consecutive dashes');
  }
}

/**
 * Prompt for missing configuration options
 * @param {string} appName - Application name
 * @param {Object} options - Provided options
 * @returns {Promise<Object>} Complete configuration
 */
async function promptForOptions(appName, options) {
  const questions = [];

  // Port validation
  if (!options.port) {
    questions.push({
      type: 'input',
      name: 'port',
      message: 'What port should the application run on?',
      default: '3000',
      validate: (input) => {
        const port = parseInt(input, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Port must be a number between 1 and 65535';
        }
        return true;
      }
    });
  }

  // Language selection
  if (!options.language) {
    questions.push({
      type: 'list',
      name: 'language',
      message: 'What language is your application written in?',
      choices: [
        { name: 'TypeScript/Node.js', value: 'typescript' },
        { name: 'Python', value: 'python' }
      ],
      default: 'typescript'
    });
  }

  // Service options
  if (!Object.prototype.hasOwnProperty.call(options, 'database')) {
    questions.push({
      type: 'confirm',
      name: 'database',
      message: 'Does your application need a database?',
      default: false
    });
  }

  if (!Object.prototype.hasOwnProperty.call(options, 'redis')) {
    questions.push({
      type: 'confirm',
      name: 'redis',
      message: 'Does your application need Redis?',
      default: false
    });
  }

  if (!Object.prototype.hasOwnProperty.call(options, 'storage')) {
    questions.push({
      type: 'confirm',
      name: 'storage',
      message: 'Does your application need file storage?',
      default: false
    });
  }

  if (!Object.prototype.hasOwnProperty.call(options, 'authentication')) {
    questions.push({
      type: 'confirm',
      name: 'authentication',
      message: 'Does your application need authentication/RBAC?',
      default: false
    });
  }

  // Prompt for missing options
  const answers = questions.length > 0 ? await inquirer.prompt(questions) : {};

  // Merge provided options with answers
  return {
    appName,
    port: parseInt(options.port || answers.port || 3000, 10),
    language: options.language || answers.language || 'typescript',
    database: options.database || answers.database || false,
    redis: options.redis || answers.redis || false,
    storage: options.storage || answers.storage || false,
    authentication: options.authentication || answers.authentication || false
  };
}

/**
 * Generate all configuration files for the application
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} existingEnv - Existing environment variables
 */
async function generateConfigFiles(appPath, appName, config, existingEnv) {
  try {
    // Generate variables.yaml
    const variablesYaml = generateVariablesYaml(appName, config);
    await fs.writeFile(path.join(appPath, 'variables.yaml'), variablesYaml);

    // Generate env.template
    let envTemplate;
    if (existingEnv) {
      const envResult = await generateEnvTemplateFromReader(config, existingEnv);
      envTemplate = envResult.template;

      if (envResult.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Environment conversion warnings:'));
        envResult.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
      }
    } else {
      envTemplate = generateEnvTemplate(config);
    }
    await fs.writeFile(path.join(appPath, 'env.template'), envTemplate);

    // Generate rbac.yaml if authentication is enabled
    if (config.authentication) {
      const rbacYaml = generateRbacYaml(appName, config);
      if (rbacYaml) {
        await fs.writeFile(path.join(appPath, 'rbac.yaml'), rbacYaml);
      }
    }

    // Generate aifabrix-deploy.json template
    const deployJson = {
      apiVersion: 'v1',
      kind: 'ApplicationDeployment',
      metadata: {
        name: appName,
        namespace: 'default'
      },
      spec: {
        application: {
          name: appName,
          version: '1.0.0',
          language: config.language,
          port: config.port
        },
        services: {
          database: config.database,
          redis: config.redis,
          storage: config.storage,
          authentication: config.authentication
        },
        deployment: {
          replicas: 1,
          strategy: 'RollingUpdate'
        }
      }
    };

    await fs.writeFile(
      path.join(appPath, 'aifabrix-deploy.json'),
      JSON.stringify(deployJson, null, 2)
    );

  } catch (error) {
    throw new Error(`Failed to generate configuration files: ${error.message}`);
  }
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
 * @param {string} [options.template] - Template to use (platform for Keycloak/Miso)
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

    // Prompt for missing options
    const config = await promptForOptions(appName, options);

    // Create directory structure
    await fs.mkdir(appPath, { recursive: true });

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
      const workflowFiles = await githubGen.generateGithubWorkflows(
        process.cwd(),
        config,
        {
          mainBranch: options.mainBranch || 'main',
          uploadCoverage: true,
          publishToNpm: options.template === 'platform'
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
 * Pushes application image to Azure Container Registry
 * @async
 * @function pushApp
 * @param {string} appName - Name of the application
 * @param {Object} options - Push options (registry, tag)
 * @returns {Promise<void>} Resolves when push is complete
 */
async function pushApp(appName, options = {}) {
  try {
    // Validate app name
    validateAppName(appName);

    const configPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
    let config;
    try {
      config = yaml.load(await fs.readFile(configPath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to load configuration: ${configPath}\nRun 'aifabrix create ${appName}' first`);
    }

    const registry = options.registry || config.image?.registry;
    if (!registry) {
      throw new Error('Registry URL is required. Provide via --registry flag or configure in variables.yaml under image.registry');
    }

    if (!pushUtils.validateRegistryURL(registry)) {
      throw new Error(`Invalid registry URL format: ${registry}. Expected format: *.azurecr.io`);
    }

    const tags = options.tag ? options.tag.split(',').map(t => t.trim()) : ['latest'];

    if (!await pushUtils.checkLocalImageExists(appName, 'latest')) {
      throw new Error(`Docker image ${appName}:latest not found locally.\nRun 'aifabrix build ${appName}' first`);
    }

    if (!await pushUtils.checkAzureCLIInstalled()) {
      throw new Error('Azure CLI is not installed. Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
    }

    if (await pushUtils.checkACRAuthentication(registry)) {
      console.log(chalk.green(`✓ Already authenticated with ${registry}`));
    } else {
      await pushUtils.authenticateACR(registry);
    }

    await Promise.all(tags.map(async(tag) => {
      await pushUtils.tagImage(`${appName}:latest`, `${registry}/${appName}:${tag}`);
      await pushUtils.pushImage(`${registry}/${appName}:${tag}`);
    }));

    console.log(chalk.green(`\n✓ Successfully pushed ${tags.length} tag(s) to ${registry}`));
    console.log(chalk.gray(`Image: ${registry}/${appName}:*`));
    console.log(chalk.gray(`Tags: ${tags.join(', ')}`));

  } catch (error) {
    throw new Error(`Failed to push application: ${error.message}`);
  }
}

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
  pushApp,
  deployApp,
  checkImageExists: appRun.checkImageExists,
  checkContainerRunning: appRun.checkContainerRunning,
  stopAndRemoveContainer: appRun.stopAndRemoveContainer,
  checkPortAvailable: appRun.checkPortAvailable,
  generateDockerCompose: appRun.generateDockerCompose,
  waitForHealthCheck: appRun.waitForHealthCheck
};
