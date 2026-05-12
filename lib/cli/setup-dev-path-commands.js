/**
 * Dev subcommands: set-home, set-work, print-home, print-work, shell-env, set-format.
 *
 * @fileoverview Path and format CLI registration for `aifabrix dev`
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';
const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');

const chalk = require('chalk');
const path = require('path');
const config = require('../core/config');
const logger = require('../utils/logger');
const paths = require('../utils/paths');
const {
  registerAifabrixShellEnvFromConfig,
  buildShellEnvExportsFromConfig
} = require('../utils/register-aifabrix-shell-env');
const { handleCommandError } = require('../utils/cli-utils');

async function runShellEnvRegistration() {
  try {
    await registerAifabrixShellEnvFromConfig(config.getConfig);
    logger.log(
      chalk.gray('  User/shell environment updated. New terminals pick up AIFABRIX_HOME / AIFABRIX_WORK.')
    );
    if (process.platform !== 'win32') {
      logger.log(
        chalk.gray('  This terminal: ') +
          chalk.cyan('eval "$(aifabrix dev shell-env)"') +
          chalk.gray('  (or source the aifabrix-shell-env.sh next to config.yaml).')
      );
    } else {
      logger.log(
        chalk.gray('  This PowerShell session: ') +
          chalk.cyan('aifabrix dev shell-env') +
          chalk.gray(' then run the printed lines.')
      );
    }
  } catch (regErr) {
    throw new Error(`Config saved but environment registration failed: ${regErr.message}`);
  }
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
        logger.log(trimmed === '' ? formatSuccessLine('Home path cleared') : formatSuccessLine(`Home path set to ${trimmed}`));
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
        logger.log(trimmed === '' ? formatSuccessLine('Work path cleared') : formatSuccessLine(`Work path set to ${trimmed}`));
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

  dev
    .command('shell-env')
    .description(
      'Print export lines for AIFABRIX_HOME / AIFABRIX_WORK (stdout only). POSIX: eval "$(aifabrix dev shell-env)"'
    )
    .action(async() => {
      try {
        if (process.platform === 'win32') {
          const cfg = await config.getConfig();
          const home = (cfg['aifabrix-home'] && String(cfg['aifabrix-home']).trim())
            ? paths.resolveAifabrixHomeLikePath(String(cfg['aifabrix-home']).trim())
            : null;
          const work = (cfg['aifabrix-work'] && String(cfg['aifabrix-work']).trim())
            ? path.resolve(String(cfg['aifabrix-work']).trim())
            : null;
          const esc = (s) => String(s).replace(/'/g, '\'\'');
          const lines = ['# Paste into PowerShell for this session only.'];
          if (home) lines.push(`$env:AIFABRIX_HOME = '${esc(home)}'`);
          if (work) lines.push(`$env:AIFABRIX_WORK = '${esc(work)}'`);
          process.stdout.write(`${lines.join('\n')}\n`);
          return;
        }
        const body = await buildShellEnvExportsFromConfig(config.getConfig);
        process.stdout.write(body);
      } catch (error) {
        handleCommandError(error, 'dev shell-env');
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
 * Register dev set-home, set-work, print-*, set-format.
 * @param {import('commander').Command} dev - dev subcommand group
 * @param {function(string): Promise<void>} handleSetFormat - handler that updates format and refreshes display
 * @returns {void}
 */
function setupDevPathAndFormatCommands(dev, handleSetFormat) {
  addSetHomeCommand(dev);
  addSetWorkCommand(dev);
  addPrintHomeWorkCommands(dev);
  addSetFormatCommand(dev, handleSetFormat);
}

module.exports = { setupDevPathAndFormatCommands };
