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

const chalk = require('chalk');
const pathsUtil = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');
const logger = require('../utils/logger');
const config = require('../core/config');
const { checkAuthentication } = require('../utils/app-register-auth');
const { resolveControllerUrl } = require('../utils/controller-url');
const { resolveEnvironment } = require('../core/config');
const { registerApplication } = require('../app/register');
const { rotateSecret } = require('../app/rotate-secret');
const { checkApplicationExists } = require('../utils/app-existence');
const app = require('../app');
const { ensureAppFromTemplate, validateEnvOutputPathFolderOrNull } = require('./up-common');

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
    const imageOverride = options.image || (options.registry ? buildDataplaneImageRef(options.registry) : undefined);
    const registerOpts = { imageOverride, image: imageOverride, registryMode: options.registryMode };
    await registerApplication('dataplane', registerOpts);
  }
}

/**
 * Build full image ref from registry and dataplane config (registry/name:tag)
 * @param {string} registry - Registry URL
 * @returns {string|undefined} Full image reference or undefined
 */
function buildDataplaneImageRef(registry) {
  try {
    const builderPath = pathsUtil.getBuilderPath('dataplane');
    const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
    const variables = loadConfigFile(configPath);
    const name = variables?.image?.name || variables?.app?.key || 'dataplane';
    const tag = variables?.image?.tag || 'latest';
    const base = (registry || '').replace(/\/+$/, '');
    return base ? `${base}/${name}:${tag}` : undefined;
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
    process.env.AIFABRIX_BUILDER_DIR = builderDir;
  }
  logger.log(chalk.blue('Starting up-dataplane (register/rotate, deploy, then run dataplane locally)...\n'));

  const [controllerUrl, environmentKey] = await Promise.all([resolveControllerUrl(), resolveEnvironment()]);
  const authConfig = await checkAuthentication(controllerUrl, environmentKey);

  const cfg = await config.getConfig();
  const environment = (cfg && cfg.environment) ? cfg.environment : 'dev';
  if (environment !== 'dev') {
    throw new Error(
      'Dataplane is only supported in dev environment. Set with: aifabrix auth config --set-environment dev.'
    );
  }
  logger.log(chalk.green('✓ Logged in and environment is dev'));

  await ensureAppFromTemplate('dataplane');
  // If envOutputPath target folder does not exist, set envOutputPath to null
  validateEnvOutputPathFolderOrNull('dataplane');

  await registerOrRotateDataplane(options, controllerUrl, environmentKey, authConfig);

  const imageOverride = options.image || (options.registry ? buildDataplaneImageRef(options.registry) : undefined);
  const deployOpts = { imageOverride, image: imageOverride, registryMode: options.registryMode };

  await app.deployApp('dataplane', deployOpts);
  logger.log('');
  await app.runApp('dataplane', {});

  logger.log(chalk.green('\n✓ up-dataplane complete. Dataplane is registered, deployed in dev, and running locally.'));
}

module.exports = { handleUpDataplane, buildDataplaneImageRef };
