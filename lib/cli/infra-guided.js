/**
 * @fileoverview Guided (non-verbose) UX for infra/platform commands.
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const devConfig = require('../utils/dev-config');
const pathsUtil = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');
const { computeAppBaseUrl, resolvePlatformControllerUrl } = require('../utils/platform-controller-url');
const { withMutedLogger } = require('../utils/with-muted-logger');
const { formatProgress, formatSuccessLine, successGlyph } = require('../utils/cli-test-layout-chalk');
const ora = require('ora');
const infra = require('../infrastructure');
const { execWithDockerEnv } = require('../utils/docker-exec');
const { getLogLevel, passesLevelFilter } = require('../commands/app-logs');
const { handleLogin } = require('../commands/login');
const {
  resolveGuidedAuthControllerUrl,
  runGuidedAuthStep,
  runGuidedDataplaneWithAuthRecovery
} = require('./infra-guided-auth');
const healthCheck = require('../utils/health-check');
const { prepareUrlsLocalRegistryForUpPlatform } = require('../commands/up-common');
const { assertDevInfraUp } = require('../commands/dev-infra-gate');
const {
  emitSystemBuilderAppManifestLineIfTTY
} = require('../utils/manifest-source-emit');

const SEPARATOR = '────────────────────────────────────────';

function title(text) {
  return chalk.bold(text);
}

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

async function getRunningContainerNameForApp(appName) {
  const apps = await infra.getAppStatus();
  const hit = (apps || []).find(a => a && a.name === appName && a.container);
  return hit ? hit.container : null;
}

async function hasErrorLogs(appName, opts = {}) {
  const tailLines = Number.isFinite(opts.tailLines) ? opts.tailLines : 200;
  const container = await getRunningContainerNameForApp(appName);
  if (!container) return false;
  const { stdout } = await execWithDockerEnv(`docker logs --tail ${tailLines} ${container}`);
  const lines = String(stdout || '').split('\n');
  return lines.some(line => passesLevelFilter(getLogLevel(line), 'error'));
}

async function validateAppErrorLogs(appNames) {
  const names = Array.isArray(appNames) ? appNames : [];
  const bad = [];
  for (const name of names) {
    try {
      const hasErrors = await hasErrorLogs(name, { tailLines: 300 });
      if (hasErrors) {
        bad.push(name);
      }
    } catch {
      // ignore per-app log failures
    }
  }
  if (bad.length === 0) {
    return;
  }
  logger.log(chalk.yellow('⚠ Some services reported error logs'));
  for (const name of bad) {
    logger.log(chalk.gray(`  Run: aifabrix logs ${name} -l error`));
  }
  logger.log('');
}

async function waitForAppReady(appName, opts = {}) {
  const timeoutSeconds = Number.isFinite(opts.timeoutSeconds) ? opts.timeoutSeconds : 90;
  const builderPath = pathsUtil.getBuilderPath(appName);
  const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
  const appConfig = loadConfigFile(configPath) || {};

  const apps = await infra.getAppStatus();
  const hit = (apps || []).find(a => a && a.name === appName && typeof a.url === 'string');
  const portMatch = hit && hit.url ? hit.url.match(/:(\d+)$/) : null;
  const hostPort = portMatch ? parseInt(portMatch[1], 10) : null;
  if (!hostPort) {
    throw new Error(`Could not determine host port for ${appName}`);
  }

  const userCfg = await config.getConfig();
  const healthRunOpts = { profile: 'docker' };
  if (userCfg && userCfg.traefik === true) {
    healthRunOpts.traefikEnabled = true;
  }
  await healthCheck.waitForHealthCheck(appName, timeoutSeconds, hostPort, appConfig, false, healthRunOpts);
}

function resolveInfraHost(remoteServer) {
  const raw = String(remoteServer || '').trim().replace(/\/+$/, '');
  if (!raw) return 'localhost';
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
    const u = new URL(withScheme);
    return u.hostname || 'localhost';
  } catch {
    // Fallback for non-URL strings.
    return raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0] || 'localhost';
  }
}

/**
 * Prefer stored platform controller URL, then compute from routing rules.
 * @async
 * @returns {Promise<string>}
 */
async function resolvePlatformControllerUrlForDisplay() {
  const stored = await config.getPlatformControllerUrl();
  if (stored) {
    return stored;
  }
  return resolvePlatformControllerUrl();
}

function logSection(label, value) {
  logger.log(title(label));
  logger.log(`  ${value}`);
  logger.log('');
}

