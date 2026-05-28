/**
 * Mode handlers for `aifabrix setup`.
 *
 * Handlers for the setup decision tree:
 *   - {@link runFreshInstall}  — no infra running: wipe volumes, wizard, up-infra, image pull, up-platform --force.
 *   - {@link runReinstall}     — down-infra -v, image pull, up-infra, up-platform --force.
 *   - {@link runWipeData}      — drop DBs/roles, image pull, up-infra, up-platform --force.
 *   - {@link runUpdateImages}  — image pull, up-infra, up-platform (no --force).
 *
 * Every handler ends with `up-infra` (idempotent, reads flags from
 * `config.yaml`) followed by `up-platform`. Optional service keys
 * (`traefik`, `pgadmin`, `redisCommander`) are written when missing so the
 * file matches effective compose defaults. Modes 1/2/3 also remove
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

const config = require('../core/config');
const infra = require('../infrastructure');
const pathsUtil = require('../utils/paths');
const logger = require('../utils/logger');
const { successGlyph } = require('../utils/cli-test-layout-chalk');
const { startSpinner, stopSpinnerSuccess } = require('./setup-spinners');
const { runSetupImageRefresh } = require('./setup-image-refresh');
const { beginSetupPlatformFlow, endSetupPlatformFlow } = require('./setup-run-context');
const { withMutedLogger } = require('../utils/with-muted-logger');
const upMiso = require('./up-miso');
const upDataplane = require('./up-dataplane');
const upCommon = require('./up-common');
const postgresWipe = require('../utils/postgres-wipe');
const postgresBootstrap = require('../utils/postgres-platform-bootstrap');
const appLib = require('../app');
const setupPrompts = require('./setup-prompts');
const { ensureSetupPlatformAuth, syncPlatformControllerUrlsInConfig } = require('./setup-platform-auth');
const { handleLogin } = require('./login');
const infraGuided = require('../cli/infra-guided');
const {
  computeEffectiveInfraOptionalFlags,
  persistMissingInfraOptionalServiceFlags
} = require('../utils/infra-optional-service-flags');

/** Builder app keys touched by `up-platform --force`. */
const PLATFORM_APPS = ['keycloak', 'miso-controller', 'dataplane'];

function formatBackupSuffix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function listNonDotEntries(dir) {
  try {
    return fs.readdirSync(dir).filter((n) => n && !String(n).startsWith('.'));
  } catch {
    return [];
  }
}

function isExistingNonEmptyDir(dir) {
  if (!fs.existsSync(dir)) return false;
  try {
    const st = fs.statSync(dir);
    if (!st || typeof st.isDirectory !== 'function' || !st.isDirectory()) return false;
  } catch {
    return false;
  }
  return listNonDotEntries(dir).length > 0;
}

