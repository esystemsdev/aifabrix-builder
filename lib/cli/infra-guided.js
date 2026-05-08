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
const { resolveControllerUrl } = require('../utils/controller-url');
const { withMutedLogger } = require('../utils/with-muted-logger');
const { formatBlockingError, formatProgress, formatSuccessLine } = require('../utils/cli-test-layout-chalk');
const { computePublicUrlBaseString } = require('../utils/url-declarative-public-base');
const { joinUrlPath, normalizeFrontDoorPatternForHealth } = require('../utils/health-check-url');
const ora = require('ora');
const infra = require('../infrastructure');
const { execWithDockerEnv } = require('../utils/docker-exec');
const { getLogLevel, passesLevelFilter } = require('../commands/app-logs');
const healthCheck = require('../utils/health-check');

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
  const results = await Promise.all(
    names.map(async(name) => {
      try {
        const hasErrors = await hasErrorLogs(name, { tailLines: 300 });
        return { name, hasErrors };
      } catch {
        return { name, hasErrors: false };
      }
    })
  );
  const bad = results.filter(r => r && r.hasErrors);
  if (bad.length === 0) return;

  logger.log(chalk.yellow('⚠ Some services reported error logs'));
  for (const r of bad) {
    logger.log(chalk.gray(`  Run: aifabrix logs ${r.name} -l error`));
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

  await healthCheck.waitForHealthCheck(appName, timeoutSeconds, hostPort, appConfig, false, { profile: 'docker' });
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

async function computeAppBaseUrl(appName) {
  const builderPath = pathsUtil.getBuilderPath(appName);
  const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
  const variables = loadConfigFile(configPath) || {};
  const basePort = Number(variables.port || 3000);
  const developerIdRaw = await config.getDeveloperId();
  const developerIdNum = typeof developerIdRaw === 'string' ? parseInt(developerIdRaw, 10) : developerIdRaw;
  const userCfg = await config.getConfig();
  const remoteServer = await config.getRemoteServer();
  const infraTlsEnabled = Boolean(userCfg && userCfg.tlsEnabled);

  const fd = variables.frontDoorRouting || null;
  const frontDoorEnabled = Boolean(fd && fd.enabled === true);
  const traefikOn = Boolean(userCfg && userCfg.traefik);
  const pathActive = Boolean(traefikOn && frontDoorEnabled);

  const publicBase = computePublicUrlBaseString({
    traefik: traefikOn,
    pathActive,
    hostTemplate: fd ? fd.host : null,
    tls: fd ? fd.tls : true,
    developerIdRaw,
    remoteServer,
    // These guided bootstrap commands start services via Docker Compose, so we want the
    // docker-published host port (no workstation +10 offset).
    profile: 'docker',
    listenPort: basePort,
    developerIdNum,
    infraTlsEnabled
  });

  if (pathActive) {
    const mount = normalizeFrontDoorPatternForHealth(fd.pattern);
    return joinUrlPath(publicBase, mount);
  }

  // No Traefik front-door routing: publicBase already includes correct scheme/host/port (localhost or remote-server).
  return String(publicBase).replace(/\/+$/, '');
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
    resolveControllerUrl(),
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
    resolveControllerUrl(),
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
  const remoteServer = await config.getRemoteServer();
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
  const authSpin = startSpinner('Authenticating...');
  await withMutedLogger(() => handleUpDataplane({ ...options, platformInstall: true }));
  // Compact device-login prints its own success line.
  if (authSpin) authSpin.stop();
  logger.log('');
  const dpSpin = startSpinner('Starting Dataplane...');
  stopSpinnerSuccess(dpSpin, 'Dataplane ready');
  await validateAppErrorLogs(['dataplane']);
  await logDataplaneReadyFooter();
}

/**
 * Guided-mode summary after `up-platform --force` (printed under the platform header).
 * @param {{ deviceCleared: number, clientCleared: number, environment: string, defaultControllerUrl: string }} forceSummary
 * @param {string[]} cleanedApps
 */
function logUpPlatformForceCleanSummary(forceSummary, cleanedApps) {
  const check = chalk.green('✔');
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

function logGuidedPlatformSetupHeader() {
  logger.log('');
  logger.log(title('AI Fabrix Platform Setup'));
  logger.log(SEPARATOR);
  logger.log('');
}

async function runGuidedAuthStep(handleLogin) {
  const spin = startSpinner('Authenticating...');
  try {
    const controllerUrl = await resolveControllerUrl();
    await handleLogin({ method: 'device', controller: controllerUrl, environment: 'dev', compact: true });
  } catch (authErr) {
    if (spin) spin.fail('Authentication failed');
    logger.error(formatBlockingError('Authentication failed'));
    logger.log(chalk.gray('\nRun:\n  af login\n\nThen retry:\n  af up-platform\n'));
    throw authErr;
  }
  // Compact device-login already prints a success line; don't duplicate it.
  if (spin) spin.stop();
}

async function runGuidedUpPlatform(options, handleUpMiso, handleUpDataplane, handleLogin, forceCleanSummary = null) {
  logGuidedPlatformSetupHeader();
  if (forceCleanSummary && forceCleanSummary.forceSummary) {
    logUpPlatformForceCleanSummary(forceCleanSummary.forceSummary, forceCleanSummary.cleanedApps);
  }

  const kcSpin = startSpinner('Starting Keycloak...');
  await withMutedLogger(() => handleUpMiso({ ...options, platformInstall: true }));
  stopSpinnerSuccess(kcSpin, 'Keycloak ready');
  logger.log('');

  const mcSpin = startSpinner('Starting Miso Controller...');
  await waitForAppReady('miso-controller', { timeoutSeconds: 120 });
  stopSpinnerSuccess(mcSpin, 'Miso Controller ready');
  logger.log('');

  await runGuidedAuthStep(handleLogin);

  logger.log('');
  const dpSpin = startSpinner('Starting Dataplane...');
  await withMutedLogger(() => handleUpDataplane({ ...options, platformInstall: true }));
  stopSpinnerSuccess(dpSpin, 'Dataplane ready');
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

