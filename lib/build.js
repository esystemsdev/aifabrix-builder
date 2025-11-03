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
const { exec } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const yaml = require('js-yaml');
const handlebars = require('handlebars');
const validator = require('./validator');
const secrets = require('./secrets');
const logger = require('./utils/logger');

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
 * Executes Docker build command with proper error handling
 * @param {string} imageName - Image name to build
 * @param {string} dockerfilePath - Path to Dockerfile
 * @param {string} contextPath - Build context path
 * @param {string} tag - Image tag
 * @returns {Promise<void>} Resolves when build completes
 * @throws {Error} If build fails
 */
async function executeDockerBuild(imageName, dockerfilePath, contextPath, tag) {
  const dockerCommand = `docker build -t ${imageName}:${tag} -f "${dockerfilePath}" "${contextPath}"`;

  try {
    logger.log(chalk.blue('Building image...'));
    logger.log(chalk.gray(`Command: ${dockerCommand}`));

    const { stdout, stderr } = await execAsync(dockerCommand);

    if (stderr && !stderr.includes('warning')) {
      logger.log(chalk.yellow(stderr));
    }

    if (stdout) {
      logger.log(stdout);
    }

    logger.log(chalk.green(`✓ Image built: ${imageName}:${tag}`));
  } catch (error) {
    if (error.message.includes('docker: command not found')) {
      throw new Error('Docker is not running or not installed. Please start Docker Desktop.');
    }

    throw new Error(`Docker build failed: ${error.message}`);
  }
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
  const templatePath = path.join(__dirname, '..', 'templates', language, 'Dockerfile.hbs');

  if (!fsSync.existsSync(templatePath)) {
    throw new Error(`Template not found for language: ${language}`);
  }

  const templateContent = fsSync.readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(templateContent);

  // Prepare template variables
  const templateVars = {
    port: config.port || 3000,
    healthCheck: {
      interval: config.healthCheck?.interval || 30,
      path: config.healthCheck?.path || '/health'
    },
    startupCommand: config.startupCommand
  };

  const dockerfileContent = template(templateVars);

  // Create .aifabrix directory if it doesn't exist
  const aifabrixDir = path.join(appPath, '.aifabrix');
  if (!fsSync.existsSync(aifabrixDir)) {
    await fs.mkdir(aifabrixDir, { recursive: true });
  }

  const dockerfilePath = path.join(aifabrixDir, `Dockerfile.${language}`);
  await fs.writeFile(dockerfilePath, dockerfileContent);

  return dockerfilePath;
}

/**
 * Loads and validates application configuration
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Configuration object with imageName and buildConfig
 * @throws {Error} If configuration is invalid
 */
async function loadAndValidateConfig(appName) {
  const config = await loadVariablesYaml(appName);
  logger.log(chalk.green(`✓ Loaded configuration from builder/${appName}/variables.yaml`));

  // Validate configuration
  const validation = await validator.validateVariables(appName);
  if (!validation.valid) {
    logger.log(chalk.red('❌ Configuration validation failed:'));
    validation.errors.forEach(error => logger.log(chalk.red(`  - ${error}`)));
    throw new Error('Configuration validation failed');
  }

  // Extract configuration values
  const imageName = config.image?.split(':')[0] || appName;
  const buildConfig = config.build || {};

  return { config, imageName, buildConfig };
}

/**
 * Determines Dockerfile path, generating from template if needed
 * @async
 * @param {string} appName - Application name
 * @param {string} language - Application language
 * @param {Object} config - Application configuration
 * @param {Object} buildConfig - Build configuration
 * @param {Object} options - Build options
 * @returns {Promise<string>} Path to Dockerfile
 */
async function determineDockerfile(appName, language, config, buildConfig, options) {
  let dockerfilePath;
  const customDockerfile = buildConfig.dockerfile;

  if (customDockerfile && !options.forceTemplate) {
    const customPath = path.join(process.cwd(), 'builder', appName, customDockerfile);
    if (fsSync.existsSync(customPath)) {
      dockerfilePath = customPath;
      logger.log(chalk.green(`✓ Using custom Dockerfile: ${customDockerfile}`));
    }
  }

  if (!dockerfilePath || options.forceTemplate) {
    // Generate Dockerfile from template
    const builderPath = path.join(process.cwd(), 'builder', appName);
    dockerfilePath = await generateDockerfile(builderPath, language, config);
    logger.log(chalk.green(`✓ Generated Dockerfile from template: .aifabrix/Dockerfile.${language}`));
  }

  return dockerfilePath;
}

/**
 * Prepares build context path
 * @param {string} appName - Application name
 * @param {string} contextPath - Relative context path
 * @returns {string} Absolute context path
 */
function prepareBuildContext(appName, contextPath) {
  return resolveContextPath(
    path.join(process.cwd(), 'builder', appName),
    contextPath
  );
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
  await executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

  // Tag image if additional tag provided
  if (options.tag && options.tag !== 'latest') {
    await execAsync(`docker tag ${imageName}:${tag} ${imageName}:latest`);
    logger.log(chalk.green(`✓ Tagged image: ${imageName}:latest`));
  }
}

/**
 * Handles post-build tasks like .env file generation
 * @async
 * @param {string} appName - Application name
 * @param {Object} buildConfig - Build configuration
 */
async function postBuildTasks(appName, buildConfig) {
  try {
    const envPath = await secrets.generateEnvFile(appName, buildConfig.secrets);
    logger.log(chalk.green(`✓ Generated .env file: ${envPath}`));

    // Copy to output path if specified
    if (buildConfig.envOutputPath) {
      const outputPath = path.resolve(path.join(process.cwd(), 'builder', appName), buildConfig.envOutputPath);
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

    // 2. Determine language
    let language = options.language || buildConfig.language;
    if (!language) {
      const builderPath = path.join(process.cwd(), 'builder', appName);
      language = detectLanguage(builderPath);
    }
    logger.log(chalk.green(`✓ Detected language: ${language}`));

    // 3. Determine Dockerfile
    const dockerfilePath = await determineDockerfile(appName, language, config, buildConfig, options);

    // 4. Prepare build context
    const contextPath = prepareBuildContext(appName, buildConfig.context);

    // 5. Build Docker image
    const tag = options.tag || 'latest';
    await executeBuild(imageName, dockerfilePath, contextPath, tag, options);

    // 6. Post-build tasks
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
  executeDockerBuild,
  detectLanguage,
  generateDockerfile,
  buildApp
};
