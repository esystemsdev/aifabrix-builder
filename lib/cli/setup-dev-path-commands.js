/**
 * Dev subcommands: set-env-config, set-home, set-work, print-home, print-work, set-format.
 *
 * @fileoverview Path and format CLI registration for `aifabrix dev`
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const config = require('../core/config');
const logger = require('../utils/logger');
const paths = require('../utils/paths');
const { registerAifabrixShellEnvFromConfig } = require('../utils/register-aifabrix-shell-env');
const { handleCommandError } = require('../utils/cli-utils');

async function runShellEnvRegistration() {
  try {
    await registerAifabrixShellEnvFromConfig(config.getConfig);
    logger.log(
      chalk.gray('  User/shell environment updated. Open a new terminal for AIFABRIX_HOME / AIFABRIX_WORK.')
    );
  } catch (regErr) {
    throw new Error(`Config saved but environment registration failed: ${regErr.message}`);
  }
}

function addSetEnvConfigCommand(dev) {
  dev
    .command('set-env-config <filePath>')
    .description('Set or clear aifabrix-env-config in config (path not validated)')
    .action(async(filePath) => {
      try {
        const trimmed = (filePath || '').trim();
        await config.setAifabrixEnvConfigPath(trimmed);
        logger.log(trimmed === '' ? chalk.green('✓ Env config path cleared') : chalk.green(`✓ Env config path set to ${trimmed}`));
      } catch (error) {
        handleCommandError(error, 'dev set-env-config');
        process.exit(1);
      }
    });
}

function addSetHomeCommand(dev) {
  dev
    .command('set-home <path>')
    .description('Set or clear aifabrix-home in config; register AIFABRIX_HOME for new shells unless --no-register-env')
    .option('--no-register-env', 'Do not update Windows user env or POSIX shell profile hooks')
    .action(async(homePath, cmdOpts) => {
      try {
        const trimmed = (homePath || '').trim();
        await config.setAifabrixHomeOverride(trimmed);
        logger.log(trimmed === '' ? chalk.green('✓ Home path cleared') : chalk.green(`✓ Home path set to ${trimmed}`));
        if (cmdOpts?.registerEnv !== false) {
          await runShellEnvRegistration();
        }
      } catch (error) {
        handleCommandError(error, 'dev set-home');
        process.exit(1);
      }
    });
}

function addSetWorkCommand(dev) {
  dev
    .command('set-work <path>')
    .description('Set or clear aifabrix-work (workspace root) in config; register AIFABRIX_WORK unless --no-register-env')
    .option('--no-register-env', 'Do not update Windows user env or POSIX shell profile hooks')
    .action(async(workPath, cmdOpts) => {
      try {
        const trimmed = (workPath || '').trim();
        await config.setAifabrixWorkOverride(trimmed);
        logger.log(trimmed === '' ? chalk.green('✓ Work path cleared') : chalk.green(`✓ Work path set to ${trimmed}`));
        if (cmdOpts?.registerEnv !== false) {
          await runShellEnvRegistration();
        }
      } catch (error) {
        handleCommandError(error, 'dev set-work');
        process.exit(1);
      }
    });
}

function addPrintHomeWorkCommands(dev) {
  dev
    .command('print-home')
    .description('Print resolved AIFABRIX_HOME path (stdout only; for scripts)')
    .action(() => {
      try {
        process.stdout.write(`${paths.getAifabrixHome()}\n`);
      } catch (error) {
        handleCommandError(error, 'dev print-home');
        process.exit(1);
      }
    });

  dev
    .command('print-work')
    .description('Print resolved workspace path or empty line (stdout only; for scripts)')
    .action(() => {
      try {
        const w = paths.getAifabrixWork();
        process.stdout.write(w ? `${w}\n` : '\n');
      } catch (error) {
        handleCommandError(error, 'dev print-work');
        process.exit(1);
      }
    });
}

function addSetFormatCommand(dev, handleSetFormat) {
  dev
    .command('set-format <format>')
    .description('Default json|yaml when --format is omitted (download/convert)')
    .action(async(format) => {
      try {
        await handleSetFormat(format);
      } catch (error) {
        handleCommandError(error, 'dev set-format');
        process.exit(1);
      }
    });
}

/**
 * Register dev set-env-config, set-home, set-work, print-*, set-format.
 * @param {import('commander').Command} dev - dev subcommand group
 * @param {function(string): Promise<void>} handleSetFormat - handler that updates format and refreshes display
 * @returns {void}
 */
function setupDevPathAndFormatCommands(dev, handleSetFormat) {
  addSetEnvConfigCommand(dev);
  addSetHomeCommand(dev);
  addSetWorkCommand(dev);
  addPrintHomeWorkCommands(dev);
  addSetFormatCommand(dev, handleSetFormat);
}

module.exports = { setupDevPathAndFormatCommands };
