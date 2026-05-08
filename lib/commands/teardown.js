/**
 * `aifabrix teardown` — full teardown of local infra and CLI state.
 *
 * Performs:
 *   1. `down-infra -v` (stop infra + apps, remove all Docker volumes).
 *   2. Remove every entry inside `~/.aifabrix/` (or the equivalent
 *      `getAifabrixSystemDir()`-resolved directory) except `config.yaml`.
 *      This includes `secrets.local.yaml`, `admin-secrets.env`,
 *      auth/token files, and any `infra-dev*` directories.
 *
 * Confirmation is required by default; pass `--yes` / `-y` to skip.
 *
 * @fileoverview aifabrix teardown handler
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');

const infra = require('../infrastructure');
const pathsUtil = require('../utils/paths');
const logger = require('../utils/logger');
const {
  formatSuccessLine,
  formatSuccessParagraph,
  formatProgress,
  sectionTitle
} = require('../utils/cli-test-layout-chalk');

/** File name kept by teardown (lowercase exact match). */
const PRESERVE_FILE = 'config.yaml';

/**
 * Ask the user to confirm teardown unless `assumeYes` is true.
 * @async
 * @param {boolean} assumeYes
 * @returns {Promise<boolean>}
 */
async function confirmTeardown(assumeYes) {
  if (assumeYes) return true;
  const { ok } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'ok',
      message:
        'This will stop all infra + apps, DELETE every Docker volume, and remove every file in ~/.aifabrix/ except config.yaml. Continue?',
      default: false
    }
  ]);
  return ok === true;
}

/**
 * Remove every entry in the AI Fabrix system directory except `config.yaml`.
 * Each removal is logged. Errors per entry are caught and logged so the
 * teardown surfaces partial-success information instead of bailing on the
 * first ENOENT/EBUSY.
 *
 * @returns {{ removed: string[], failed: string[] }}
 */
function cleanAifabrixSystemDir() {
  const dir = pathsUtil.getAifabrixSystemDir();
  const removed = [];
  const failed = [];
  if (!fs.existsSync(dir)) {
    return { removed, failed };
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === PRESERVE_FILE) continue;
    const target = path.join(dir, entry.name);
    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
      logger.log(formatSuccessLine(`Removed ${target}`));
    } catch (err) {
      failed.push(target);
      logger.log(chalk.yellow(`Could not remove ${target}: ${err.message}`));
    }
  }
  return { removed, failed };
}

/**
 * Stop infra with `down-infra -v` semantics. Tolerates already-down state.
 * @async
 * @returns {Promise<void>}
 */
async function stopInfraQuietly() {
  try {
    logger.log(formatProgress('Stopping infrastructure (down-infra -v)...'));
    await infra.stopInfraWithVolumes();
    logger.log(formatSuccessLine('Infrastructure stopped and volumes removed'));
  } catch (err) {
    logger.log(chalk.yellow(`Infrastructure already down or could not be stopped cleanly: ${err.message}`));
  }
}

/**
 * Run the teardown.
 *
 * @async
 * @function handleTeardown
 * @param {Object} [options] - Commander options
 * @param {boolean} [options.yes] - Skip the confirmation prompt
 * @returns {Promise<void>}
 */
async function handleTeardown(options = {}) {
  const assumeYes = options.yes === true || options.assumeYes === true;
  logger.log(sectionTitle('aifabrix teardown'));
  const ok = await confirmTeardown(assumeYes);
  if (!ok) {
    logger.log(chalk.yellow('Aborted by user.'));
    return;
  }
  await stopInfraQuietly();
  const { removed, failed } = cleanAifabrixSystemDir();
  if (failed.length > 0) {
    logger.log(chalk.yellow(`Teardown finished with ${failed.length} item(s) not removed.`));
  }
  logger.log(
    formatSuccessParagraph(
      `aifabrix teardown complete. Removed ${removed.length} entr${removed.length === 1 ? 'y' : 'ies'}; ${PRESERVE_FILE} preserved.`
    )
  );
}

module.exports = {
  handleTeardown,
  cleanAifabrixSystemDir,
  stopInfraQuietly,
  PRESERVE_FILE
};
