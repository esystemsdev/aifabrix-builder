/**
 * AI Fabrix Builder - Up Miso Command
 *
 * Installs keycloak and miso-controller from images (no build). For dataplane, use up-dataplane.
 * Assumes infra is up; sets dev secrets and resolves (no force; existing .env values preserved).
 *
 * @fileoverview up-miso command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const pathsUtil = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');
const logger = require('../utils/logger');
const config = require('../core/config');
const infra = require('../infrastructure');
const app = require('../app');
const { ensureAppFromTemplate, patchEnvOutputPathForDeployOnly, validateEnvOutputPathFolderOrNull } = require('./up-common');

/**
 * Parse --image options array into map { keycloak?: string, 'miso-controller'?: string }
 * @param {string[]|string} imageOpts - Option value(s) e.g. ['keycloak=reg/k:v1', 'miso-controller=reg/m:v1']
 * @returns {{ keycloak?: string, 'miso-controller'?: string }}
 */
function parseImageOptions(imageOpts) {
  const map = {};
  const arr = Array.isArray(imageOpts) ? imageOpts : (imageOpts ? [imageOpts] : []);
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const eq = item.indexOf('=');
    if (eq > 0) {
      const key = item.substring(0, eq).trim();
      const value = item.substring(eq + 1).trim();
      if (key && value) map[key] = value;
    }
  }
  return map;
}

/**
 * Build full image ref from registry and app config (registry/name:tag)
 * @param {string} appName - keycloak or miso-controller
 * @param {string} registry - Registry URL
 * @returns {string} Full image reference
 */
function buildImageRefFromRegistry(appName, registry) {
  try {
    const builderPath = pathsUtil.getBuilderPath(appName);
    const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
    const variables = loadConfigFile(configPath);
    const name = variables?.image?.name || variables?.app?.key || appName;
    const tag = variables?.image?.tag || 'latest';
    const base = (registry || '').replace(/\/+$/, '');
    return base ? `${base}/${name}:${tag}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Build run options and run keycloak, then miso-controller
 * @async
 * @param {Object} options - Commander options (image, registry, registryMode)
 */
async function runMisoApps(options) {
  const imageMap = parseImageOptions(options.image);
  const keycloakImage = imageMap.keycloak || (options.registry ? buildImageRefFromRegistry('keycloak', options.registry) : undefined);
  const misoImage = imageMap['miso-controller'] || (options.registry ? buildImageRefFromRegistry('miso-controller', options.registry) : undefined);
  const keycloakRunOpts = { image: keycloakImage, registry: options.registry, registryMode: options.registryMode, skipEnvOutputPath: true, skipInfraCheck: true };
  const misoRunOpts = { image: misoImage, registry: options.registry, registryMode: options.registryMode, skipEnvOutputPath: true, skipInfraCheck: true };
  logger.log(chalk.blue('Starting keycloak...'));
  await app.runApp('keycloak', keycloakRunOpts);
  logger.log(chalk.blue('Starting miso-controller...'));
  await app.runApp('miso-controller', misoRunOpts);
}

/**
 * Handle up-miso command: ensure infra, ensure app dirs, set secrets, resolve (preserve existing .env), run keycloak and miso-controller.
 *
 * @async
 * @function handleUpMiso
 * @param {Object} options - Commander options
 * @param {string} [options.registry] - Override registry for all apps
 * @param {string} [options.registryMode] - Override registry mode (acr|external)
 * @param {string[]|string} [options.image] - Override images e.g. keycloak=reg/k:v1, miso-controller=reg/m:v1
 * @returns {Promise<void>}
 * @throws {Error} If infra not up or any step fails
 */
async function handleUpMiso(options = {}) {
  const builderDir = await config.getAifabrixBuilderDir();
  if (builderDir) {
    process.env.AIFABRIX_BUILDER_DIR = builderDir;
  }
  logger.log(chalk.blue('Starting up-miso (keycloak + miso-controller from images)...\n'));
  // Strict: only this developer's infra (same as status), so up-miso and status agree
  const health = await infra.checkInfraHealth(undefined, { strict: true });
  const allHealthy = Object.values(health).every(status => status === 'healthy');
  if (!allHealthy) {
    throw new Error('Infrastructure is not up. Run \'aifabrix up-infra\' first.');
  }
  logger.log(chalk.green('✓ Infrastructure is up'));
  await ensureAppFromTemplate('keycloak');
  await ensureAppFromTemplate('miso-controller');
  // If envOutputPath target folder does not exist, set envOutputPath to null
  validateEnvOutputPathFolderOrNull('keycloak');
  validateEnvOutputPathFolderOrNull('miso-controller');
  // Deploy-only: do not copy .env to repo paths; patch variables so envOutputPath is null
  patchEnvOutputPathForDeployOnly('keycloak');
  patchEnvOutputPathForDeployOnly('miso-controller');
  await runMisoApps(options);
  logger.log(chalk.green('\n✓ up-miso complete. Keycloak and miso-controller are running.') +
    chalk.gray('\n  Run onboarding and register Keycloak from the miso-controller repo if needed. Use \'aifabrix up-dataplane\' for dataplane.'));
}

module.exports = { handleUpMiso, parseImageOptions };
