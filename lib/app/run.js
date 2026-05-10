/**
 * AI Fabrix Builder Application Run Management
 *
 * This module handles application running with Docker containers.
 * Includes Docker orchestration, health checking, and port management.
 *
 * @fileoverview Application run management for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const {
  formatWarningLine,
  sectionTitle,
  headerKeyValue,
  metadata,
  formatNextActions
} = require('../utils/cli-test-layout-chalk');
const config = require('../core/config');
const logger = require('../utils/logger');
const pathsUtil = require('../utils/paths');
const { checkPortAvailable, waitForHealthCheck } = require('../utils/health-check');
const composeGenerator = require('../utils/compose-generator');
const containerHelpers = require('../utils/app-run-containers');
// Helper functions extracted to reduce file size and complexity
const helpers = require('./run-helpers');
const { ensureReloadSync, logReloadDevSummary } = require('./run-reload-sync');
const { execWithDockerEnv } = require('../utils/docker-exec');

/**
 * True if host is localhost or 127.0.0.1 (case-insensitive).
 * @param {string} host - Hostname or empty
 * @returns {boolean}
 */
function isLocalhostHost(host) {
  if (!host || typeof host !== 'string') return false;
  const h = host.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1';
}

/**
 * True if the given URL or endpoint string refers to localhost (host is localhost or 127.0.0.1).
 * Handles tcp://localhost:2376, https://127.0.0.1:8443, etc.
 * @param {string} urlOrEndpoint - URL (e.g. https://localhost:8443) or Docker endpoint (e.g. tcp://localhost:2376)
 * @returns {boolean}
 */
function isLocalhostEndpoint(urlOrEndpoint) {
  if (!urlOrEndpoint || typeof urlOrEndpoint !== 'string') return false;
  const s = urlOrEndpoint.trim();
  if (!s) return false;
  try {
    if (s.startsWith('tcp://') || s.startsWith('unix://')) {
      const rest = s.replace(/^tcp:\/\//i, '').replace(/^unix:\/\//i, '');
      const host = rest.split('/')[0].split(':')[0];
      return isLocalhostHost(host);
    }
    const u = new URL(s);
    return isLocalhostHost(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Validate app for run and check if it's an external system
 * @async
 * @param {string} appName - Application name
 * @param {boolean} _debug - Debug flag (unused)
 * @returns {Promise<boolean>} True if should continue, false if external system
 * @throws {Error} If app name is invalid
 */
async function validateAppForRun(appName, _debug) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required');
  }

  // Run only supports regular apps in builder/ (path resolution: integration first, then builder)
  const { detectAppType } = require('../utils/paths');
  try {
    const { isExternal, baseDir } = await detectAppType(appName);
    if (baseDir !== 'builder' || isExternal) {
      logger.log('');
      logger.log(sectionTitle('Run'));
      logger.log(headerKeyValue('Application:', appName));
      logger.log(
        formatWarningLine('External integrations are not started as local Docker containers.')
      );
      logger.log(
        metadata('Build and deploy the integration, then use its APIs from your environment.')
      );
      logger.log(formatNextActions([`aifabrix build ${appName}`]));
      return false;
    }
  } catch (error) {
    throw new Error(
      `Application "${appName}" not found in builder/. Only applications in builder/ can be run.\n` +
      (error.message || '')
    );
  }

  return true;
}

/**
 * Check if container is running and stop it if needed
 * @async
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID
 * @param {boolean} debug - Debug flag
 * @returns {Promise<void>}
 */
async function checkAndStopContainer(appName, appConfig, options, debug) {
  const developerId = appConfig.developerId;
  const runEnvKey = (options.env || 'dev').toLowerCase();
  const userCfg = await config.getConfig();
  const { computeEffectiveEnvironmentScopedResources } = require('../utils/environment-scoped-resources');
  const effectiveEnvironmentScopedResources = computeEffectiveEnvironmentScopedResources(
    Boolean(userCfg.useEnvironmentScopedResources),
    appConfig.environmentScopedResources === true,
    runEnvKey
  );
  const scopeOpts = effectiveEnvironmentScopedResources
    ? { effectiveEnvironmentScopedResources: true, env: runEnvKey }
    : null;
  const containerRunning = await helpers.checkContainerRunning(appName, developerId, debug, scopeOpts);
  if (!containerRunning) {
    return;
  }

  const containerName = containerHelpers.getContainerName(appName, developerId, scopeOpts);
  logger.log(formatWarningLine(`Container ${containerName} is already running`));
  await helpers.stopAndRemoveContainer(appName, developerId, debug, scopeOpts);
}

/**
 * Calculate host port and validate it's available
 * @async
 * @param {Object} appConfig - Application configuration
 * @param {Object} options - Run options
 * @param {number} [options.port] - Override port
 * @param {boolean} debug - Debug flag
 * @returns {Promise<number>} Host port
 * @throws {Error} If port is not available
 */
async function calculateHostPort(appConfig, options, debug) {
  const basePort = appConfig.port || 3000;
  const idNum = typeof appConfig.developerId === 'string' ? parseInt(appConfig.developerId, 10) : appConfig.developerId;
  const hostPort = options.port || (idNum === 0 ? basePort : basePort + (idNum * 100));

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Host port: ${hostPort} (${options.port ? 'CLI override' : 'dev-specific'}), Container port: ${appConfig.build?.containerPort || appConfig.port || 3000} (unchanged)`));
  }

  const portAvailable = await checkPortAvailable(hostPort);
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Port ${hostPort} available: ${portAvailable}`));
  }

  if (!portAvailable) {
    throw new Error(`Port ${hostPort} is already in use. Try --port <alternative>`);
  }

  return hostPort;
}

