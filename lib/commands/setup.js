/**
 * Top-level handler for `aifabrix setup`.
 *
 * Decides between:
 *   - fresh install (no infra running) — wizard for admin creds + AI tool, then up-infra + up-platform.
 *   - mode menu (infra already running) — dispatch one of four destructive/refresh paths.
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
  const adminCreds = await setupPrompts.promptAdminCredentials();
  await setupModes.runFreshInstall(adminCreds);
  logger.log(formatSuccessParagraph('aifabrix setup complete (fresh install).'));
}

async function runExistingInfraFlow(assumeYes) {
  const mode = await setupPrompts.promptModeSelection();
  const proceed = await setupPrompts.confirmDestructiveMode(mode, assumeYes);
  if (!proceed) {
    logger.log(chalk.yellow('Aborted by user.'));
    return;
  }
  await dispatchMode(mode);
  logger.log(formatSuccessParagraph(`aifabrix setup complete (mode: ${mode}).`));
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
  case MODE.CLEAN_FILES:
    return setupModes.runCleanInstallFiles();
  case MODE.UPDATE_IMAGES:
    return setupModes.runUpdateImages();
  default:
    throw new Error(`Unknown setup mode: ${mode}`);
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

  logSetupHeader();

  logger.log(formatProgress('Detecting current installation state...'));
  const running = await isInfraRunning();

  if (!running) {
    await runFreshInstallFlow(options);
    return;
  }
  await runExistingInfraFlow(assumeYes);
}

module.exports = {
  handleSetup,
  isInfraRunning,
  dispatchMode
};