function makeUniqueBackupPath(parentDir, appName, suffix) {
  const base = path.join(parentDir, `${appName}.backup-${suffix}`);
  if (!fs.existsSync(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = path.join(parentDir, `${appName}.backup-${suffix}-${i}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not create unique backup path for ${appName} under ${parentDir}`);
}

/**
 * Non-empty platform app dirs under {@link pathsUtil.getSystemBuilderRoot}.
 * @returns {{ sysRoot: string|null, apps: string[] }}
 */
function getNonEmptySystemPlatformApps() {
  let sysRoot = null;
  try {
    sysRoot = pathsUtil.getSystemBuilderRoot();
  } catch {
    return { sysRoot: null, apps: [] };
  }
  if (!sysRoot || !fs.existsSync(sysRoot)) {
    return { sysRoot, apps: [] };
  }
  const apps = [];
  for (const app of PLATFORM_APPS) {
    const p = path.join(sysRoot, app);
    if (isExistingNonEmptyDir(p)) apps.push(app);
  }
  return { sysRoot, apps };
}

function backupPlatformAppDirs(platformApps) {
  const suffix = formatBackupSuffix();
  const backedUp = [];
  for (const appName of platformApps) {
    const appDir = path.resolve(pathsUtil.getBuilderPath(appName));
    if (!isExistingNonEmptyDir(appDir)) continue;
    const parentDir = path.dirname(appDir);
    const dest = makeUniqueBackupPath(parentDir, appName, suffix);
    fs.renameSync(appDir, dest);
    backedUp.push({ appName, from: appDir, to: dest });
  }
  return backedUp;
}

function getBuilderRootEntriesOrNull() {
  const builderRoot = pathsUtil.getBuilderRoot();
  if (!fs.existsSync(builderRoot)) return null;
  let st;
  try {
    st = fs.statSync(builderRoot);
  } catch (err) {
    throw new Error(`Could not read builder folder at ${builderRoot}: ${err.message}`);
  }
  if (!st || typeof st.isDirectory !== 'function' || !st.isDirectory()) {
    throw new Error(`Builder root exists but is not a directory: ${builderRoot}`);
  }
  const entries = listNonDotEntries(builderRoot);
  if (entries.length === 0) return null;
  return { builderRoot, entries };
}

function handleBuilderDirAction(action) {
  if (action === setupPrompts.BUILDER_DIR_ACTION.ABORT) {
    logger.log(chalk.yellow('Aborted by user.'));
    return { aborted: true, backedUp: [], skipClean: false };
  }
  if (action === setupPrompts.BUILDER_DIR_ACTION.KEEP_FILES) {
    return { aborted: false, backedUp: [], skipClean: true };
  }
  if (action === setupPrompts.BUILDER_DIR_ACTION.BACKUP) {
    const backedUp = backupPlatformAppDirs(PLATFORM_APPS);
    for (const item of backedUp) {
      logger.log(
        chalk.gray(` ${successGlyph()} Backed up ${item.from} → ${path.basename(item.to)}/`)
      );
    }
    return { aborted: false, backedUp, skipClean: false };
  }
  return { aborted: false, backedUp: [], skipClean: false };
}

async function maybePromptForExistingBuilderDir({ force, skipBuilderConflictPrompt }) {
  if (force !== true || skipBuilderConflictPrompt === true) {
    return { aborted: false, backedUp: [], skipClean: false };
  }
  const existing = getBuilderRootEntriesOrNull();
  const { sysRoot, apps: systemPlatformApps } = getNonEmptySystemPlatformApps();
  if (!existing && systemPlatformApps.length === 0) {
    return { aborted: false, backedUp: [], skipClean: false };
  }
  const builderRoot = existing ? existing.builderRoot : pathsUtil.getBuilderRoot();
  const totalEntries = existing ? existing.entries.length : systemPlatformApps.length;
  const action = await setupPrompts.promptBuilderDirConflict({
    builderRoot,
    totalEntries,
    platformApps: PLATFORM_APPS,
    systemBuilderRoot: sysRoot || undefined,
    systemPlatformApps: systemPlatformApps.length ? systemPlatformApps : undefined
  });
  return handleBuilderDirAction(action);
}

/**
 * Start infrastructure using the developer's `config.yaml` flags.
 * Mirrors the relevant slice of `runUpInfraCommand` from `lib/cli/setup-infra.js`
 * without re-applying CLI flag persistence (setup passes no Commander flags).
 * After a successful start, missing `traefik` / `pgadmin` / `redisCommander`
 * keys are written to match effective {@link infra.startInfra} options.
 *
 * @async
 * @param {Object} [overrides] - Optional admin overrides (fresh install only)
 * @param {string} [overrides.adminEmail] - Override pgAdmin / Keycloak admin email
 * @param {string} [overrides.adminPassword] - Override Postgres / pgAdmin / Keycloak admin password
 * @param {Object} [overrides.passwordBundle] - Dev/pro bundle from setup wizard
 * @returns {Promise<void>}
 */
async function startInfraFromConfig(overrides = {}) {
  await config.ensureSecretsEncryptionKey();
  const cfg = await config.getConfig();
  const emailOverride = String(overrides.adminEmail || '').trim();
  const emailFromConfig = typeof cfg.adminEmail === 'string' ? cfg.adminEmail.trim() : '';
  const adminEmailMerged = emailOverride || emailFromConfig || undefined;
  const effective = computeEffectiveInfraOptionalFlags(cfg, {});
  const legacyPwd =
    overrides.passwordBundle && overrides.passwordBundle.mode === 'single'
      ? overrides.passwordBundle.password
      : overrides.adminPassword;
  await withMutedLogger(async() => {
    await infra.startInfra(null, {
      traefik: effective.traefik,
      pgadmin: effective.pgadmin,
      redisCommander: effective.redisCommander,
      adminPassword: legacyPwd,
      adminPwd: legacyPwd,
      adminEmail: adminEmailMerged,
      passwordBundle: overrides.passwordBundle,
      tlsEnabled: cfg.tlsEnabled === true
    });
  });
  await persistMissingInfraOptionalServiceFlags(cfg, effective);
}

/**
 * Run the platform after infra is up: optionally apply force config + clean
 * builder dirs, then `up-miso` followed by `up-dataplane`.
 *
 * @async
 * @param {{
 *   force?: boolean,
 *   skipBuilderConflictPrompt?: boolean,
 *   skipPrepareTemplates?: boolean,
 *   skipForceClean?: boolean,
 *   clearTokensAlways?: boolean,
 *   requireKeycloakRealm?: boolean
 * }} [opts]
 * @returns {Promise<void>}
 */
async function runUpPlatform(opts = {}) {
  const preflight = await maybePromptForExistingBuilderDir({
    force: opts.force === true,
    skipBuilderConflictPrompt: opts.skipBuilderConflictPrompt === true
  });
  if (preflight.aborted) return;

  if (opts.skipPrepareTemplates !== true) {
    await upCommon.prepareUrlsLocalRegistryForUpPlatform({ silent: opts.quiet === true });
  }
  beginSetupPlatformFlow();
  let authCtx;
  try {
    const setupAuthOpts = { applyForceConfig: opts.force === true };
    if (opts.clearTokensAlways === true) {
      setupAuthOpts.clearTokensAlways = true;
    }
    authCtx = await ensureSetupPlatformAuth(setupAuthOpts);
  } catch (authErr) {
    endSetupPlatformFlow();
    throw authErr;
  }

  let forceCleanSummary = null;
  if (opts.force === true && opts.skipForceClean !== true) {
    const cleanedApps =
      preflight.skipClean !== true
        ? await upCommon.cleanBuilderAppDirs(PLATFORM_APPS, { silent: true })
        : [];
    forceCleanSummary = { forceSummary: authCtx.forceSummary, cleanedApps };
  }

  try {
    await infraGuided.runGuidedUpPlatform(
      {
        base: true,
        platformControllerUrl: authCtx.platformControllerUrl,
        skipLoginIfAuthenticated: authCtx.skipLoginIfAuthenticated,
        requireKeycloakRealm: opts.requireKeycloakRealm === true
      },
      upMiso.handleUpMiso,
      upDataplane.handleUpDataplane,
      handleLogin,
      forceCleanSummary
    );
  } finally {
    endSetupPlatformFlow();
  }
}

/**
 * Remove `~/.aifabrix/secrets.local.yaml` if present. Never touches the
 * shared `aifabrix-secrets` file. Idempotent.
 *
 * @returns {boolean} True when a file was removed
 */
function removeUserLocalSecrets() {
  const target = pathsUtil.getPrimaryUserSecretsLocalPath();
  const { assertWritableSecretsPathForTests } = require('../utils/aifabrix-test-runtime-guard');
  assertWritableSecretsPathForTests(target);
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { force: true });
  const { isSetupQuietOutput } = require('../utils/setup-quiet-output');
  if (!isSetupQuietOutput()) {
    logger.log(chalk.gray(` ${successGlyph()} Removed ${target}`));
  }
  return true;
}

/**
 * Fresh install: wizard collects admin email + password, then AI tool keys,
 * then up-infra + up-platform.
 *
 * @async
 * @param {{ adminEmail: string, adminPassword?: string, passwordBundle?: object }} adminCreds
 * @returns {Promise<void>}
 */
async function runFreshInstall(adminCreds) {
  removeUserLocalSecrets();
  const resetSpin = startSpinner('Fresh install: clearing previous data...');
  await withMutedLogger(async() => {
    await infra.stopInfraWithVolumes();
    await infra.removeAppVolumes(PLATFORM_APPS, await config.getDeveloperId());
  });
  stopSpinnerSuccess(resetSpin, 'Previous data cleared');
  const infraSpin = startSpinner('Starting infrastructure...');
  await startInfraFromConfig({
    adminEmail: adminCreds.adminEmail,
    adminPassword: adminCreds.adminPassword,
    passwordBundle: adminCreds.passwordBundle
  });
  stopSpinnerSuccess(infraSpin, 'Infrastructure ready');
  await runSetupImageRefresh({ quiet: true });
  // Bring up infra first, then collect optional platform-level secrets (AI tool)
  // so the flow feels like a product installer: infra → platform configuration → platform services.
  await setupPrompts.promptAiTool({ silentIfConfigured: true });
  // Fresh-install should reset dev defaults (env + controller URL) the same way
  // as other setup recovery paths, otherwise the platform can come up pointed at
  // stale configuration.
  const dbSpin = startSpinner('Preparing platform databases...');
  await withMutedLogger(() => postgresBootstrap.bootstrapPlatformPostgresDatabases());
  stopSpinnerSuccess(dbSpin, 'Platform databases ready');
  await runUpPlatform({
    force: true,
    skipBuilderConflictPrompt: true,
    skipPrepareTemplates: true,
    skipForceClean: true,
    clearTokensAlways: true,
    requireKeycloakRealm: true
  });
}

/**
 * Mode 1 — Re-install: stop infra + remove all volumes, wipe local secrets,
 * then up-infra + up-platform --force.
 *
 * @async
 * @returns {Promise<void>}
 */
async function runReinstall() {
  const downSpin = startSpinner('Re-installing (removing volumes)...');
  await withMutedLogger(async() => {
    await infra.stopInfraWithVolumes();
  });
  stopSpinnerSuccess(downSpin, 'Previous data cleared');
  await syncPlatformControllerUrlsInConfig();
  removeUserLocalSecrets();
  await runSetupImageRefresh({ quiet: true });
  const adminCreds = await setupPrompts.promptAdminCredentials();
  await config.setAdminEmail(adminCreds.adminEmail);
  await setupPrompts.promptAiTool({ silentIfConfigured: true });
  const infraSpin = startSpinner('Starting infrastructure...');
  await startInfraFromConfig({
    adminEmail: adminCreds.adminEmail,
    adminPassword: adminCreds.adminPassword,
    passwordBundle: adminCreds.passwordBundle
  });
  stopSpinnerSuccess(infraSpin, 'Infrastructure ready');
  const dbSpin = startSpinner('Preparing platform databases...');
  await withMutedLogger(() => postgresBootstrap.bootstrapPlatformPostgresDatabases());
  stopSpinnerSuccess(dbSpin, 'Platform databases ready');
  await runUpPlatform({
    force: true,
    skipBuilderConflictPrompt: true,
    clearTokensAlways: true,
    requireKeycloakRealm: true
  });
}

/**
 * Stop platform app containers so the next up-platform cycle starts clean after a DB wipe.
 *
 * @async
 * @returns {Promise<void>}
 */
async function stopPlatformAppContainers() {
  const developerId = await config.getDeveloperId();
  await withMutedLogger(async() => {
    for (const appName of PLATFORM_APPS) {
      try {
        await appLib.stopAndRemoveContainer(appName, developerId, false);
      } catch {
        // Container may already be stopped.
      }
    }
  });
}

/**
 * Mode 2 — Wipe data: drop DBs and DB users, wipe local secrets, then
 * up-infra + up-platform --force. Postgres volume + admin password preserved.
 *
 * @async
 * @returns {Promise<void>}
 */
async function runWipeData() {
  const wipeSpin = startSpinner('Resetting databases and DB users...');
  await withMutedLogger(async() => {
    await postgresWipe.wipePostgresData();
    removeUserLocalSecrets();
    await stopPlatformAppContainers();
  });
  stopSpinnerSuccess(wipeSpin, 'Databases reset');
  await runSetupImageRefresh({ quiet: true });
  await setupPrompts.promptAiTool({ silentIfConfigured: true });
  const infraSpin = startSpinner('Starting infrastructure...');
  await startInfraFromConfig({});
  stopSpinnerSuccess(infraSpin, 'Infrastructure ready');
  const dbSpin = startSpinner('Preparing platform databases...');
  await withMutedLogger(() => postgresBootstrap.bootstrapPlatformPostgresDatabases());
  stopSpinnerSuccess(dbSpin, 'Platform databases ready');
  await runUpPlatform({
    force: true,
    skipBuilderConflictPrompt: true,
    clearTokensAlways: true,
    requireKeycloakRealm: true
  });
}

/**
 * Mode 3 — Update images: docker pull infra + platform images, then up-infra +
 * up-platform (no force; secrets and data preserved).
 *
 * @async
 * @returns {Promise<void>}
 */
async function runUpdateImages() {
  await runSetupImageRefresh({ quiet: true });
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
  runSetupImageRefresh,
  runFreshInstall,
  runReinstall,
  runWipeData,
  runUpdateImages
};
