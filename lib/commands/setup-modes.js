/**
 * Mode handlers for `aifabrix setup`.
 *
 * Five small handlers, one per branch of the setup decision tree:
 *   - {@link runFreshInstall}     — no infra: wizard for admin creds + AI tool, then up-infra + up-platform.
 *   - {@link runReinstall}        — Mode 1: down-infra -v, wipe local secrets, up-infra, up-platform --force.
 *   - {@link runWipeData}         — Mode 2: drop DBs/roles, wipe local secrets, up-infra, up-platform --force.
 *   - {@link runCleanInstallFiles}— Mode 3: wipe local secrets, up-infra, up-platform --force (templates re-copied).
 *   - {@link runUpdateImages}     — Mode 4: docker pull infra + platform images, up-infra, up-platform.
 *
 * Every handler ends with `up-infra` (idempotent, reads flags from
 * `config.yaml`) followed by `up-platform`. Modes 1/2/3 also remove
 * `secrets.local.yaml` so the next platform bootstrap re-resolves
 * service secrets from the catalog and re-prompts the AI tool wizard.
 *
 * @fileoverview aifabrix setup mode handlers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

const config = require('../core/config');
const infra = require('../infrastructure');
const pathsUtil = require('../utils/paths');
const logger = require('../utils/logger');
const dockerUtils = require('../utils/docker');
const dockerExec = require('../utils/docker-exec');
const {
  formatSuccessLine,
  formatProgress,
  infoLine,
  sectionTitle,
  formatDatasourceListRow,
  successGlyph
} = require('../utils/cli-test-layout-chalk');
const { withMutedLogger } = require('../utils/with-muted-logger');
const infraHelpers = require('../infrastructure/helpers');

const upMiso = require('./up-miso');
const upDataplane = require('./up-dataplane');
const upCommon = require('./up-common');
const postgresWipe = require('../utils/postgres-wipe');
const setupPrompts = require('./setup-prompts');
const { handleLogin } = require('./login');
const infraGuided = require('../cli/infra-guided');

/** Builder app keys touched by `up-platform --force`. */
const PLATFORM_APPS = ['keycloak', 'miso-controller', 'dataplane'];

function shouldUseSpinner() {
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

function startSpinner(text) {
  if (!shouldUseSpinner()) {
    logger.log(formatProgress(text));
    return null;
  }
  return ora({ text, spinner: 'dots' }).start();
}

function stopSpinnerSuccess(spinner, text) {
  if (!spinner) {
    logger.log(formatSuccessLine(text));
    return;
  }
  spinner.succeed(text);
}

/**
 * Start infrastructure using the developer's `config.yaml` flags.
 * Mirrors the relevant slice of `runUpInfraCommand` from `lib/cli/setup-infra.js`
 * without re-applying CLI flag persistence (we never receive flags here).
 *
 * @async
 * @param {Object} [overrides] - Optional admin overrides (fresh install only)
 * @param {string} [overrides.adminEmail] - Override pgAdmin / Keycloak admin email
 * @param {string} [overrides.adminPassword] - Override Postgres / pgAdmin / Keycloak admin password
 * @returns {Promise<void>}
 */
async function startInfraFromConfig(overrides = {}) {
  await config.ensureSecretsEncryptionKey();
  const cfg = await config.getConfig();
  await withMutedLogger(async() => {
    await infra.startInfra(null, {
      traefik: cfg.traefik === true,
      pgadmin: cfg.pgadmin !== false,
      redisCommander: cfg.redisCommander !== false,
      adminPassword: overrides.adminPassword,
      adminPwd: overrides.adminPassword,
      adminEmail: overrides.adminEmail,
      tlsEnabled: cfg.tlsEnabled === true
    });
  });
}

/**
 * Run the platform after infra is up: optionally apply force config + clean
 * builder dirs, then `up-miso` followed by `up-dataplane`.
 *
 * @async
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<void>}
 */
async function runUpPlatform(opts = {}) {
  let forceCleanSummary = null;
  if (opts.force === true) {
    const forceSummary = await upCommon.applyUpPlatformForceConfig({ silent: true });
    const cleanedApps = await upCommon.cleanBuilderAppDirs(PLATFORM_APPS, { silent: true });
    forceCleanSummary = { forceSummary, cleanedApps };
  }
  // Reuse the same guided UX as `aifabrix up-platform` (keycloak → miso → auth → dataplane → footer).
  await infraGuided.runGuidedUpPlatform({}, upMiso.handleUpMiso, upDataplane.handleUpDataplane, handleLogin, forceCleanSummary);
}

/**
 * Remove `~/.aifabrix/secrets.local.yaml` if present. Never touches the
 * shared `aifabrix-secrets` file. Idempotent.
 *
 * @returns {boolean} True when a file was removed
 */
function removeUserLocalSecrets() {
  const target = pathsUtil.getPrimaryUserSecretsLocalPath();
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { force: true });
  logger.log(chalk.gray(` ${successGlyph()} Removed ${target}`));
  return true;
}

