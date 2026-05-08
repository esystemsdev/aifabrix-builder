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
const ora = require('ora');

const config = require('../core/config');
const infra = require('../infrastructure');
const pathsUtil = require('../utils/paths');
const logger = require('../utils/logger');
const { withMutedLogger } = require('../utils/with-muted-logger');
const {
  formatSuccessLine,
  formatSuccessParagraph,
  formatProgress,
  successGlyph
} = require('../utils/cli-test-layout-chalk');

/** File name kept by teardown (lowercase exact match). */
const PRESERVE_FILE = 'config.yaml';

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
    } catch (err) {
      failed.push(target);
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
    const spin = startSpinner('Stopping infrastructure (down-infra -v)...');
    await withMutedLogger(async() => {
      await infra.stopInfraWithVolumes();
    });
    stopSpinnerSuccess(spin, 'Infrastructure stopped and volumes removed');
  } catch (err) {
    logger.log(
      chalk.yellow(
        `Infrastructure already down or could not be stopped cleanly: ${err.message}`
      )
    );
  }
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

function logSection(label, value) {
  logger.log(title(label));
  logger.log(`  ${value}`);
  logger.log('');
}

async function buildDeveloperLabel() {
  const developerId = await config.getDeveloperId();
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  if (!Number.isFinite(idNum)) return 'unknown';
  return `dev${String(idNum).padStart(2, '0')} (id: ${idNum})`;
}

function logTeardownHeader() {
  logger.log('');
  logger.log(title('AI Fabrix Shutdown'));
  logger.log(SEPARATOR);
  logger.log('');
}

function logTeardownFooter({ devStr, removedCount, failedCount }) {
  logFooterStart('Stopped');
  logSection('Developer', devStr);
  logSection('Cleaned', `${successGlyph()} Removed ${removedCount} item(s) (${PRESERVE_FILE} preserved)`);
  logger.log(chalk.yellow('⚠ Volumes removed: all local data deleted'));
  logger.log('');
  if (failedCount > 0) {
    logger.log(chalk.yellow(`⚠ Could not remove ${failedCount} item(s)`));
    logger.log('');
  }
  logFooterEnd();
}

function cleanFilesWithSpinner() {
  const cleanSpin = startSpinner('Removing installation files...');
  const result = cleanAifabrixSystemDir();
  stopSpinnerSuccess(cleanSpin, `Removed ${result.removed.length} installation item(s)`);
  return result;
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
  logTeardownHeader();

  const ok = await confirmTeardown(assumeYes);
  if (!ok) {
    logger.log(chalk.yellow('Aborted by user.'));
    return;
  }
  await stopInfraQuietly();
  const { removed, failed } = cleanFilesWithSpinner();
  const devStr = await buildDeveloperLabel();
  logTeardownFooter({ devStr, removedCount: removed.length, failedCount: failed.length });

  logger.log(formatSuccessParagraph('aifabrix teardown complete.'));
}

module.exports = {
  handleTeardown,
  cleanAifabrixSystemDir,
  stopInfraQuietly,
  PRESERVE_FILE
};