function logFooterStart(label) {
  logger.log('');
  logger.log(SEPARATOR);
  logger.log(title(label));
  logger.log(SEPARATOR);
  logger.log('');
}

function logFooterEnd() {
  logger.log(SEPARATOR);
}

async function logPlatformReadyFooter() {
  const [controllerUrl, dataplaneUrl, keycloakUrl] = await Promise.all([
    resolvePlatformControllerUrlForDisplay(),
    computeAppBaseUrl('dataplane'),
    computeAppBaseUrl('keycloak')
  ]);
  const cfg = await config.getConfig();
  const env = (cfg && cfg.environment) ? cfg.environment : 'dev';

  logFooterStart('Platform Ready');
  logSection('Environment', env);
  logSection('Miso Controller', controllerUrl);
  logSection('Dataplane (DEV)', dataplaneUrl);
  logSection('Keycloak', keycloakUrl);
  logSection('API Documentation', `${dataplaneUrl}/api/docs`);
  logSection('Knowledge Base', 'https://docs.aifabrix.ai');
  logSection('Getting Started', 'https://docs.aifabrix.ai/get-started');
  logFooterEnd();
}

async function logMisoReadyFooter() {
  const [controllerUrl, keycloakUrl] = await Promise.all([
    resolvePlatformControllerUrlForDisplay(),
    computeAppBaseUrl('keycloak')
  ]);
  logFooterStart('Miso Ready');
  logSection('Miso Controller', controllerUrl);
  logSection('Keycloak', keycloakUrl);
  logFooterEnd();
}

async function logDataplaneReadyFooter() {
  const dataplaneUrl = await computeAppBaseUrl('dataplane');
  const cfg = await config.getConfig();
  const env = (cfg && cfg.environment) ? cfg.environment : 'dev';
  logFooterStart('Dataplane Ready');
  logSection('Environment', env);
  logSection('Dataplane (DEV)', dataplaneUrl);
  logSection('API Documentation', `${dataplaneUrl}/api/docs`);
  logFooterEnd();
}

async function getInfraHostAndPorts() {
  const developerId = await config.getDeveloperId();
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const ports = devConfig.getDevPorts(idNum);
  const cfg = await config.getConfig();
  const traefikOn = Boolean(cfg && cfg.traefik === true);
  const remoteServer = traefikOn ? await config.getRemoteServer() : null;
  const host = resolveInfraHost(remoteServer);
  return { idNum, ports, host };
}

async function runGuidedUpInfra(options, runUpInfraCommand) {
  logger.log('');
  logger.log(title('AI Fabrix Infrastructure Setup'));
  logger.log(SEPARATOR);
  logger.log('');
  const spin = startSpinner('Starting infrastructure services...');
  await withMutedLogger(() => runUpInfraCommand(options), {
    allow: (msg) => {
      if (typeof msg !== 'string') return false;
      return (
        msg.includes('✔ Developer ID set to') ||
        msg.includes('✔ Traefik enabled and saved to config') ||
        msg.includes('✔ Traefik disabled and saved to config') ||
        msg.includes('✔ pgAdmin enabled and saved to config') ||
        msg.includes('✔ pgAdmin disabled and saved to config') ||
        msg.includes('✔ Redis Commander enabled and saved to config') ||
        msg.includes('✔ Redis Commander disabled and saved to config')
      );
    }
  });
  stopSpinnerSuccess(spin, 'Infrastructure ready');

  const [{ idNum, ports, host }, cfg] = await Promise.all([
    getInfraHostAndPorts(),
    config.getConfig()
  ]);

  logFooterStart('Infra Ready');
  logSection('Developer', `dev${String(idNum).padStart(2, '0')} (id: ${idNum})`);
  logSection('Postgres', `${host}:${ports.postgres}`);
  logSection('Redis', `${host}:${ports.redis}`);
  if (cfg.pgadmin !== false) logSection('pgAdmin', `http://${host}:${ports.pgadmin}`);
  if (cfg.redisCommander !== false) logSection('Redis Commander', `http://${host}:${ports.redisCommander}`);
  if (cfg.traefik) logSection('Traefik', `http://${host}:${ports.traefikHttp}`);
  if (cfg.tlsEnabled === true) logSection('TLS mode', 'on');
  logFooterEnd();
}