/**
 * Load and configure application
 * @async
 * @param {string} appName - Application name
 * @param {boolean} debug - Debug flag
 * @returns {Promise<Object>} Application configuration with developerId
 */
async function loadAndConfigureApp(appName, debug) {
  const appConfig = await helpers.validateAppConfiguration(appName);
  const developerId = await config.getDeveloperId();
  appConfig.developerId = developerId;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Configuration loaded: port=${appConfig.port || 'default'}, healthCheck.path=${appConfig.healthCheck?.path || '/health'}, developerId=${appConfig.developerId}`));
  }

  return appConfig;
}

/**
 * Start application container and display status
 * @async
 * @param {string} appName - Application name
 * @param {string} tempComposePath - Path to compose file
 * @param {number} hostPort - Host port
 * @param {Object} appConfig - Application configuration
 * @param {Object} opts - Options (debug, runEnvPath, runEnvAdminPath)
 * @throws {Error} If container start fails
 */
async function startAppContainer(appName, tempComposePath, hostPort, appConfig, opts) {
  const {
    debug,
    runEnvPath = null,
    runEnvAdminPath = null,
    runOptions = {},
    devMountPath = null
  } = opts;
  const misoEnvironment = opts.misoEnvironment ?? composeGenerator.resolveMisoEnvironment(runOptions);
  try {
    await helpers.startContainer(appName, tempComposePath, hostPort, appConfig, {
      debug,
      runEnvPath,
      runEnvAdminPath,
      runOptions,
      devMountPath,
      misoEnvironment
    });
    await helpers.displayRunStatus(
      appName,
      hostPort,
      appConfig,
      opts.runScopeOpts || null,
      runOptions || {}
    );
  } catch (error) {
    logger.log('');
    logger.log(formatWarningLine(`Compose file preserved at ${tempComposePath}`));
    logger.log(metadata('  Review the compose file, fix the issue, then run again.'));
    if (runEnvPath || runEnvAdminPath) {
      logger.log(
        metadata('  Run .env file(s) contain secrets and were not deleted; remove manually if needed.')
      );
    }
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Error during container start: ${error.message}`));
    }
    throw error;
  }
}

/**
 * Resolve run options (paths and optional reload sync) for prepareAppRun.
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {Object} options - Run options
 * @param {string} envKey - Environment key (dev/tst/pro)
 * @param {boolean} debug - Debug flag
 * @returns {Promise<Object>} Run options with optional devMountPath
 */
async function resolveRunOptions(appName, appConfig, options, envKey, debug, effectiveEnvironmentScopedResources) {
  const runOptions = {
    ...options,
    env: envKey,
    effectiveEnvironmentScopedResources: Boolean(effectiveEnvironmentScopedResources)
  };
  const builderPath = pathsUtil.getBuilderPath(appName);
  const codePath = pathsUtil.resolveBuildContext(builderPath, appConfig.build?.context || '.');
  if (options.reload && envKey === 'dev') {
    const remoteSyncPath = appConfig.build?.remoteSyncPath;
    const reloadSummary = await ensureReloadSync(appName, appConfig.developerId, debug, codePath, remoteSyncPath);
    runOptions.reloadSyncSummary = reloadSummary;
    runOptions.devMountPath =
      reloadSummary.transport === 'mutagen' ? reloadSummary.remotePath : codePath;
  }
  return runOptions;
}

/**
 * When Traefik is enabled in user config, pass through for health checks (DNS + localhost order).
 * @param {Object} runOptions
 * @param {Object} userCfg
 */
function applyTraefikFlagToRunOptions(runOptions, userCfg) {
  if (userCfg && userCfg.traefik === true) {
    runOptions.traefikEnabled = true;
  }
}

/**
 * @param {string} envKey
 * @throws {Error} If env is not dev, tst, or pro
 */
function assertValidRunEnvKey(envKey) {
  if (envKey !== 'dev' && envKey !== 'tst' && envKey !== 'pro') {
    throw new Error('--env must be dev, tst, or pro');
  }
}

/**
 * Image resolution, prereqs, port, compose env — after app config and user config are loaded.
 * @param {string} appName
 * @param {Object} appConfig
 * @param {Object} options - Original run options
 * @param {string} envKey
 * @param {Object} userCfg - getConfig() result
 * @param {boolean} debug
 * @returns {Promise<Object>} Prepared run context (same shape as prepareAppRun return)
 */
