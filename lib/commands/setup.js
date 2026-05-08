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
  sectionTitle,
  infoLine
} = require('../utils/cli-test-layout-chalk');

const setupPrompts = require('./setup-prompts');
const setupModes = require('./setup-modes');

const MODE = setupPrompts.MODE;

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
  logger.log(sectionTitle('aifabrix setup'));
  logger.log(formatProgress('Detecting current infrastructure state...'));
  const running = await isInfraRunning();

  if (!running) {
    if (options.developer !== undefined && options.developer !== null && String(options.developer).trim() !== '') {
      await config.setDeveloperId(options.developer);
      logger.log(infoLine(`Developer ID pinned to ${options.developer}.`));
    }
    logger.log(infoLine('No infrastructure detected; running fresh-install wizard.'));
    const adminCreds = await setupPrompts.promptAdminCredentials();
    await setupModes.runFreshInstall(adminCreds);
    logger.log(formatSuccessParagraph('aifabrix setup complete (fresh install).'));
    return;
  }

  const mode = await setupPrompts.promptModeSelection();
  const proceed = await setupPrompts.confirmDestructiveMode(mode, assumeYes);
  if (!proceed) {
    logger.log(chalk.yellow('Aborted by user.'));
    return;
  }
  await dispatchMode(mode);
  logger.log(formatSuccessParagraph(`aifabrix setup complete (mode: ${mode}).`));
}

module.exports = {
  handleSetup,
  isInfraRunning,
  dispatchMode
};