async function runGuidedUpMiso(options, handleUpMiso) {
  logger.log('');
  logger.log(title('AI Fabrix Platform Setup'));
  logger.log(SEPARATOR);
  logger.log('');
  logPlatformSetupDurationHint('platform');
  logger.log('');
  const kcSpin = startSpinner('Starting Keycloak...');
  await withMutedLogger(() => handleUpMiso({ ...options, platformInstall: true }));
  stopSpinnerSuccess(kcSpin, 'Keycloak ready');
  logger.log('');
  const mcSpin = startSpinner('Starting Miso Controller...');
  await waitForAppReady('miso-controller', { timeoutSeconds: 120 });
  stopSpinnerSuccess(mcSpin, 'Miso Controller ready');
  await logMisoReadyFooter();
  await validateAppErrorLogs(['miso-controller']);
}

async function runGuidedUpDataplane(options, handleUpDataplane) {
  logger.log('');
  logger.log(title('AI Fabrix Dataplane Setup'));
  logger.log(SEPARATOR);
  logger.log('');
  logPlatformSetupDurationHint('dataplane');
  logger.log('');
  // Infra must be checked before auth: device login talks to the controller, which needs
  // Postgres/Redis when the controller runs locally — a down infra looks like "network error".
  const infraSpin = startSpinner('Checking infrastructure...');
  try {
    await assertDevInfraUp({ quietSuccess: true });
    stopSpinnerSuccess(infraSpin, 'Infrastructure is up');
  } catch (infraErr) {
    // Match up-miso: one error block from handleCommandError only (no spinner.fail / extra hints).
    if (infraSpin) infraSpin.stop();
    throw infraErr;
  }
  // Avoid an outer long-running spinner here: up-dataplane has multiple internal
  // phases and may print some output. An outer spinner causes "spinner over spinner"
  // rendering artifacts. Instead, do the same single auth step as up-platform, then
  // show one spinner for the dataplane install/run phase.
  await runGuidedAuthStep(handleLogin, {}, { startSpinner, stopSpinnerSuccess });

  logger.log('');
  emitSystemBuilderAppManifestLineIfTTY(logger, 'dataplane');
  const dpSpin = startSpinner('Starting Dataplane...');
  await withMutedLogger(() =>
    handleUpDataplane({ ...options, platformInstall: true, skipInfraCheck: true })
  );
  stopSpinnerSuccess(dpSpin, 'Dataplane ready');
  await refreshDataplaneVersionAfterPlatformInstall();
  await validateAppErrorLogs(['dataplane']);
  await logDataplaneReadyFooter();
}

/**
 * Guided-mode summary after `up-platform --force` (printed under the platform header).
 * @param {{ deviceCleared: number, clientCleared: number, environment: string, defaultControllerUrl: string }} forceSummary
 * @param {string[]} cleanedApps
 */
function logUpPlatformForceCleanSummary(forceSummary, cleanedApps) {
  const { isSetupQuietOutput } = require('../utils/setup-quiet-output');
  if (isSetupQuietOutput()) return;
  const check = successGlyph();
  logger.log(chalk.bold('Clean installation files'));
  logger.log(
    chalk.gray(
      ` ${check} Cleared ${forceSummary.deviceCleared} device token(s) and ${forceSummary.clientCleared} client token(s)`
    )
  );
  logger.log(chalk.gray(` ${check} Environment set to ${forceSummary.environment}`));
  logger.log(
    chalk.gray(
      ` ${check} Default controller set to ${forceSummary.defaultControllerUrl} (run aifabrix login after platform is up)`
    )
  );
  for (const appName of cleanedApps || []) {
    logger.log(chalk.gray(` ${check} Cleaned builder/${appName}`));
  }
  logger.log('');
}

/**
 * Yellow notice before long-running platform/dataplane install steps (setup and guided up-*).
 * @param {'platform'|'dataplane'} [scope]
 */
function logPlatformSetupDurationHint(scope = 'platform') {
  const line =
    scope === 'dataplane'
      ? 'Installation may take a few minutes. Authenticating and starting Dataplane — please wait.'
      : 'Installation may take a few minutes. Keycloak, Miso Controller, and Dataplane are starting — please wait.';
  logger.log(chalk.yellow(`⚠ ${line}`));
}

function logGuidedPlatformSetupHeader() {
  logger.log('');
  logger.log(title('AI Fabrix Platform Setup'));
  logger.log(SEPARATOR);
  logger.log('');
  logPlatformSetupDurationHint('platform');
  logger.log('');
}

async function refreshDataplaneVersionAfterPlatformInstall() {
  try {
    const { tryRefreshDataplaneVersionAfterLogin } = require('../commands/auth-status-dataplane-version');
    const controllerUrl = await resolvePlatformControllerUrlForDisplay();
    await tryRefreshDataplaneVersionAfterLogin(controllerUrl, {});
  } catch {
    // best-effort only
  }
}

