/**
 * CLI developer configuration command setup (dev config, dev set-id, dev init, dev add/update/pin/delete/list).
 *
 * @fileoverview Developer command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const config = require('../core/config');
const devConfig = require('../utils/dev-config');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { runDevInit, runDevRefresh } = require('../commands/dev-init');
const {
  handleDevList,
  handleDevAdd,
  handleDevUpdate,
  handleDevPin,
  handleDevDelete
} = require('../commands/dev-cli-handlers');

/**
 * Display developer configuration (local ports and config; remote/settings keys always shown).
 * Always shows environment, controller, and remote keys (value or "(not set)").
 * @param {string} devId - Developer ID
 * @returns {Promise<void>}
 */
async function displayDevConfig(devId) {
  const devIdNum = parseInt(devId, 10);
  const ports = devConfig.getDevPorts(devIdNum);
  const environment = await config.getCurrentEnvironment();
  const controller = await config.getControllerUrl();

  const optionalConfigVars = [
    { key: 'aifabrix-home', value: await config.getAifabrixHomeOverride() },
    { key: 'aifabrix-secrets', value: await config.getAifabrixSecretsPath() },
    { key: 'aifabrix-env-config', value: await config.getAifabrixEnvConfigPath() },
    { key: 'aifabrix-workspace-root', value: await config.getAifabrixWorkspaceRoot() },
    { key: 'remote-server', value: await config.getRemoteServer() },
    { key: 'docker-endpoint', value: await config.getDockerEndpoint() },
    { key: 'user-mutagen-folder', value: await config.getUserMutagenFolder() },
    { key: 'sync-ssh-user', value: await config.getSyncSshUser() },
    { key: 'sync-ssh-host', value: await config.getSyncSshHost() }
  ];

  logger.log('\n🔧 Developer Configuration\n');
  logger.log(`Developer ID: ${devId}`);
  logger.log('\nPorts:');
  logger.log(`  App: ${ports.app}`);
  logger.log(`  Postgres: ${ports.postgres}`);
  logger.log(`  Redis: ${ports.redis}`);
  logger.log(`  pgAdmin: ${ports.pgadmin}`);
  logger.log(`  Redis Commander: ${ports.redisCommander}`);

  logger.log('\nConfiguration:');
  logger.log(`  environment: '${environment}'`);
  logger.log(controller ? `  controller: '${controller}'` : '  controller: (not set)');
  optionalConfigVars.forEach(v => logger.log(`  ${v.key}: ${v.value || '(not set)'}`));
  logger.log('');
}

/**
 * Register dev config and set-id commands.
 * @param {Command} dev - dev subcommand group
 */
function setupDevConfigCommands(dev) {
  dev
    .command('config')
    .description('Show or set developer configuration')
    .option('--set-id <id>', 'Set developer ID')
    .action(async(options) => {
      try {
        const setIdValue = options.setId || options['set-id'];
        if (setIdValue) {
          const digitsOnly = /^[0-9]+$/.test(setIdValue);
          if (!digitsOnly) {
            throw new Error('Developer ID must be a non-negative digit string (0 = default infra, > 0 = developer-specific)');
          }
          await config.setDeveloperId(setIdValue);
          process.env.AIFABRIX_DEVELOPERID = setIdValue;
          logger.log(chalk.green(`✓ Developer ID set to ${setIdValue}`));
          await displayDevConfig(setIdValue);
          return;
        }
        const devId = await config.getDeveloperId();
        await displayDevConfig(devId);
      } catch (error) {
        handleCommandError(error, 'dev config');
        process.exit(1);
      }
    });

  dev
    .command('set-id <id>')
    .description('Set developer ID (convenience alias for "dev config --set-id")')
    .action(async(id) => {
      try {
        const digitsOnly = /^[0-9]+$/.test(id);
        if (!digitsOnly) {
          throw new Error('Developer ID must be a non-negative digit string (0 = default infra, > 0 = developer-specific)');
        }
        await config.setDeveloperId(id);
        process.env.AIFABRIX_DEVELOPERID = id;
        logger.log(chalk.green(`✓ Developer ID set to ${id}`));
        await displayDevConfig(id);
      } catch (error) {
        handleCommandError(error, 'dev set-id');
        process.exit(1);
      }
    });
}

/**
 * Register dev init and refresh commands.
 * @param {Command} dev - dev subcommand group
 */