/**
 * Pull infra-compose images (postgres, redis, optional pgadmin/redis-commander/traefik).
 * Best-effort: warns and continues when the compose file is missing.
 *
 * @async
 * @returns {Promise<void>}
 */
async function pullInfraImages() {
  const devId = await config.getDeveloperId();
  const infraDir = path.join(pathsUtil.getAifabrixSystemDir(), infraHelpers.getInfraDirName(devId));
  const composePath = path.join(infraDir, 'compose.yaml');
  if (!fs.existsSync(composePath)) {
    logger.log(chalk.yellow(`No infra compose file at ${composePath}; skipping image pull.`));
    return;
  }
  const project = infraHelpers.getInfraProjectName(devId);
  const composeCmd = await dockerUtils.getComposeCommand();
  logger.log('');
  logger.log(sectionTitle('Pull images'));
  const spin = startSpinner('Pulling infrastructure images...');
  await dockerExec.execWithDockerEnv(`${composeCmd} -f "${composePath}" -p ${project} pull`, { cwd: infraDir });
  stopSpinnerSuccess(spin, 'Infrastructure images pulled');
}

/**
 * Pull a single platform app image based on `builder/<appName>/application.yaml`.
 * Tolerates missing config / unresolvable images by warning and continuing.
 *
 * @async
 * @param {string} appName
 * @returns {Promise<void>}
 */
async function pullPlatformAppImage(appName) {
  let imageRef = '';
  try {
    const { loadConfigFile } = require('../utils/config-format');
    const builderPath = pathsUtil.getBuilderPath(appName);
    const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
    const cfg = loadConfigFile(configPath) || {};
    const deploy = cfg.deploy || {};
    if (typeof deploy.image === 'string' && deploy.image.trim()) {
      imageRef = deploy.image.trim();
    }
  } catch {
    imageRef = '';
  }
  if (!imageRef) {
    logger.log(formatDatasourceListRow('skipped', appName, 'no image ref'));
    return;
  }
  try {
    const spin = startSpinner(`Pulling ${appName} image...`);
    await dockerExec.execWithDockerEnv(`docker pull ${imageRef}`);
    stopSpinnerSuccess(spin, `Pulled ${appName} image`);
  } catch (err) {
    logger.log(chalk.yellow(`Could not pull ${imageRef}: ${err.message}`));
  }
}

/** Pull every platform app image. */
async function pullPlatformImages() {
  for (const appName of PLATFORM_APPS) {
    await pullPlatformAppImage(appName);
  }
}

/**
 * Fresh install: wizard collects admin email + password, then AI tool keys,
 * then up-infra + up-platform.
 *
 * @async
 * @param {{ adminEmail: string, adminPassword: string }} adminCreds
 * @returns {Promise<void>}
 */
