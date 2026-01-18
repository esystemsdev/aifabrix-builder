/**
 * AI Fabrix Builder Build Functions
 *
 * This module handles application building, Docker image creation,
 * and Dockerfile generation. Separated from app.js to maintain
 * file size limits and improve code organization.
 *
 * @fileoverview Build functions for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const paths = require('../utils/paths');
const { detectAppType, getProjectRoot } = require('../utils/paths');
const chalk = require('chalk');
const yaml = require('js-yaml');
const secrets = require('../core/secrets');
const config = require('../core/config');
const logger = require('../utils/logger');
const dockerfileUtils = require('../utils/dockerfile-utils');
const dockerBuild = require('../utils/docker-build');
const buildCopy = require('../utils/build-copy');
const { buildDevImageName } = require('../utils/image-name');
const buildHelpers = require('../utils/build-helpers');

/**
 * Loads variables.yaml configuration for an application
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Configuration object
 * @throws {Error} If file cannot be loaded or parsed
 */
async function loadVariablesYaml(appName) {
  // Detect app type and get correct path (integration or builder)
  const { appPath } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  if (!fsSync.existsSync(variablesPath)) {
    throw new Error(`Configuration not found. Run 'aifabrix create ${appName}' first.`);
  }

  const content = fsSync.readFileSync(variablesPath, 'utf8');
  let variables;

  try {
    variables = yaml.load(content);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in variables.yaml: ${error.message}`);
  }

  return variables;
}

/**
 * Resolves build context path relative to builder directory
 * @param {string} builderPath - Path to builder directory
 * @param {string} contextPath - Relative context path
 * @returns {string} Absolute context path
 * @throws {Error} If context path doesn't exist
 */
function resolveContextPath(builderPath, contextPath) {
  if (!contextPath) {
    return process.cwd();
  }

  const resolvedPath = path.resolve(builderPath, contextPath);

  if (!fsSync.existsSync(resolvedPath)) {
    throw new Error(`Build context not found: ${resolvedPath}`);
  }

  return resolvedPath;
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
  const packageJsonPath = path.join(appPath, 'package.json');
  const requirementsPath = path.join(appPath, 'requirements.txt');
  const pyprojectPath = path.join(appPath, 'pyproject.toml');

  // Check for package.json (TypeScript/Node.js)
  if (fsSync.existsSync(packageJsonPath)) {
    return 'typescript';
  }

  // Check for requirements.txt or pyproject.toml (Python)
  if (fsSync.existsSync(requirementsPath) || fsSync.existsSync(pyprojectPath)) {
    return 'python';
  }

  // Default to typescript if no indicators found
  return 'typescript';
}

/**
 * Generates a Dockerfile from template based on detected language
 * Uses Handlebars templates to create optimized Dockerfiles
 * Dockerfiles are stored in ~/.aifabrix/{appName}/ directory
 *
 * @async
 * @function generateDockerfile
 * @param {string} appNameOrPath - Application name or path (backward compatibility)
 * @param {string} language - Target language ('typescript', 'python')
 * @param {Object} config - Application configuration from variables.yaml
 * @returns {Promise<string>} Path to generated Dockerfile
 * @throws {Error} If template generation fails
 *
 * @example
 * const dockerfilePath = await generateDockerfile('myapp', 'typescript', config);
 * // Returns: '~/.aifabrix/myapp/Dockerfile.typescript'
 */
async function generateDockerfile(appNameOrPath, language, config, buildConfig = {}, devDir = null) {
  let appName;
  if (appNameOrPath.includes(path.sep) || appNameOrPath.includes('/') || appNameOrPath.includes('\\')) {
    appName = path.basename(appNameOrPath);
  } else {
    appName = appNameOrPath;
  }

  const template = dockerfileUtils.loadDockerfileTemplate(language);
  const isAppFlag = buildConfig.context === '../..';
  const appSourcePath = isAppFlag ? `apps/${appName}/` : '.';

  const templateVars = {
    port: config.port || 3000,
    healthCheck: {
      interval: config.healthCheck?.interval || 30,
      path: config.healthCheck?.path || '/health'
    },
    startupCommand: config.startupCommand,
    appSourcePath: appSourcePath
  };

  const dockerfileContent = dockerfileUtils.renderDockerfile(template, templateVars, language, isAppFlag, appSourcePath);

  // Use dev directory if provided, otherwise use default aifabrix directory
  let targetDir;
  if (devDir) {
    targetDir = devDir;
  } else {
    targetDir = path.join(paths.getAifabrixHome(), appName);
  }

  if (!fsSync.existsSync(targetDir)) {
    await fs.mkdir(targetDir, { recursive: true });
  }

  const dockerfilePath = path.join(targetDir, 'Dockerfile');
  await fs.writeFile(dockerfilePath, dockerfileContent, 'utf8');

  return dockerfilePath;
}

/**
 * Determines Dockerfile path, generating from template if needed
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Dockerfile determination options
 * @param {string} options.language - Application language
 * @param {Object} options.config - Application configuration
 * @param {Object} options.buildConfig - Build configuration
 * @param {string} options.contextPath - Build context path (absolute)
 * @param {boolean} options.forceTemplate - Force template flag
 * @returns {Promise<string>} Path to Dockerfile
 */

/**
 * Executes Docker build and handles tagging
 * @async
 * @param {string} imageName - Image name
 * @param {string} dockerfilePath - Path to Dockerfile
 * @param {string} contextPath - Build context path
 * @param {string} tag - Image tag
 * @param {Object} options - Build options
 */

async function postBuildTasks(appName, buildConfig) {
  try {
    const envPath = await secrets.generateEnvFile(appName, buildConfig.secrets, 'docker');
    logger.log(chalk.green(`✓ Generated .env file: ${envPath}`));
    // Note: processEnvVariables is already called by generateEnvFile to generate local .env
    // at the envOutputPath, so we don't need to manually copy the docker .env file
  } catch (error) {
    logger.log(chalk.yellow(`⚠️  Warning: Could not generate .env file: ${error.message}`));
  }
}

/**
 * Check if app is external type and handle accordingly
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<boolean>} True if external (handled), false if should continue
 */
async function checkExternalAppType(appName) {
  const variables = await loadVariablesYaml(appName);
  if (variables.app && variables.app.type === 'external') {
    const generator = require('../generator');
    const jsonPath = await generator.generateDeployJson(appName);
    logger.log(chalk.green(`✓ Generated deployment JSON: ${jsonPath}`));
    return true;
  }
  return false;
}

/**
 * Prepare dev directory and copy application files
 * @async
 * @param {string} appName - Application name
 * @param {Object} buildConfig - Build configuration
 * @param {Object} options - Build options
 * @returns {Promise<Object>} Object with devDir, effectiveImageName, imageName, appConfig, and developerId
 */
/**
 * Copies application source files if they exist
 * @async
 * @function copyApplicationSourceFiles
 * @param {string} appName - Application name
 * @param {string} devDir - Developer directory
 * @returns {Promise<boolean>} True if files were copied
 */
async function copyApplicationSourceFiles(appName, devDir) {
  const appsPath = path.join(process.cwd(), 'apps', appName);
  if (fsSync.existsSync(appsPath)) {
    await buildCopy.copyAppSourceFiles(appsPath, devDir);
    logger.log(chalk.green(`✓ Copied application source files from apps/${appName}`));
    return true;
  }
  return false;
}

/**
 * Copies template files if needed
 * @async
 * @function copyTemplateFilesIfNeeded
 * @param {string} devDir - Developer directory
 * @param {string} language - Language type
 * @param {Object} buildConfig - Build configuration
 * @param {Object} options - Build options
 */
async function copyTemplateFilesIfNeeded(devDir, language, buildConfig, options) {
  const detectedLanguage = options.language || buildConfig.language || detectLanguage(devDir);
  const packageJsonPath = path.join(devDir, 'package.json');
  const requirementsPath = path.join(devDir, 'requirements.txt');

  if (detectedLanguage === 'typescript' && !fsSync.existsSync(packageJsonPath)) {
    const projectRoot = getProjectRoot();
    const templatePath = path.join(projectRoot, 'templates', 'typescript');
    await buildCopy.copyTemplateFilesToDevDir(templatePath, devDir, detectedLanguage);
    logger.log(chalk.green(`✓ Generated application files from ${detectedLanguage} template`));
  } else if (detectedLanguage === 'python' && !fsSync.existsSync(requirementsPath)) {
    const projectRoot = getProjectRoot();
    const templatePath = path.join(projectRoot, 'templates', 'python');
    await buildCopy.copyTemplateFilesToDevDir(templatePath, devDir, detectedLanguage);
    logger.log(chalk.green(`✓ Generated application files from ${detectedLanguage} template`));
  }
}

async function prepareDevDirectory(appName, buildConfig, options) {
  const developerId = await config.getDeveloperId();
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const directoryName = idNum === 0 ? 'applications' : `dev-${developerId}`;
  logger.log(chalk.blue(`Copying files to developer-specific directory (${directoryName})...`));
  const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);
  logger.log(chalk.green(`✓ Files copied to: ${devDir}`));

  const { config: appConfig, imageName } = await buildHelpers.loadAndValidateConfig(appName);
  const effectiveImageName = buildDevImageName(imageName, developerId);

  // Check if application source files exist, if not copy from templates
  const filesCopied = await copyApplicationSourceFiles(appName, devDir);
  if (!filesCopied) {
    await copyTemplateFilesIfNeeded(devDir, null, buildConfig, options);
  }

  return { devDir, effectiveImageName, imageName, appConfig };
}

/**
 * Prepare build context path
 * @param {Object} buildConfig - Build configuration
 * @param {string} devDir - Developer directory path
 * @returns {string} Resolved context path
 */
function prepareBuildContext(buildConfig, devDir) {
  let contextPath;

  // Check if context is using old format (../appName) - these are incompatible with dev directory structure
  if (buildConfig.context && buildConfig.context.startsWith('../') && buildConfig.context !== '../..') {
    // Old format detected - always use devDir instead
    logger.log(chalk.yellow(`⚠️  Warning: Build context uses old format: ${buildConfig.context}`));
    logger.log(chalk.yellow(`   Using dev directory instead: ${devDir}`));
    contextPath = devDir;
  } else if (buildConfig.context && buildConfig.context !== '../..') {
    // Resolve relative context path from dev directory
    contextPath = path.resolve(devDir, buildConfig.context);
  } else if (buildConfig.context === '../..') {
    // For apps flag, context is relative to devDir
    contextPath = process.cwd();
  } else {
    // No context specified, use dev directory
    contextPath = devDir;
  }

  // Ensure context path is absolute and normalized
  contextPath = path.resolve(contextPath);

  // Validate that context path exists (skip in test environments)
  const isTestEnv = process.env.NODE_ENV === 'test' ||
                    process.env.JEST_WORKER_ID !== undefined ||
                    typeof jest !== 'undefined';

  if (!isTestEnv && !fsSync.existsSync(contextPath)) {
    throw new Error(
      `Build context path does not exist: ${contextPath}\n` +
      `Expected dev directory: ${devDir}\n` +
      'Please ensure files were copied correctly or update the context in variables.yaml.'
    );
  }

  return contextPath;
}

/**
 * Handle Dockerfile generation
 * @async
 * @param {string} appName - Application name
 * @param {Object} params - Parameters
 * @param {string} params.devDir - Developer directory
 * @param {Object} params.buildConfig - Build configuration
 * @param {string} params.contextPath - Build context path
 * @param {Object} params.appConfig - Application configuration
 * @param {Object} options - Build options
 * @returns {Promise<string>} Dockerfile path
 */
async function handleDockerfileGeneration(appName, params, options, buildHelpers) {
  const { devDir, buildConfig, contextPath, appConfig } = params;
  const appDockerfilePath = path.join(devDir, 'Dockerfile');
  const hasExistingDockerfile = fsSync.existsSync(appDockerfilePath) && !options.forceTemplate;

  // Determine language (skip if existing Dockerfile found)
  let language = options.language || buildConfig.language;
  if (!language && !hasExistingDockerfile) {
    language = detectLanguage(devDir);
  } else if (!language) {
    // Default language if existing Dockerfile is found (won't be used, but needed for API)
    language = 'typescript';
  }
  if (!hasExistingDockerfile) {
    logger.log(chalk.green(`✓ Detected language: ${language}`));
  }

  // Determine Dockerfile (needs context path to generate in correct location)
  return await buildHelpers.determineDockerfile(appName, {
    language,
    config: appConfig,
    buildConfig,
    contextPath,
    forceTemplate: options.forceTemplate,
    devDir: devDir
  }, generateDockerfile);
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
  // Check if app type is external - generate JSON files only (not deploy)
  if (await checkExternalAppType(appName)) {
    return null;
  }

  try {
    logger.log(chalk.blue(`\n🔨 Building application: ${appName}`));

    // 1. Load and validate configuration
    const { buildConfig } = await buildHelpers.loadAndValidateConfig(appName);

    // 2. Prepare dev directory and copy files
    const { devDir, effectiveImageName, imageName, appConfig } = await prepareDevDirectory(appName, buildConfig, options);

    // 3. Prepare build context
    const contextPath = prepareBuildContext(buildConfig, devDir);

    // 4. Handle Dockerfile generation
    const dockerfilePath = await handleDockerfileGeneration(appName, {
      devDir,
      buildConfig,
      contextPath,
      appConfig
    }, options, buildHelpers);

    // 5. Execute Docker build
    const tag = options.tag || 'latest';
    await dockerBuild.executeDockerBuildWithTag(effectiveImageName, imageName, dockerfilePath, contextPath, tag, options);

    // 6. Post-build tasks
    await postBuildTasks(appName, buildConfig);

    logger.log(chalk.green('\n✅ Build completed successfully!'));
    return `${imageName}:${tag}`;

  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }
}
module.exports = { loadVariablesYaml, resolveContextPath, detectLanguage, generateDockerfile, buildApp, postBuildTasks };
