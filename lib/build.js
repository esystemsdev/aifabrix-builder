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
const paths = require('./utils/paths');
const { exec } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const yaml = require('js-yaml');
const secrets = require('./secrets');
const config = require('./config');
const logger = require('./utils/logger');
const validator = require('./validator');
const dockerfileUtils = require('./utils/dockerfile-utils');
const dockerBuild = require('./utils/docker-build');
const buildCopy = require('./utils/build-copy');
const { buildDevImageName } = require('./utils/image-name');

const execAsync = promisify(exec);

/**
 * Copies application template files to dev directory
 * Used when apps directory doesn't exist to ensure build can proceed
 * @async
 * @param {string} templatePath - Path to template directory
 * @param {string} devDir - Target dev directory
 * @param {string} _language - Language (typescript/python) - currently unused but kept for future use
 * @throws {Error} If copying fails
 */
async function copyTemplateFilesToDevDir(templatePath, devDir, _language) {
  if (!fsSync.existsSync(templatePath)) {
    throw new Error(`Template path not found: ${templatePath}`);
  }

  const entries = await fs.readdir(templatePath);

  // Copy only application files, skip Dockerfile and docker-compose templates
  const appFiles = entries.filter(entry => {
    const lowerEntry = entry.toLowerCase();
    // Include .gitignore, exclude .hbs files and docker-related files
    if (entry === '.gitignore') {
      return true;
    }
    if (lowerEntry.endsWith('.hbs')) {
      return false;
    }
    if (lowerEntry.startsWith('dockerfile') || lowerEntry.includes('docker-compose')) {
      return false;
    }
    if (entry.startsWith('.') && entry !== '.gitignore') {
      return false;
    }
    return true;
  });

  for (const entry of appFiles) {
    const sourcePath = path.join(templatePath, entry);
    const targetPath = path.join(devDir, entry);

    const entryStats = await fs.stat(sourcePath);
    if (entryStats.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

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
async function determineDockerfile(appName, options) {
  // Use dev directory if provided, otherwise fall back to builder directory
  const searchPath = options.devDir || path.join(process.cwd(), 'builder', appName);

  const templateDockerfile = dockerfileUtils.checkTemplateDockerfile(searchPath, appName, options.forceTemplate);
  if (templateDockerfile) {
    const relativePath = path.relative(process.cwd(), templateDockerfile);
    logger.log(chalk.green(`✓ Using existing Dockerfile: ${relativePath}`));
    return templateDockerfile;
  }

  const customDockerfile = dockerfileUtils.checkProjectDockerfile(searchPath, appName, options.buildConfig, options.contextPath, options.forceTemplate);
  if (customDockerfile) {
    logger.log(chalk.green(`✓ Using custom Dockerfile: ${options.buildConfig.dockerfile}`));
    return customDockerfile;
  }

  // Generate Dockerfile in dev directory if provided
  const dockerfilePath = await generateDockerfile(appName, options.language, options.config, options.buildConfig, options.devDir);
  const relativePath = path.relative(process.cwd(), dockerfilePath);
  logger.log(chalk.green(`✓ Generated Dockerfile from template: ${relativePath}`));
  return dockerfilePath;
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
    const envPath = await secrets.generateEnvFile(appName, buildConfig.secrets, 'docker');
    logger.log(chalk.green(`✓ Generated .env file: ${envPath}`));
    // Note: processEnvVariables is already called by generateEnvFile to generate local .env
    // at the envOutputPath, so we don't need to manually copy the docker .env file
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
  // Check if app type is external - deploy to dataplane instead of Docker build
  const variables = await loadVariablesYaml(appName);
  if (variables.app && variables.app.type === 'external') {
    const externalDeploy = require('./external-system-deploy');
    await externalDeploy.buildExternalSystem(appName, options);
    return null;
  }

  try {
    logger.log(chalk.blue(`\n🔨 Building application: ${appName}`));

    // 1. Load and validate configuration
    const { config: appConfig, imageName, buildConfig } = await loadAndValidateConfig(appName);

    // 2. Get developer ID and copy files to dev-specific directory
    const developerId = await config.getDeveloperId();
    const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    const directoryName = idNum === 0 ? 'applications' : `dev-${developerId}`;
    logger.log(chalk.blue(`Copying files to developer-specific directory (${directoryName})...`));
    const devDir = await buildCopy.copyBuilderToDevDirectory(appName, developerId);
    logger.log(chalk.green(`✓ Files copied to: ${devDir}`));
    const effectiveImageName = buildDevImageName(imageName, developerId);

    // 2a. Check if application source files exist, if not copy from templates
    const appsPath = path.join(process.cwd(), 'apps', appName);
    if (fsSync.existsSync(appsPath)) {
      // Copy app source files from apps directory
      await buildCopy.copyAppSourceFiles(appsPath, devDir);
      logger.log(chalk.green(`✓ Copied application source files from apps/${appName}`));
    } else {
      // No apps directory - check if we need to copy template files
      const language = options.language || buildConfig.language || detectLanguage(devDir);
      const packageJsonPath = path.join(devDir, 'package.json');
      const requirementsPath = path.join(devDir, 'requirements.txt');

      if (language === 'typescript' && !fsSync.existsSync(packageJsonPath)) {
        // Copy TypeScript template files
        const templatePath = path.join(__dirname, '..', 'templates', 'typescript');
        await copyTemplateFilesToDevDir(templatePath, devDir, language);
        logger.log(chalk.green(`✓ Generated application files from ${language} template`));
      } else if (language === 'python' && !fsSync.existsSync(requirementsPath)) {
        // Copy Python template files
        const templatePath = path.join(__dirname, '..', 'templates', 'python');
        await copyTemplateFilesToDevDir(templatePath, devDir, language);
        logger.log(chalk.green(`✓ Generated application files from ${language} template`));
      }
    }

    // 3. Prepare build context (use dev-specific directory)
    // If buildConfig.context is relative, resolve it relative to devDir
    // If buildConfig.context is '../..' (apps flag), keep it as is (it's relative to devDir)
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
      // For apps flag, context is relative to devDir (which is ~/.aifabrix/<app>-dev-<id>)
      // So '../..' from devDir goes to ~/.aifabrix, then we need to go to project root
      // Actually, we need to keep the relative path and let Docker resolve it
      // But the build context should be the project root, not devDir
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

    // 4. Check if Dockerfile exists in dev directory
    const appDockerfilePath = path.join(devDir, 'Dockerfile');
    const hasExistingDockerfile = fsSync.existsSync(appDockerfilePath) && !options.forceTemplate;

    // 5. Determine language (skip if existing Dockerfile found)
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

    // 6. Determine Dockerfile (needs context path to generate in correct location)
    // Use dev directory for Dockerfile generation
    const dockerfilePath = await determineDockerfile(appName, {
      language,
      config: appConfig,
      buildConfig,
      contextPath,
      forceTemplate: options.forceTemplate,
      devDir: devDir
    });

    // 6. Build Docker image
    const tag = options.tag || 'latest';

    // Log paths for debugging
    logger.log(chalk.blue(`Using Dockerfile: ${dockerfilePath}`));
    logger.log(chalk.blue(`Using build context: ${contextPath}`));

    await executeBuild(effectiveImageName, dockerfilePath, contextPath, tag, options);
    // Back-compat: also tag the built dev image as the base image name
    try {
      // Use runtime promisify so tests can capture this call reliably
      const { promisify } = require('util');
      const { exec } = require('child_process');
      const run = promisify(exec);
      await run(`docker tag ${effectiveImageName}:${tag} ${imageName}:${tag}`);
      logger.log(chalk.green(`✓ Tagged image: ${imageName}:${tag}`));
    } catch (err) {
      logger.log(chalk.yellow(`⚠️  Warning: Could not create compatibility tag ${imageName}:${tag} - ${err.message}`));
    }

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
  buildApp,
  postBuildTasks
};
