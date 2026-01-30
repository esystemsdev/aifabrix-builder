/**
 * AI Fabrix Builder - Up Miso Command
 *
 * Installs keycloak, miso-controller, and dataplane from images (no build).
 * Assumes infra is up; sets dev secrets and resolves (no force; existing .env values preserved).
 *
 * @fileoverview up-miso command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const secrets = require('../core/secrets');
const infra = require('../infrastructure');
const app = require('../app');
const { saveLocalSecret } = require('../utils/local-secrets');
const { ensureAppFromTemplate } = require('./up-common');

/** Keycloak base port (from templates/applications/keycloak/variables.yaml) */
const KEYCLOAK_BASE_PORT = 8082;
/** Miso controller base port (dev-config app base) */
const MISO_BASE_PORT = 3000;
/** Dataplane base port (from templates/applications/dataplane/variables.yaml) */
const _DATAPLANE_BASE_PORT = 3001;

/**
 * Parse --image options array into map { keycloak?: string, 'miso-controller'?: string, dataplane?: string }
 * @param {string[]|string} imageOpts - Option value(s) e.g. ['keycloak=reg/k:v1', 'miso-controller=reg/m:v1', 'dataplane=reg/d:v1']
 * @returns {{ keycloak?: string, 'miso-controller'?: string, dataplane?: string }}
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
 * Build full image ref from registry and app variables (registry/name:tag)
 * @param {string} appName - keycloak, miso-controller, or dataplane
 * @param {string} registry - Registry URL
 * @returns {string} Full image reference
 */
function buildImageRefFromRegistry(appName, registry) {
  const pathsUtil = require('../utils/paths');
  const variablesPath = path.join(pathsUtil.getBuilderPath(appName), 'variables.yaml');
  if (!fs.existsSync(variablesPath)) return undefined;
  const content = fs.readFileSync(variablesPath, 'utf8');
  const variables = yaml.load(content);
  const name = variables?.image?.name || variables?.app?.key || appName;
  const tag = variables?.image?.tag || 'latest';
  const base = (registry || '').replace(/\/+$/, '');
  return base ? `${base}/${name}:${tag}` : undefined;
}

/**
 * Set URL secrets and resolve keycloak + miso-controller + dataplane (no force; existing .env preserved)
 * @async
 * @param {number} devIdNum - Developer ID number
 */
async function setMisoSecretsAndResolve(devIdNum) {
  const keycloakPort = KEYCLOAK_BASE_PORT + (devIdNum === 0 ? 0 : devIdNum * 100);
  const misoPort = MISO_BASE_PORT + (devIdNum === 0 ? 0 : devIdNum * 100);
  await saveLocalSecret('keycloak-public-server-urlKeyVault', `http://localhost:${keycloakPort}`);
  await saveLocalSecret('miso-controller-web-server-url', `http://localhost:${misoPort}`);
  logger.log(chalk.green('✓ Set keycloak and miso-controller URL secrets'));
  await secrets.generateEnvFile('keycloak', undefined, 'docker', false, true);
  await secrets.generateEnvFile('miso-controller', undefined, 'docker', false, true);
  await secrets.generateEnvFile('dataplane', undefined, 'docker', false, true);
  logger.log(chalk.green('✓ Resolved keycloak, miso-controller, and dataplane'));
}

/**
 * Build run options and run keycloak, miso-controller, then dataplane
 * @async
 * @param {Object} options - Commander options (image, registry, registryMode)
 */
async function runMisoApps(options) {
  const imageMap = parseImageOptions(options.image);
  const keycloakImage = imageMap.keycloak || (options.registry ? buildImageRefFromRegistry('keycloak', options.registry) : undefined);
  const misoImage = imageMap['miso-controller'] || (options.registry ? buildImageRefFromRegistry('miso-controller', options.registry) : undefined);
  const dataplaneImage = imageMap.dataplane || (options.registry ? buildImageRefFromRegistry('dataplane', options.registry) : undefined);
  const keycloakRunOpts = { image: keycloakImage, registry: options.registry, registryMode: options.registryMode, skipEnvOutputPath: true, skipInfraCheck: true };
  const misoRunOpts = { image: misoImage, registry: options.registry, registryMode: options.registryMode, skipEnvOutputPath: true, skipInfraCheck: true };
  const dataplaneRunOpts = { image: dataplaneImage, registry: options.registry, registryMode: options.registryMode, skipEnvOutputPath: true, skipInfraCheck: true };
  logger.log(chalk.blue('Starting keycloak...'));
  await app.runApp('keycloak', keycloakRunOpts);
  logger.log(chalk.blue('Starting miso-controller...'));
  await app.runApp('miso-controller', misoRunOpts);
  logger.log(chalk.blue('Starting dataplane...'));
  await app.runApp('dataplane', dataplaneRunOpts);
}

/**
 * Handle up-miso command: ensure infra, ensure app dirs, set secrets, resolve (preserve existing .env), run keycloak, miso-controller, then dataplane.
 *
 * @async
 * @function handleUpMiso
 * @param {Object} options - Commander options
 * @param {string} [options.registry] - Override registry for all apps
 * @param {string} [options.registryMode] - Override registry mode (acr|external)
 * @param {string[]|string} [options.image] - Override images e.g. keycloak=reg/k:v1, miso-controller=reg/m:v1, dataplane=reg/d:v1
 * @returns {Promise<void>}
 * @throws {Error} If infra not up or any step fails
 */
async function handleUpMiso(options = {}) {
  const builderDir = await config.getAifabrixBuilderDir();
  if (builderDir) {
    process.env.AIFABRIX_BUILDER_DIR = builderDir;
  }
  logger.log(chalk.blue('Starting up-miso (keycloak + miso-controller + dataplane from images)...\n'));
  // Strict: only this developer's infra (same as status), so up-miso and status agree
  const health = await infra.checkInfraHealth(undefined, { strict: true });
  const allHealthy = Object.values(health).every(status => status === 'healthy');
  if (!allHealthy) {
    throw new Error('Infrastructure is not up. Run \'aifabrix up\' first.');
  }
  logger.log(chalk.green('✓ Infrastructure is up'));
  await ensureAppFromTemplate('keycloak');
  await ensureAppFromTemplate('miso-controller');
  await ensureAppFromTemplate('dataplane');
  const developerId = await config.getDeveloperId();
  const devIdNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  await setMisoSecretsAndResolve(devIdNum);
  await runMisoApps(options);
  logger.log(chalk.green('\n✓ up-miso complete. Keycloak, miso-controller, and dataplane are running.'));
  logger.log(chalk.gray('  Run onboarding and register Keycloak from the miso-controller repo if needed.'));
}

module.exports = { handleUpMiso, parseImageOptions };
