/**
 * AI Fabrix Builder - Up Dataplane Command
 *
 * Registers or rotates dataplane app in dev, then deploys. Miso-controller runs
 * the dataplane container; this command does not run the image locally.
 * If app is already registered, uses rotate-secret; otherwise registers.
 *
 * @fileoverview up-dataplane command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const { checkAuthentication } = require('../utils/app-register-auth');
const { resolveControllerUrl } = require('../utils/controller-url');
const { resolveEnvironment } = require('../core/config');
const { registerApplication } = require('../app/register');
const { rotateSecret } = require('../app/rotate-secret');
const { checkApplicationExists } = require('../utils/app-existence');
const app = require('../app');
const { ensureAppFromTemplate } = require('./up-common');

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
 * Build full image ref from registry and dataplane variables (registry/name:tag)
 * @param {string} registry - Registry URL
 * @returns {string|undefined} Full image reference or undefined
 */
function buildDataplaneImageRef(registry) {
  const pathsUtil = require('../utils/paths');
  const variablesPath = path.join(pathsUtil.getBuilderPath('dataplane'), 'variables.yaml');
  if (!fs.existsSync(variablesPath)) return undefined;
  const content = fs.readFileSync(variablesPath, 'utf8');
  const variables = yaml.load(content);
  const name = variables?.image?.name || variables?.app?.key || 'dataplane';
  const tag = variables?.image?.tag || 'latest';
  const base = (registry || '').replace(/\/+$/, '');
  return base ? `${base}/${name}:${tag}` : undefined;
}

/**
 * Handle up-dataplane command: ensure logged in, environment dev, ensure dataplane,
 * register or rotate (if already registered), then deploy (miso-controller runs the container).
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
  logger.log(chalk.blue('Starting up-dataplane (register/rotate, deploy dataplane in dev)...\n'));

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

  await registerOrRotateDataplane(options, controllerUrl, environmentKey, authConfig);

  const imageOverride = options.image || (options.registry ? buildDataplaneImageRef(options.registry) : undefined);
  const deployOpts = { imageOverride, image: imageOverride, registryMode: options.registryMode };

  await app.deployApp('dataplane', deployOpts);

  logger.log(chalk.green('\n✓ up-dataplane complete. Dataplane is registered and deployed in dev (miso-controller runs the container).'));
}

module.exports = { handleUpDataplane, buildDataplaneImageRef };
