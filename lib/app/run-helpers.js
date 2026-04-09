/**
 * AI Fabrix Builder - App Run Helpers
 *
 * Extracted helper functions to keep lib/app-run.js small and maintainable.
 * These helpers encapsulate image checks, validation, env prep, and container start logic.
 *
 * @fileoverview Helper functions for application run workflow
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const chalk = require('chalk');
const { loadConfigFile } = require('../utils/config-format');
const validator = require('../validation/validator');
const config = require('../core/config');
const buildCopy = require('../utils/build-copy');
const logger = require('../utils/logger');
const composeGenerator = require('../utils/compose-generator');
const containerHelpers = require('../utils/app-run-containers');
const pathsUtil = require('../utils/paths');
const runEnvCompose = require('./run-env-compose');
const { getAppInfraRequirements } = require('./run-infra-requirements');
const { resolveRunImage } = require('./run-resolve-image');
const { startContainer } = require('./run-container-start');
const { resolveEnvOutputPath, writeEnvOutputForReload, writeEnvOutputForLocal } = require('../utils/env-copy');
const { resolveVersionForApp } = require('../utils/image-version');

/** Template apps (keycloak, miso-controller, dataplane) - never update application config when running */
const TEMPLATE_APP_KEYS = ['keycloak', 'miso-controller', 'dataplane'];

// Re-export container helper functions
const checkImageExists = containerHelpers.checkImageExists;
const checkContainerRunning = containerHelpers.checkContainerRunning;
const stopAndRemoveContainer = containerHelpers.stopAndRemoveContainer;

/**
 * Check if running from builder directory
 * @param {string} appName - Application name
 * @throws {Error} If running from builder directory
 */
function checkBuilderDirectory(appName) {
  const currentDir = process.cwd();
  const expectedAppDir = pathsUtil.getBuilderPath(appName);
  const normalizedCurrent = path.resolve(currentDir).replace(/\\/g, '/');
  const normalizedExpected = path.resolve(expectedAppDir).replace(/\\/g, '/');

  if (normalizedCurrent === normalizedExpected) {
    const projectRoot = path.resolve(expectedAppDir, '../..');
    throw new Error(
      'You\'re running from inside the builder directory.\n' +
      `Current directory: ${currentDir}\n` +
      'Please change to the project root and try again:\n' +
      `  cd ${projectRoot}\n` +
      `  aifabrix run ${appName}`
    );
  }
}

/**
 * Load and validate config file exists
 * Uses paths.getBuilderPath so AIFABRIX_BUILDER_DIR (e.g. from up-miso) is respected.
 * @param {string} appName - Application name
 * @returns {Object} Application configuration
 * @throws {Error} If config file not found
 */
function loadAppConfig(appName) {
  const currentDir = process.cwd();
  const builderPath = pathsUtil.getBuilderPath(appName);
  let configPath;
  try {
    configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
  } catch {
    throw new Error(
      `Application configuration not found in ${builderPath}\n` +
      `Current directory: ${currentDir}\n` +
      'Make sure you\'re running from the project root (where \'builder\' directory exists)\n' +
      `Run 'aifabrix create ${appName}' first if configuration doesn't exist`
    );
  }
  return loadConfigFile(configPath);
}

/**
 * Format validation errors
 * @param {Object} validation - Validation result
 * @returns {Array<string>} Formatted error messages
 */
function formatValidationErrors(validation) {
  const allErrors = [];

  if (validation.variables && validation.variables.errors && validation.variables.errors.length > 0) {
    allErrors.push('application config:');
    allErrors.push(...validation.variables.errors.map(err => `  ${err}`));
  }
  if (validation.rbac && validation.rbac.errors && validation.rbac.errors.length > 0) {
    allErrors.push('rbac.yaml:');
    allErrors.push(...validation.rbac.errors.map(err => `  ${err}`));
  }
  if (validation.env && validation.env.errors && validation.env.errors.length > 0) {
    allErrors.push('env.template:');
    allErrors.push(...validation.env.errors.map(err => `  ${err}`));
  }

  return allErrors;
}

/**
 * Validates app name and loads configuration
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Application configuration
 * @throws {Error} If validation fails
 */
async function validateAppConfiguration(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required');
  }

  const { assertRemoteBuilderDeveloperId } = require('../utils/remote-builder-validation');
  assertRemoteBuilderDeveloperId(await config.getRemoteServer(), await config.getDeveloperId());

  // Check if running from builder directory
  checkBuilderDirectory(appName);

  // Load config
  const appConfig = loadAppConfig(appName);

  // Validate configuration (run only uses builder/ apps)
  const validation = await validator.validateApplication(appName, { type: 'app' });
  if (!validation.valid) {
    const allErrors = formatValidationErrors(validation);
    if (allErrors.length === 0) {
      throw new Error('Configuration validation failed');
    }
    throw new Error(`Configuration validation failed:\n${allErrors.join('\n')}`);
  }

  return appConfig;
}

