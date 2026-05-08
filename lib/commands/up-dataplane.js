const { formatSuccessLine, formatSuccessParagraph } = require('../utils/cli-test-layout-chalk');
/**
 * AI Fabrix Builder - Up Dataplane Command
 *
 * Always local deployment: registers or rotates dataplane app in dev, sends
 * deployment manifest to Miso Controller, then runs the dataplane app locally
 * (same as aifabrix deploy dataplane --local). If app is already
 * registered, uses rotate-secret; otherwise registers.
 *
 * @fileoverview up-dataplane command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const pathsUtil = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');
const { resolveDockerImageRef, normalizeDockerRegistryPrefix } = require('../utils/resolve-docker-image-ref');
const logger = require('../utils/logger');
const config = require('../core/config');
const { checkAuthentication } = require('../utils/app-register-auth');
const { resolveControllerUrl } = require('../utils/controller-url');
const { resolveEnvironment, setControllerUrl } = require('../core/config');
const { registerApplication } = require('../app/register');
const { rotateSecret } = require('../app/rotate-secret');
const { checkApplicationExists } = require('../utils/app-existence');
const { checkHealthEndpoint } = require('../utils/health-check');
const { validateControllerUrl } = require('../utils/auth-config-validator');
const app = require('../app');
const { ensureAppFromTemplate, validateEnvOutputPathFolderOrNull } = require('./up-common');

const CONTROLLER_HEALTH_PATH = '/health';

/**
 * Check if controller is reachable (health endpoint).
 * @param {string} baseUrl - Controller base URL (no trailing slash)
 * @returns {Promise<boolean>} True if healthy
 */
async function isControllerHealthy(baseUrl) {
  const healthUrl = `${baseUrl.replace(/\/+$/, '')}${CONTROLLER_HEALTH_PATH}`;
  try {
    return await checkHealthEndpoint(healthUrl, false);
  } catch {
    return false;
  }
}

/**
 * Prompt user for controller URL when current controller is not available.
 * @param {string} currentUrl - Current controller URL that failed health check
 * @returns {Promise<string|null>} New URL or null if user aborted (empty input)
 */
function promptForControllerUrl(currentUrl) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      chalk.yellow(`Controller at ${currentUrl} is not available. Enter controller URL (or press Enter to abort): `),
      (answer) => {
        rl.close();
        const trimmed = (answer || '').trim();
        resolve(trimmed === '' ? null : trimmed);
      }
    );
  });
}

/**
 * Resolve controller URL and ensure it is healthy; if not, prompt once for new URL.
 * @returns {Promise<string>} Controller URL to use
 * @throws {Error} If controller unavailable and user aborts or new URL still unhealthy
 */
async function resolveControllerUrlWithHealthCheck() {
  let controllerUrl = await resolveControllerUrl();
  controllerUrl = controllerUrl.replace(/\/+$/, '');

  let healthy = await isControllerHealthy(controllerUrl);
  if (healthy) {
    return controllerUrl;
  }

  logger.log(chalk.yellow(`\nController at ${controllerUrl} is not responding (health check failed).\n`));
  const newUrl = await promptForControllerUrl(controllerUrl);
  if (!newUrl) {
    throw new Error('Controller URL is required. Run "aifabrix up-dataplane" again and enter a valid controller URL, or set it with: aifabrix auth --set-controller <url>');
  }

  try {
    validateControllerUrl(newUrl);
  } catch (err) {
    throw new Error(`Invalid controller URL: ${err.message}`);
  }

  await setControllerUrl(newUrl);
  const normalizedNew = newUrl.trim().replace(/\/+$/, '');
  healthy = await isControllerHealthy(normalizedNew);
  if (!healthy) {
    throw new Error(`Controller at ${normalizedNew} is not responding. Ensure the controller is running and reachable, then run "aifabrix up-dataplane" again.`);
  }

  logger.log(formatSuccessLine(`Using controller: ${normalizedNew}`));
  return normalizedNew;
}

/**
 * Register or rotate dataplane: if app exists in controller, rotate secret; otherwise register.
 * @async
 * @param {Object} options - Commander options
 * @param {string} controllerUrl - Controller URL
 * @param {string} environmentKey - Environment key
 * @param {Object} authConfig - Auth config with token
 */
