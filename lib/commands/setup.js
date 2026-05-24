/**
 * Top-level handler for `aifabrix setup`.
 *
 * Decides between:
 *   - fresh install (no infra running) — wipe volumes, wizard for admin creds + AI tool, then up-infra + up-platform.
 *   - mode menu (infra already running) — dispatch one of three destructive/refresh paths.
 *
 * The mode handlers live in `setup-modes.js`; the prompts live in
 * `setup-prompts.js`. This module is a thin orchestrator so it stays well
 * under the 50-line/function limit.
 *
 * @fileoverview aifabrix setup orchestrator
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');

const config = require('../core/config');
const infra = require('../infrastructure');
const logger = require('../utils/logger');
const {
  formatSuccessParagraph,
  formatProgress,
  infoLine
} = require('../utils/cli-test-layout-chalk');

const setupPrompts = require('./setup-prompts');
const setupModes = require('./setup-modes');
const installationLog = require('../utils/installation-log');

const MODE = setupPrompts.MODE;

const SEPARATOR = '────────────────────────────────────────';

function title(text) {
  return chalk.bold(text);
}

function logSetupHeader() {
  logger.log('');
  logger.log(title('AI Fabrix Setup'));
  logger.log(SEPARATOR);
  logger.log('');
}

async function maybePinDeveloperIdForFreshInstall(rawDeveloper) {
  if (rawDeveloper === undefined || rawDeveloper === null) return;
  const dev = String(rawDeveloper).trim();
  if (!dev) return;
  await config.setDeveloperId(dev);
  logger.log(infoLine(`Developer ID pinned to ${dev}.`));
}

async function runFreshInstallFlow(options) {
  await maybePinDeveloperIdForFreshInstall(options.developer);
  logger.log(infoLine('No infrastructure detected; starting fresh install.'));
  const adminCreds = await setupPrompts.promptAdminCredentials(options);
  await config.setAdminEmail(adminCreds.adminEmail);
  await setupModes.runFreshInstall(adminCreds);
  logger.log(formatSuccessParagraph('aifabrix setup complete (fresh install).'));
}

/**
 * @param {boolean} assumeYes
 * @returns {Promise<{ aborted: boolean, mode: string|null }>}
 */
async function runExistingInfraFlow(assumeYes) {
  const mode = await setupPrompts.promptModeSelection();
  const proceed = await setupPrompts.confirmDestructiveMode(mode, assumeYes);
  if (!proceed) {
    logger.log(chalk.yellow('Aborted by user.'));
    return { aborted: true, mode };
  }
  await dispatchMode(mode);
  logger.log(formatSuccessParagraph(`aifabrix setup complete (mode: ${mode}).`));
  return { aborted: false, mode };
}

/**
 * Detect whether any infra service is currently running.
 * Treats "running" or "healthy" container state as "infra is up".
 *
 * @async
 * @returns {Promise<boolean>}
 */
async function isInfraRunning() {
  let status;
  try {
    status = await infra.getInfraStatus();
  } catch {
    return false;
  }
  if (!status || typeof status !== 'object') return false;
  return Object.values(status).some(svc => {
    if (!svc || typeof svc !== 'object') return false;
    const s = String(svc.status || '').toLowerCase();
    return s === 'running' || s === 'healthy' || s === 'starting';
  });
}

/**
 * Dispatch a chosen mode handler.
 * @async
 * @param {string} mode - One of MODE.* values
 * @returns {Promise<void>}
 * @throws {Error} If mode is unknown
 */
async function dispatchMode(mode) {
  switch (mode) {
  case MODE.REINSTALL:
    return setupModes.runReinstall();
  case MODE.WIPE_DATA:
    return setupModes.runWipeData();
  case MODE.UPDATE_IMAGES:
    return setupModes.runUpdateImages();
  default:
    throw new Error(`Unknown setup mode: ${mode}`);
  }
}

/**
 * @param {Object} options
 * @param {boolean} assumeYes
 * @returns {Promise<{ outcome: string, setupMode: string|null }>}
 */
async function runSetupMainPath(options, assumeYes) {
  logSetupHeader();
  logger.log(formatProgress('Detecting current installation state...'));
  const running = await isInfraRunning();
  if (!running) {
    await runFreshInstallFlow(options);
    return { outcome: 'success', setupMode: 'fresh' };
  }
  const r = await runExistingInfraFlow(assumeYes);
  const outcome = r.aborted ? 'aborted' : 'success';
  return { outcome, setupMode: r.mode };
}

async function readConfigSnapshotForSetupLog() {
  try {
    return await config.getConfig();
  } catch {
    return {};
  }
}

function tryCollectPlatformImagesForLog(outcome) {
  if (outcome !== 'success') return undefined;
  try {
    return installationLog.collectPlatformAppImages(['keycloak', 'miso-controller', 'dataplane'], {});
  } catch {
    return undefined;
  }
}

async function readSetupLogUrlFields() {
  let controllerUrl;
  try {
    controllerUrl = await installationLog.resolveControllerUrlForLog();
  } catch {
    controllerUrl = undefined;
  }
  let adminEmail;
  try {
    adminEmail = await installationLog.resolveAdminEmailPresence();
  } catch {
    adminEmail = 'unset';
  }
  return { controllerUrl, adminEmail };
}

/**
 * @param {Object} payload
 * @param {string} payload.outcome
 * @param {Date} payload.startedAt
 * @param {Date} payload.completedAt
 * @param {Object} payload.options
 * @param {string|null} payload.setupMode
 * @param {Error|null} payload.err
 */
async function appendSetupInstallationRecord(payload) {
  const cfg = await readConfigSnapshotForSetupLog();
  const platformApps = tryCollectPlatformImagesForLog(payload.outcome);
  const { controllerUrl, adminEmail } = await readSetupLogUrlFields();
  try {
    await installationLog.appendInstallationRecord({
      command: 'setup',
      outcome: payload.outcome,
      startedAt: payload.startedAt,
      completedAt: payload.completedAt,
      options: payload.options,
      setupMode: payload.setupMode || undefined,
      infra: cfg && typeof cfg === 'object' ? { cfg, options: {} } : undefined,
      platformApps,
      configExtra: { controllerUrl, adminEmail },
      error: payload.err || undefined,
      errorCode: payload.err && payload.err.code ? String(payload.err.code) : undefined
    });
  } catch {
    // never block setup on log failure
  }
}

/**
 * Run the setup wizard / dispatcher.
 *
 * @async
 * @function handleSetup
 * @param {Object} [options] - Commander options
 * @param {boolean} [options.yes] - Skip destructive confirmation prompts
 * @param {string} [options.developer] - Pin developer ID before fresh install (fresh path only)
 * @returns {Promise<void>}
 * @throws {Error} If a sub-step fails (caller surfaces via handleCommandError)
 */
async function handleSetup(options = {}) {
  const assumeYes = options.yes === true || options.assumeYes === true;
  const startedAt = new Date();
  let outcome = 'success';
  let setupMode = null;
  let err = null;

  try {
    const main = await runSetupMainPath(options, assumeYes);
    outcome = main.outcome;
    setupMode = main.setupMode;
  } catch (e) {
    outcome = 'failure';
    err = e;
  } finally {
    await appendSetupInstallationRecord({
      outcome,
      startedAt,
      completedAt: new Date(),
      options,
      setupMode,
      err
    });
  }

  if (err) {
    throw err;
  }
}

module.exports = {
  handleSetup,
  isInfraRunning,
  dispatchMode
};