/**
 * Resolves version from image and updates builder application config when running.
 * Template apps (keycloak, miso-controller, dataplane) are never updated - config stays pristine.
 * @async
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {boolean} debug - Enable debug logging
 */
async function resolveAndUpdateVersion(appName, appConfig, debug) {
  const isTemplateApp = TEMPLATE_APP_KEYS.includes(appName);
  const resolved = await resolveVersionForApp(appName, appConfig, {
    updateBuilder: !isTemplateApp,
    builderPath: pathsUtil.getBuilderPath(appName)
  });
  if (resolved.fromImage && resolved.updated && debug) {
    logger.log(chalk.gray(`[DEBUG] Updated app.version to ${resolved.version} from image`));
  }
}

/**
 * Checks prerequisites: Docker image and (optionally) infrastructure
 * @async
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {boolean} [debug=false] - Enable debug logging
 * @param {boolean} [skipInfraCheck=false] - When true, skip infra health check (e.g. when caller already verified, e.g. up-miso)
 * @param {Object} [runOptions] - Run options; when runOptions.image is set, that image is checked instead of config-derived
 * @throws {Error} If prerequisites are not met
 */
async function checkPrerequisites(appName, appConfig, debug = false, skipInfraCheck = false, runOptions = {}) {
  const { imageName, imageTag } = resolveRunImage(appName, appConfig, runOptions);
  const fullImageName = `${imageName}:${imageTag}`;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Image name: ${imageName}, tag: ${imageTag}`));
  }

  logger.log(chalk.blue(`Checking if image ${fullImageName} exists...`));
  const imageExists = await checkImageExists(imageName, imageTag, debug);
  if (!imageExists) {
    const isTemplateApp = TEMPLATE_APP_KEYS.includes(appName);
    const hint = isTemplateApp
      ? `Pull the image (e.g. docker pull ${fullImageName}) or use --image ${appName}=<image> for up-miso/up-dataplane.`
      : `Run 'aifabrix build ${appName}' first`;
    throw new Error(`Docker image ${fullImageName} not found\n${hint}`);
  }
  logger.log(chalk.green(`✓ Image ${fullImageName} found`));

  await resolveAndUpdateVersion(appName, appConfig, debug);

  if (!skipInfraCheck) {
    await checkInfraHealthOrThrow(debug, appConfig);
  }
}

/**
 * Checks infrastructure health and throws if unhealthy
 * @async
 * @param {boolean} debug - Enable debug logging
 * @param {Object} [appConfig] - Application configuration (for selective infra checks)
 * @throws {Error} If infrastructure is not healthy
 */
async function checkInfraHealthOrThrow(debug, appConfig) {
  const requirements = getAppInfraRequirements(appConfig);
  if (requirements && !requirements.needsPostgres && !requirements.needsRedis) {
    logger.log(
      chalk.blue('Skipping infrastructure check (application does not require database or redis)...')
    );
    return;
  }

  logger.log(chalk.blue('Checking infrastructure health...'));
  const infra = require('../infrastructure');
  const healthOptions =
    requirements === null
      ? {}
      : {
        postgres: requirements.needsPostgres,
        redis: requirements.needsRedis
      };
  const infraHealth = await infra.checkInfraHealth(null, healthOptions);
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Infrastructure health: ${JSON.stringify(infraHealth, null, 2)}`));
  }
  const unhealthyServices = Object.entries(infraHealth)
    .filter(([_, status]) => status !== 'healthy')
    .map(([service, _]) => service);

  if (unhealthyServices.length > 0) {
    throw new Error(`Infrastructure services not healthy: ${unhealthyServices.join(', ')}\nRun 'aifabrix up-infra' first`);
  }
  logger.log(chalk.green('✓ Infrastructure is running'));
}

/**
 * Ensure dev directory exists
 * @async
 * @param {string} appName - Application name
 * @param {string} developerId - Developer ID
 * @returns {Promise<string>} Dev directory path
 */
async function ensureDevDirectory(appName, developerId) {
  const devDir = buildCopy.getDevDirectory(appName, developerId);
  if (!fsSync.existsSync(devDir)) {
    await buildCopy.copyBuilderToDevDirectory(appName, developerId);
  }
  return devDir;
}

/**
 * Calculate host port for docker-compose mapping (first port in "host:container").
 * Uses application.yaml top-level port (not localPort). Second port is always containerPort from config.
 * Example: keycloak port 8082, containerPort 8080 → "8082:8080"; miso-controller port 3000 → "3000:3000".
 *
 * @param {Object} options - Run options (may include port override)
 * @param {Object} appConfig - Application configuration
 * @param {string} developerId - Developer ID
 * @returns {number} Host port number
 */
function calculateComposePort(options, appConfig, developerId) {
  if (options.port) {
    return options.port;
  }
  const basePort = appConfig.port ?? 3000;
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  return idNum === 0 ? basePort : basePort + (idNum * 100);
}