function setupDevInitCommand(dev) {
  dev
    .command('init')
    .description('Onboard with Builder Server (issue certificate, fetch settings, register SSH key for Mutagen)')
    .requiredOption('--developer-id <id>', 'Developer ID (same as dev add; e.g. 01)')
    .requiredOption('--server <url>', 'Builder Server base URL (e.g. https://dev.aifabrix.dev)')
    .requiredOption('--pin <pin>', 'One-time PIN from your admin')
    .action(async(options) => {
      try {
        await runDevInit(options);
      } catch (error) {
        handleCommandError(error, 'dev init');
        process.exit(1);
      }
    });

  dev
    .command('refresh')
    .description('Fetch settings from Builder Server and update config (use when docker-endpoint or sync-ssh-host are empty)')
    .action(async() => {
      try {
        await runDevRefresh();
      } catch (error) {
        handleCommandError(error, 'dev refresh');
        process.exit(1);
      }
    });
}

/**
 * Register dev list and add commands (remote only).
 * @param {Command} dev - dev subcommand group
 */
function setupDevListAddCommands(dev) {
  dev
    .command('list')
    .description('List developer users (remote Builder Server only)')
    .action(async() => {
      try {
        await handleDevList();
      } catch (error) {
        handleCommandError(error, 'dev list');
        process.exit(1);
      }
    });

  dev
    .command('add')
    .description('Register a new developer (remote Builder Server only; admin)')
    .requiredOption('--developer-id <id>', 'Developer ID (unique, e.g. 01)')
    .requiredOption('--name <name>', 'Display name')
    .requiredOption('--email <email>', 'Email address')
    .option('--groups <items>', 'Comma-separated groups (admin, secret-manager, developer)', 'developer')
    .action(async(options) => {
      try {
        await handleDevAdd(options);
      } catch (error) {
        handleCommandError(error, 'dev add');
        process.exit(1);
      }
    });
}

/**
 * Register dev update/pin/delete commands (remote only).
 * @param {Command} dev - dev subcommand group
 */
function setupDevUpdatePinDeleteCommands(dev) {
  dev
    .command('update [developerId]')
    .description('Update a developer (name, email, groups); use --developer-id like dev add')
    .option('--developer-id <id>', 'Developer ID (same as dev add)')
    .option('--name <name>', 'Display name')
    .option('--email <email>', 'Email address')
    .option('--groups <items>', 'Comma-separated groups (admin, secret-manager, developer)')
    .action(async(developerId, options) => {
      try {
        await handleDevUpdate(developerId, options);
      } catch (error) {
        handleCommandError(error, 'dev update');
        process.exit(1);
      }
    });

  dev
    .command('pin [developerId]')
    .description('Create or regenerate one-time PIN for onboarding (admin; show once to developer)')
    .action(async(developerId) => {
      try {
        await handleDevPin(developerId);
      } catch (error) {
        handleCommandError(error, 'dev pin');
        process.exit(1);
      }
    });

  dev
    .command('delete <developerId>')
    .description('Remove a developer (remote Builder Server only; admin)')
    .action(async(developerId) => {
      try {
        await handleDevDelete(developerId);
      } catch (error) {
        handleCommandError(error, 'dev delete');
        process.exit(1);
      }
    });

  dev
    .command('down')
    .description('Stop Mutagen sync sessions for this developer (and optionally app containers)')
    .option('--apps', 'Also stop running app containers for this developer')
    .action(async(options) => {
      try {
        const { handleDevDown } = require('../commands/dev-down');
        await handleDevDown(options);
      } catch (error) {
        handleCommandError(error, 'dev down');
        process.exit(1);
      }
    });
}

/**
 * Register dev list/add/update/pin/delete commands (remote only).
 * @param {Command} dev - dev subcommand group
 */
function setupDevUserCommands(dev) {
  setupDevListAddCommands(dev);
  setupDevUpdatePinDeleteCommands(dev);
}

/**
 * Sets up developer configuration commands
 * @param {Command} program - Commander program instance
 */
function setupDevCommands(program) {
  const dev = program
    .command('dev')
    .description('Developer configuration and isolation');

  setupDevConfigCommands(dev);
  setupDevInitCommand(dev);
  setupDevUserCommands(dev);
}

module.exports = { setupDevCommands };