async function registerOrRotateDataplane(options, controllerUrl, environmentKey, authConfig) {
  const appExists = await checkApplicationExists('dataplane', controllerUrl, environmentKey, authConfig);
  if (appExists) {
    logger.log(chalk.blue('Dataplane already registered; rotating secret...'));
    await rotateSecret('dataplane', options);
  } else {
    const imageOverride = options.image || buildDataplaneImageRef(options);
    const registerOpts = { imageOverride, image: imageOverride, registryMode: options.registryMode };
    await registerApplication('dataplane', registerOpts);
  }
}

/**
 * Deploy dataplane app (send manifest to controller).
 * @param {Object} options - Commander options (registry, registryMode, image)
 * @returns {Promise<void>}
 */
async function deployDataplaneToController(options) {
  const imageOverride = options.image || buildDataplaneImageRef(options);
  const deployOpts = {
    imageOverride,
    image: imageOverride,
    registryMode: options.registryMode,
    // Guided up-platform already shows a top-level spinner for the dataplane step.
    // Avoid nested deploy polling spinners/logs.
    silentPoll: options.platformInstall === true
  };
  await app.deployApp('dataplane', deployOpts);
}

/**
 * Full pullable image ref when CLI `--registry` and/or manifest `image.registry` is set.
 * Returns undefined when neither is set (register/deploy use application config as before).
 * @param {Object} [options] - Commander options
 * @param {string} [options.registry] - CLI registry override (wins over manifest)
 * @returns {string|undefined} Full reference or undefined
 */
function buildDataplaneImageRef(options = {}) {
  try {
    const builderPath = pathsUtil.getBuilderPath('dataplane');
    const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
    const variables = loadConfigFile(configPath) || {};
    const cli = normalizeDockerRegistryPrefix(options.registry);
    const manifestReg = normalizeDockerRegistryPrefix(variables.image?.registry);
    if (!cli && !manifestReg) {
      return undefined;
    }
    const { imageName, imageTag } = resolveDockerImageRef('dataplane', variables, {
      registry: options.registry || undefined
    });
    return `${imageName}:${imageTag}`;
  } catch {
    return undefined;
  }
}

/**
 * Handle up-dataplane command: ensure logged in, environment dev, ensure dataplane,
 * register or rotate (if already registered), deploy (send manifest to controller),
 * then run dataplane app locally (always local deployment).
 *
 * @async
 * @function handleUpDataplane
 * @param {Object} options - Commander options
 * @param {string} [options.registry] - Override registry for dataplane
 * @param {string} [options.registryMode] - Override registry mode (acr|external)
 * @param {string} [options.image] - Override image reference for dataplane
 * @returns {Promise<void>}
 * @throws {Error} If not logged in, environment not dev, or any step fails
 */
async function handleUpDataplane(options = {}) {
  const builderDir = await config.getAifabrixBuilderDir();
  if (builderDir) {
    process.env.AIFABRIX_BUILDER_DIR = path.resolve(builderDir);
  }
  logger.log(chalk.blue('Starting up-dataplane (register/rotate, deploy, then run dataplane locally)...\n'));

  const controllerUrl = await resolveControllerUrlWithHealthCheck();
  const environmentKey = await resolveEnvironment();
  const authConfig = await checkAuthentication(controllerUrl, environmentKey, { throwOnFailure: true });

  const cfg = await config.getConfig();
  const environment = (cfg && cfg.environment) ? cfg.environment : 'dev';
  if (environment !== 'dev') {
    throw new Error(
      'Dataplane is only supported in dev environment. Set with: aifabrix auth --set-environment dev.'
    );
  }
  logger.log(formatSuccessLine('Logged in and environment is dev'));

  await ensureAppFromTemplate('dataplane');
  // If envOutputPath target folder does not exist, set envOutputPath to null
  validateEnvOutputPathFolderOrNull('dataplane');

  await registerOrRotateDataplane(options, controllerUrl, environmentKey, authConfig);

  await deployDataplaneToController(options);
  logger.log('');
  await app.runApp('dataplane', {
    skipEnvOutputPath: true,
    registry: options.registry || undefined
  });

  logger.log(formatSuccessParagraph('up-dataplane complete. Dataplane is registered, deployed in dev, and running locally.'));
}

module.exports = { handleUpDataplane, buildDataplaneImageRef };
