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
    console.log(chalk.blue('Building image...'));
    console.log(chalk.gray(`Command: ${dockerCommand}`));

    const { stdout, stderr } = await execAsync(dockerCommand);

    if (stderr && !stderr.includes('warning')) {
      console.log(chalk.yellow(stderr));
    }

    if (stdout) {
      console.log(stdout);
    }

    console.log(chalk.green(`✓ Image built: ${imageName}:${tag}`));
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
    console.log(chalk.blue(`\n🔨 Building application: ${appName}`));

    // 1. Load and validate configuration
    const config = await loadVariablesYaml(appName);
    console.log(chalk.green(`✓ Loaded configuration from builder/${appName}/variables.yaml`));

    // Validate configuration
    const validation = await validator.validateVariables(appName);
    if (!validation.valid) {
      console.log(chalk.red('❌ Configuration validation failed:'));
      validation.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
      throw new Error('Configuration validation failed');
    }

    // Extract configuration values
    const imageName = config.image?.split(':')[0] || appName;
    const buildConfig = config.build || {};

    // 2. Determine language
    let language = options.language || buildConfig.language;
    if (!language) {
      const builderPath = path.join(process.cwd(), 'builder', appName);
      language = detectLanguage(builderPath);
    }
    console.log(chalk.green(`✓ Detected language: ${language}`));

    // 3. Determine Dockerfile
    let dockerfilePath;
    const customDockerfile = buildConfig.dockerfile;

    if (customDockerfile && !options.forceTemplate) {
      const customPath = path.join(process.cwd(), 'builder', appName, customDockerfile);
      if (fsSync.existsSync(customPath)) {
        dockerfilePath = customPath;
        console.log(chalk.green(`✓ Using custom Dockerfile: ${customDockerfile}`));
      }
    }

    if (!dockerfilePath || options.forceTemplate) {
      // Generate Dockerfile from template
      const builderPath = path.join(process.cwd(), 'builder', appName);
      dockerfilePath = await generateDockerfile(builderPath, language, config);
      console.log(chalk.green(`✓ Generated Dockerfile from template: .aifabrix/Dockerfile.${language}`));
    }

    // 4. Determine build context
    const contextPath = resolveContextPath(
      path.join(process.cwd(), 'builder', appName),
      buildConfig.context
    );

    // 5. Build Docker image
    const tag = options.tag || 'latest';
    await executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

    // 6. Tag image if additional tag provided
    if (options.tag && options.tag !== 'latest') {
      await execAsync(`docker tag ${imageName}:${tag} ${imageName}:latest`);
      console.log(chalk.green(`✓ Tagged image: ${imageName}:latest`));
    }

    // 7. Generate .env file
    try {
      const envPath = await secrets.generateEnvFile(appName, buildConfig.secrets);
      console.log(chalk.green(`✓ Generated .env file: ${envPath}`));

      // Copy to output path if specified
      if (buildConfig.envOutputPath) {
        const outputPath = path.resolve(path.join(process.cwd(), 'builder', appName), buildConfig.envOutputPath);
        const outputDir = path.dirname(outputPath);

        if (!fsSync.existsSync(outputDir)) {
          await fs.mkdir(outputDir, { recursive: true });
        }

        await fs.copyFile(envPath, outputPath);
        console.log(chalk.green(`✓ Copied .env to: ${buildConfig.envOutputPath}`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Warning: Could not generate .env file: ${error.message}`));
    }

    console.log(chalk.green('\n✅ Build completed successfully!'));
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