async function runGuidedKeycloakAndMisoControllerPhase(options, handleUpMiso) {
  emitSystemBuilderAppManifestLineIfTTY(logger, 'keycloak');
  const kcSpin = startSpinner('Starting Keycloak...');
  await withMutedLogger(() => handleUpMiso({ ...options, platformInstall: true }));
  stopSpinnerSuccess(kcSpin, 'Keycloak ready');
  logger.log('');
  emitSystemBuilderAppManifestLineIfTTY(logger, 'miso-controller');
  const mcSpin = startSpinner('Starting Miso Controller...');
  await waitForAppReady('miso-controller', { timeoutSeconds: 120 });
  stopSpinnerSuccess(mcSpin, 'Miso Controller ready');
  logger.log('');
}

async function runGuidedDataplaneInstallPhase(options, handleUpDataplane, handleLoginFn, controllerUrl) {
  logger.log('');
  emitSystemBuilderAppManifestLineIfTTY(logger, 'dataplane');
  const dpSpin = startSpinner('Starting Dataplane...');
  await runGuidedDataplaneWithAuthRecovery(options, handleUpDataplane, handleLoginFn, controllerUrl);
  stopSpinnerSuccess(dpSpin, 'Dataplane ready');
  await refreshDataplaneVersionAfterPlatformInstall();
}

async function runGuidedUpPlatform(options, handleUpMiso, handleUpDataplane, handleLogin, forceCleanSummary = null) {
  logGuidedPlatformSetupHeader();
  if (forceCleanSummary && forceCleanSummary.forceSummary) {
    logUpPlatformForceCleanSummary(forceCleanSummary.forceSummary, forceCleanSummary.cleanedApps);
  }

  const authOpts = {
    platformControllerUrl: options && options.platformControllerUrl,
    skipLoginIfAuthenticated: options && options.skipLoginIfAuthenticated === true
  };

  await withMutedLogger(() => prepareUrlsLocalRegistryForUpPlatform());
  await runGuidedKeycloakAndMisoControllerPhase(options, handleUpMiso);
  if (options && options.requireKeycloakRealm === true) {
    const { waitForKeycloakRealmReady } = require('../utils/keycloak-realm-ready');
    const realmSpin = startSpinner('Waiting for Keycloak realm (aifabrix)...');
    await waitForKeycloakRealmReady({ timeoutSeconds: 180 });
    stopSpinnerSuccess(realmSpin, 'Keycloak realm ready');
  }
  await runGuidedAuthStep(handleLogin, authOpts, { startSpinner, stopSpinnerSuccess });
  const controllerUrl = await resolveGuidedAuthControllerUrl(authOpts);
  await runGuidedDataplaneInstallPhase(options, handleUpDataplane, handleLogin, controllerUrl);
  await validateAppErrorLogs(['miso-controller', 'dataplane']);
  await logPlatformReadyFooter();
}

function logStoppedServices(cfg) {
  logger.log(title('Stopped'));
  logger.log('  postgres');
  logger.log('  redis');
  if (cfg.pgadmin !== false) logger.log('  pgadmin');
  if (cfg.redisCommander !== false) logger.log('  redis-commander');
  if (cfg.traefik) logger.log('  traefik');
  logger.log('');
}

async function runGuidedDownInfra(appName, options, infra, appLib) {
  logger.log('');
  logger.log(title('AI Fabrix Shutdown'));
  logger.log(SEPARATOR);
  logger.log('');

  const spin = startSpinner('Stopping infrastructure...');
  await withMutedLogger(async() => {
    if (typeof appName === 'string' && appName.trim().length > 0) {
      await appLib.downApp(appName, { volumes: !!options.volumes });
      return;
    }
    if (options.volumes) await infra.stopInfraWithVolumes();
    else await infra.stopInfra();
  });
  stopSpinnerSuccess(spin, 'Infrastructure stopped');

  const developerId = await config.getDeveloperId();
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const cfg = await config.getConfig();

  logFooterStart('Stopped');
  logSection('Developer', `dev${String(idNum).padStart(2, '0')} (id: ${idNum})`);
  logStoppedServices(cfg);
  if (options.volumes) {
    logger.log(chalk.yellow('⚠ Volumes removed: all local data deleted'));
    logger.log('');
  }
  logFooterEnd();
}

module.exports = {
  runGuidedUpInfra,
  runGuidedUpMiso,
  runGuidedUpDataplane,
  runGuidedUpPlatform,
  runGuidedDownInfra
};