/**
 * Generate and write Docker Compose file
 * @async
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {Object} composeOptions - Compose options
 * @param {string} devDir - Dev directory path
 * @returns {Promise<string>} Path to compose file
 */
async function generateComposeFile(appName, appConfig, composeOptions, devDir) {
  logger.log(chalk.blue('Generating Docker Compose configuration...'));
  const composeContent = await composeGenerator.generateDockerCompose(appName, appConfig, composeOptions);
  runEnvCompose.assertNoPasswordLiteralsInCompose(composeContent);
  const tempComposePath = path.join(devDir, 'docker-compose.yaml');
  await fs.writeFile(tempComposePath, composeContent);
  return tempComposePath;
}

/**
 * Writes .env to envOutputPath when application.yaml build.envOutputPath is set.
 * @async
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {string} runEnvPath - Path to .env.run
 * @param {Object} options - Run options (reload flag)
 */
async function writeEnvOutputIfConfigured(appName, appConfig, runEnvPath, options) {
  if (options && options.skipEnvOutputPath === true) return;
  const envOutputPathRaw = appConfig.build?.envOutputPath;
  if (!envOutputPathRaw || typeof envOutputPathRaw !== 'string' || envOutputPathRaw.trim() === '') {
    return;
  }
  const configPath = path.join(pathsUtil.getBuilderPath(appName), 'application.yaml');
  const outputPath = resolveEnvOutputPath(envOutputPathRaw.trim(), configPath);
  const outputDir = path.dirname(outputPath);
  if (!fsSync.existsSync(outputDir)) {
    await fs.mkdir(outputDir, { recursive: true });
  }
  if (options.reload) {
    await writeEnvOutputForReload(outputPath, runEnvPath);
  } else {
    await writeEnvOutputForLocal(appName, outputPath);
  }
}

/**
 * Prepares environment: clean applications dir, build two .env files (app-only + start-only), generate Docker Compose.
 * .env.run = app container only (no admin secrets). .env.run.admin = db-init/start only (POSTGRES_PASSWORD etc.), deleted after run.
 *
 * @async
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {Object} options - Run options (may include envFilePath, devMountPath from caller)
 * @returns {Promise<{ composePath: string, runEnvPath: string, runEnvAdminPath: string }>} Paths to compose and both run .env files (delete after success)
 */
async function prepareEnvironment(appName, appConfig, options) {
  const developerId = await config.getDeveloperId();
  const devDir = await ensureDevDirectory(appName, developerId);
  const runEnvKey = (options.env || 'dev').toLowerCase();
  const userCfg = await config.getConfig();
  const { computeEffectiveEnvironmentScopedResources } = require('../utils/environment-scoped-resources');
  const effectiveEnvironmentScopedResources = computeEffectiveEnvironmentScopedResources(
    Boolean(userCfg.useEnvironmentScopedResources),
    appConfig.environmentScopedResources === true,
    runEnvKey
  );

  runEnvCompose.cleanApplicationsDir(developerId);
  logger.log(chalk.blue('Building merged .env (admin + app secrets)...'));
  const { runEnvPath, runEnvAdminPath } = await runEnvCompose.buildMergedRunEnvAndWrite(
    appName,
    appConfig,
    devDir,
    developerId,
    { runEnvKey, effectiveEnvironmentScopedResources }
  );

  const composeOptions = {
    ...options,
    envFilePath: runEnvPath,
    dbInitEnvFilePath: runEnvAdminPath,
    effectiveEnvironmentScopedResources,
    env: runEnvKey
  };
  composeOptions.port = calculateComposePort(composeOptions, appConfig, developerId);
  const composePath = await generateComposeFile(appName, appConfig, composeOptions, devDir);

  await writeEnvOutputIfConfigured(appName, appConfig, runEnvPath, options);

  return { composePath, runEnvPath, runEnvAdminPath };
}

/**
 * Displays run status after successful start
 * @param {string} appName - Application name
 * @param {number} port - Application port
 * @param {Object} appConfig - Application configuration (with developerId property)
 */
async function displayRunStatus(appName, port, appConfig, runScopeOpts = null) {
  const containerName = containerHelpers.getContainerName(appName, appConfig.developerId, runScopeOpts);
  const healthCheckPath = appConfig?.healthCheck?.path || '/health';
  const healthCheckUrl = `http://localhost:${port}${healthCheckPath}`;

  logger.log(chalk.green(`\n✓ App running at http://localhost:${port}`));
  logger.log(chalk.blue(`Health check: ${healthCheckUrl}`));
  logger.log(chalk.gray(`Container: ${containerName}`));
}

module.exports = {
  checkImageExists,
  checkContainerRunning,
  stopAndRemoveContainer,
  validateAppConfiguration,
  checkPrerequisites,
  prepareEnvironment,
  startContainer,
  displayRunStatus,
  cleanApplicationsDir: runEnvCompose.cleanApplicationsDir
};