async function computeRunPreparationCore(appName, appConfig, options, envKey, userCfg, debug) {
  const { computeEffectiveEnvironmentScopedResources } = require('../utils/environment-scoped-resources');
  const effectiveEnvironmentScopedResources = computeEffectiveEnvironmentScopedResources(
    Boolean(userCfg.useEnvironmentScopedResources),
    appConfig.environmentScopedResources === true,
    envKey
  );
  const runScopeOpts = effectiveEnvironmentScopedResources
    ? { effectiveEnvironmentScopedResources: true, env: envKey }
    : null;
  const { resolveRunImageWithLocalFallback } = require('./run-resolve-image');
  const resolvedRef = await resolveRunImageWithLocalFallback(appName, appConfig, options);
  const effectiveRunOptions = {
    ...options,
    image: `${resolvedRef.imageName}:${resolvedRef.imageTag}`
  };
  await helpers.checkPrerequisites(appName, appConfig, debug, effectiveRunOptions.skipInfraCheck === true, effectiveRunOptions);
  await checkAndStopContainer(appName, appConfig, effectiveRunOptions, debug);
  const hostPort = await calculateHostPort(appConfig, effectiveRunOptions, debug);
  const runOptions = await resolveRunOptions(
    appName,
    appConfig,
    effectiveRunOptions,
    envKey,
    debug,
    effectiveEnvironmentScopedResources
  );
  applyTraefikFlagToRunOptions(runOptions, userCfg);
  const { composePath: tempComposePath, runEnvPath, runEnvAdminPath } = await helpers.prepareEnvironment(appName, appConfig, runOptions);
  const result = {
    appConfig,
    tempComposePath,
    hostPort,
    runEnvPath,
    runEnvAdminPath,
    runScopeOpts,
    mergedRunOptions: runOptions
  };
  if (runOptions.devMountPath) result.devMountPath = runOptions.devMountPath;
  return result;
}

/**
 * Prepare run: validate app, load config, check prereqs, stop existing container, resolve port and reload, prepare env.
 * @param {string} appName - Application name
 * @param {Object} options - Run options
 * @param {boolean} debug - Debug flag
 * @returns {Promise<{ appConfig: Object, tempComposePath: string, hostPort: number }|null>} Prepared run context or null if should not continue
 */
async function prepareAppRun(appName, options, debug) {
  const envKey = (options.env || 'dev').toLowerCase();
  assertValidRunEnvKey(envKey);
  const shouldContinue = await validateAppForRun(appName, debug);
  if (!shouldContinue) {
    return null;
  }
  logger.log('');
  logger.log(sectionTitle('Run'));
  logger.log(headerKeyValue('Application:', appName));
  const appConfig = await loadAndConfigureApp(appName, debug);
  const userCfg = await config.getConfig();
  return computeRunPreparationCore(appName, appConfig, options, envKey, userCfg, debug);
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
  const debug = options.debug || false;
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Starting run process for: ${appName}`));
    logger.log(chalk.gray(`[DEBUG] Options: ${JSON.stringify(options, null, 2)}`));
  }
  try {
    const prepared = await prepareAppRun(appName, options, debug);
    if (!prepared) {
      return;
    }
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Compose file generated: ${prepared.tempComposePath}`));
    }
    logReloadDevSummary(Boolean(options.reload), prepared.mergedRunOptions.reloadSyncSummary);
    await startAppContainer(appName, prepared.tempComposePath, prepared.hostPort, prepared.appConfig, {
      debug,
      runEnvPath: prepared.runEnvPath,
      runEnvAdminPath: prepared.runEnvAdminPath,
      runOptions: prepared.mergedRunOptions,
      devMountPath: prepared.devMountPath,
      runScopeOpts: prepared.runScopeOpts
    });
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Run failed: ${error.message}`));
    }
    throw new Error(`Failed to run application: ${error.message}`);
  }
}

/**
 * Restart a running application container (Docker restart).
 * Only applies to apps in builder/ run via aifabrix run.
 *
 * @async
 * @function restartApp
 * @param {string} appName - Application name (must be running)
 * @returns {Promise<void>} Resolves when container is restarted
 * @throws {Error} If app name is invalid, container not found, or restart fails
 *
 * @example
 * await restartApp('myapp');
 */
async function restartApp(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required and must be a string');
  }
  const developerId = await config.getDeveloperId();
  const containerName = containerHelpers.getContainerName(appName, developerId);
  try {
    await execWithDockerEnv(`docker restart ${containerName}`);
  } catch (error) {
    const msg = (error.stderr || error.stdout || error.message || '').toLowerCase();
    if (msg.includes('no such container') || msg.includes('is not running')) {
      throw new Error(`Application '${appName}' is not running. Start it with: aifabrix run ${appName}`);
    }
    throw new Error(`Failed to restart application: ${error.message}`);
  }
}

module.exports = {
  runApp,
  restartApp,
  ensureReloadSync,
  isLocalhostHost,
  isLocalhostEndpoint,
  checkImageExists: helpers.checkImageExists,
  checkContainerRunning: helpers.checkContainerRunning,
  stopAndRemoveContainer: helpers.stopAndRemoveContainer,
  checkPortAvailable,
  generateDockerCompose: composeGenerator.generateDockerCompose,
  waitForHealthCheck
};
