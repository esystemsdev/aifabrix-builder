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
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const yaml = require('js-yaml');
const secrets = require('./secrets');
const logger = require('./utils/logger');
const validator = require('./validator');
const dockerfileUtils = require('./utils/dockerfile-utils');
const dockerBuild = require('./utils/docker-build');

const execAsync = promisify(exec);

/**
 * Loads variables.yaml configuration for an application
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Configuration object
 * @throws {Error} If file cannot be loaded or parsed
 */
async function loadVariablesYaml(appName) {
  const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');

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
  const dockerfilePath = path.join(appPath, 'Dockerfile');

  // Check for package.json (TypeScript/Node.js)
  if (fsSync.existsSync(packageJsonPath)) {
    return 'typescript';
  }

  // Check for requirements.txt or pyproject.toml (Python)
  if (fsSync.existsSync(requirementsPath) || fsSync.existsSync(pyprojectPath)) {
    return 'python';
  }

  // Check for custom Dockerfile
  if (fsSync.existsSync(dockerfilePath)) {
    throw new Error('Custom Dockerfile found. Use --force-template to regenerate from template.');
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
async function generateDockerfile(appNameOrPath, language, config, buildConfig = {}) {
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

  const aifabrixDir = path.join(os.homedir(), '.aifabrix', appName);
  if (!fsSync.existsSync(aifabrixDir)) {
    await fs.mkdir(aifabrixDir, { recursive: true });
  }

  const dockerfilePath = path.join(aifabrixDir, `Dockerfile.${language}`);
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
async function determineDockerfile(appName, options) {
  const builderPath = path.join(process.cwd(), 'builder', appName);

  const templateDockerfile = dockerfileUtils.checkTemplateDockerfile(builderPath, appName, options.forceTemplate);
  if (templateDockerfile) {
    logger.log(chalk.green(`✓ Using existing Dockerfile: builder/${appName}/Dockerfile`));
    return templateDockerfile;
  }

  const customDockerfile = dockerfileUtils.checkProjectDockerfile(builderPath, appName, options.buildConfig, options.contextPath, options.forceTemplate);
  if (customDockerfile) {
    logger.log(chalk.green(`✓ Using custom Dockerfile: ${options.buildConfig.dockerfile}`));
    return customDockerfile;
  }

  const dockerfilePath = await generateDockerfile(appName, options.language, options.config, options.buildConfig);
  const relativePath = path.relative(process.cwd(), dockerfilePath);
  logger.log(chalk.green(`✓ Generated Dockerfile from template: ${relativePath}`));
  return dockerfilePath;
}

/**
 * Prepares build context path
 * @param {string} appName - Application name
 * @param {string} contextPath - Relative context path
 * @returns {string} Absolute context path
 */
function prepareBuildContext(appName, contextPath) {
  // Ensure contextPath is a string
  const context = typeof contextPath === 'string' ? contextPath : (contextPath || '');
  return resolveContextPath(
    path.join(process.cwd(), 'builder', appName),
    context
  );
}

/**
 * Loads and validates configuration for build
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Configuration object with config, imageName, and buildConfig
 * @throws {Error} If configuration cannot be loaded or validated
 */
async function loadAndValidateConfig(appName) {
  const variables = await loadVariablesYaml(appName);

  // Validate configuration
  const validation = await validator.validateVariables(appName);
  if (!validation.valid) {
    throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
  }

  // Extract image name
  let imageName;
  if (typeof variables.image === 'string') {
    imageName = variables.image.split(':')[0];
  } else if (variables.image?.name) {
    imageName = variables.image.name;
  } else if (variables.app?.key) {
    imageName = variables.app.key;
  } else {
    imageName = appName;
  }

  // Extract build config
  const buildConfig = variables.build || {};

  return {
    config: variables,
    imageName,
    buildConfig
  };
}

/**
 * Executes Docker build and handles tagging
 * @async
 * @param {string} imageName - Image name
 * @param {string} dockerfilePath - Path to Dockerfile
 * @param {string} contextPath - Build context path
 * @param {string} tag - Image tag
 * @param {Object} options - Build options
 */
async function executeBuild(imageName, dockerfilePath, contextPath, tag, options) {
  await dockerBuild.executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

  // Tag image if additional tag provided
  if (options.tag && options.tag !== 'latest') {
    await execAsync(`docker tag ${imageName}:${tag} ${imageName}:latest`);
    logger.log(chalk.green(`✓ Tagged image: ${imageName}:latest`));
  }
}

async function postBuildTasks(appName, buildConfig) {
  try {
    const envPath = await secrets.generateEnvFile(appName, buildConfig.secrets);
    logger.log(chalk.green(`✓ Generated .env file: ${envPath}`));
    if (buildConfig.envOutputPath) {
      const builderPath = path.join(process.cwd(), 'builder', appName);
      const outputPath = path.resolve(builderPath, buildConfig.envOutputPath);
      const outputDir = path.dirname(outputPath);
      if (!fsSync.existsSync(outputDir)) {
        await fs.mkdir(outputDir, { recursive: true });
      }
      await fs.copyFile(envPath, outputPath);
      logger.log(chalk.green(`✓ Copied .env to: ${buildConfig.envOutputPath}`));
    }
  } catch (error) {
    logger.log(chalk.yellow(`⚠️  Warning: Could not generate .env file: ${error.message}`));
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
  try {
    logger.log(chalk.blue(`\n🔨 Building application: ${appName}`));

    // 1. Load and validate configuration
    const { config, imageName, buildConfig } = await loadAndValidateConfig(appName);

    // 2. Prepare build context
    const contextPath = prepareBuildContext(appName, buildConfig.context);

    // 3. Check if Dockerfile exists in builder/{appName}/ directory
    const builderPath = path.join(process.cwd(), 'builder', appName);
    const appDockerfilePath = path.join(builderPath, 'Dockerfile');
    const hasExistingDockerfile = fsSync.existsSync(appDockerfilePath) && !options.forceTemplate;

    // 4. Determine language (skip if existing Dockerfile found)
    let language = options.language || buildConfig.language;
    if (!language && !hasExistingDockerfile) {
      language = detectLanguage(builderPath);
    } else if (!language) {
      // Default language if existing Dockerfile is found (won't be used, but needed for API)
      language = 'typescript';
    }
    if (!hasExistingDockerfile) {
      logger.log(chalk.green(`✓ Detected language: ${language}`));
    }

    // 5. Determine Dockerfile (needs context path to generate in correct location)
    const dockerfilePath = await determineDockerfile(appName, {
      language,
      config,
      buildConfig,
      contextPath,
      forceTemplate: options.forceTemplate
    });

    // 6. Build Docker image
    const tag = options.tag || 'latest';
    await executeBuild(imageName, dockerfilePath, contextPath, tag, options);

    // 7. Post-build tasks
    await postBuildTasks(appName, buildConfig);

    logger.log(chalk.green('\n✅ Build completed successfully!'));
    return `${imageName}:${tag}`;

  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }
}

module.exports = {
  loadVariablesYaml,
  resolveContextPath,
  executeDockerBuild: dockerBuild.executeDockerBuild,
  detectLanguage,
  generateDockerfile,
  buildApp
};