async function runFreshInstall(adminCreds) {
  logger.log(infoLine('Setup: fresh install'));
  const infraSpin = startSpinner('Starting infrastructure...');
  await startInfraFromConfig({
    adminEmail: adminCreds.adminEmail,
    adminPassword: adminCreds.adminPassword
  });
  stopSpinnerSuccess(infraSpin, 'Infrastructure ready');
  // Bring up infra first, then collect optional platform-level secrets (AI tool)
  // so the flow feels like a product installer: infra → platform configuration → platform services.
  await setupPrompts.promptAiTool({ silentIfConfigured: true });
  // Fresh-install should reset dev defaults (env + controller URL) the same way
  // as other setup recovery paths, otherwise the platform can come up pointed at
  // stale configuration.
  await runUpPlatform({ force: true });
}

/**
 * Mode 1 — Re-install: stop infra + remove all volumes, wipe local secrets,
 * then up-infra + up-platform --force.
 *
 * @async
 * @returns {Promise<void>}
 */
async function runReinstall() {
  logger.log(infoLine('Setup: re-install (volumes will be removed)'));
  const downSpin = startSpinner('Stopping infrastructure (down-infra -v)...');
  await withMutedLogger(async() => {
    await infra.stopInfraWithVolumes();
  });
  stopSpinnerSuccess(downSpin, 'Infrastructure stopped and volumes removed');
  removeUserLocalSecrets();
  await setupPrompts.promptAiTool({ silentIfConfigured: true });
  const infraSpin = startSpinner('Starting infrastructure...');
  await startInfraFromConfig({});
  stopSpinnerSuccess(infraSpin, 'Infrastructure ready');
  await runUpPlatform({ force: true });
}

/**
 * Mode 2 — Wipe data: drop DBs and DB users, wipe local secrets, then
 * up-infra + up-platform --force. Postgres volume + admin password preserved.
 *
 * @async
 * @returns {Promise<void>}
 */
async function runWipeData() {
  logger.log(infoLine('Setup: wipe data (databases and DB users)'));
  await postgresWipe.wipePostgresData();
  removeUserLocalSecrets();
  await setupPrompts.promptAiTool({ silentIfConfigured: true });
  const infraSpin = startSpinner('Starting infrastructure...');
  await startInfraFromConfig({});
  stopSpinnerSuccess(infraSpin, 'Infrastructure ready');
  await runUpPlatform({ force: true });
}

/**
 * Mode 3 — Clean install files: wipe local secrets, then up-infra +
 * up-platform --force (which removes builder/<keycloak|miso-controller|dataplane>
 * and re-fetches from templates).
 *
 * @async
 * @returns {Promise<void>}
 */
async function runCleanInstallFiles() {
  logger.log(infoLine('Setup: clean installation files and re-install platform services'));
  removeUserLocalSecrets();
  await setupPrompts.promptAiTool({ silentIfConfigured: true });
  const infraSpin = startSpinner('Starting infrastructure...');
  await startInfraFromConfig({});
  stopSpinnerSuccess(infraSpin, 'Infrastructure ready');
  await runUpPlatform({ force: true });
}

/**
 * Mode 4 — Update images: docker pull infra + platform images, then up-infra +
 * up-platform (no force; secrets and data preserved).
 *
 * @async
 * @returns {Promise<void>}
 */
async function runUpdateImages() {
  logger.log(infoLine('Setup: update docker images'));
  await pullInfraImages();
  await pullPlatformImages();
  await setupPrompts.promptAiTool({ silentIfConfigured: true });
  const infraSpin = startSpinner('Starting infrastructure...');
  await startInfraFromConfig({});
  stopSpinnerSuccess(infraSpin, 'Infrastructure ready');
  await runUpPlatform({ force: false });
}

module.exports = {
  PLATFORM_APPS,
  startInfraFromConfig,
  runUpPlatform,
  removeUserLocalSecrets,
  pullInfraImages,
  pullPlatformImages,
  runFreshInstall,
  runReinstall,
  runWipeData,
  runCleanInstallFiles,
  runUpdateImages
};
