/**
 * CLI developer configuration command setup (dev config, dev set-id, dev init, dev add/update/pin/delete/list).
 *
 * @fileoverview Developer command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const config = require('../core/config');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { setupDevPathAndFormatCommands } = require('./setup-dev-path-commands');
const { runDevInit, runDevRefresh } = require('../commands/dev-init');
const { displayDevConfig } = require('../commands/dev-show-display');
const {
  handleDevList,
  handleDevAdd,
  handleDevUpdate,
  handleDevPin,
  handleDevDelete
} = require('../commands/dev-cli-handlers');

/** Appended to `dev update --help` (examples + partial-update behaviour). */
const DEV_UPDATE_HELP_AFTER = `
Examples:
  $ aifabrix dev update 02 --name "Jane Doe"
  $ aifabrix dev update --developer-id 02 --email jane@example.com
  $ aifabrix dev update 01 --name "Admin" --groups admin,developer
  $ aifabrix dev update 02 --groups admin,developer,docker

Partial update: only flags you pass are sent to the server. Omitted name, email, and groups are left unchanged.
`;

/** Appended to `dev add --help` (examples + workflow). */
const DEV_ADD_HELP_AFTER = `
Examples:
  $ aifabrix dev add --developer-id 02 --name "Jane Doe" --email jane@example.com
  $ aifabrix dev add --developer-id 03 --name "Build admin" --email admin@example.com --groups admin,developer
  $ aifabrix dev add --developer-id 04 --name "CI user" --email ci@example.com --groups secret-manager,developer

Requires a configured remote Builder Server and an admin client certificate (same machine setup as dev list / dev pin). After add, run dev pin <id> once to create a PIN for aifabrix dev init.
`;

/** Appended to `aifabrix dev --help` (overview; keep subcommand .description lines short). */
const DEV_GROUP_HELP_AFTER = `
Categories:
  Local config   show, set-id, set-scoped-resources, set-env-config, set-home, set-work, set-format, print-home, print-work
  Onboarding     init (PIN onboarding), refresh (sync settings / renew cert)
  Remote admin   list, add, update, pin, delete  (need remote-server + client cert in ~/.aifabrix)
  Sync / stop    down  (Mutagen; optional --apps for containers)

Use: aifabrix dev <command> --help
`;

/** Appended to `dev init --help`. */
const DEV_INIT_HELP_AFTER = `
Examples:
  Full (first machine or no config yet):
  $ aifabrix dev init --developer-id 01 --server https://builder01.local --pin <one-time-pin>

  When remote-server and developer-id are already in ~/.aifabrix/config.yaml (from settings or dev show):
  $ aifabrix dev init --pin <one-time-pin>

Admin issues the PIN with: aifabrix dev pin <developer-id>
`;

/** Appended to `dev refresh --help`. */
const DEV_REFRESH_HELP_AFTER = `
Requires remote-server and saved client certificate (after dev init). Use --cert to force a new cert before expiry.
`;

/** Appended to `dev pin --help`. */
const DEV_PIN_HELP_AFTER = `
Examples:
  $ aifabrix dev pin 02
  $ aifabrix dev pin 02 --hosts-ip 192.168.1.25
  $ aifabrix dev pin   (uses developer-id from config)

Prints copy-paste commands for the developer: full dev init, hosts-file variant, and dev init --pin
when their config already has remote-server + developer-id.
`;

/** Appended to `dev delete --help`. */
const DEV_DELETE_HELP_AFTER = `
Example:
  $ aifabrix dev delete 02
`;

/** Appended to `dev down --help`. */
const DEV_DOWN_HELP_AFTER = `
Examples:
  $ aifabrix dev down
  $ aifabrix dev down --apps
`;

/**
 * Handle dev set-format command
 * @param {string} format - Format value (json | yaml)
 * @returns {Promise<void>}
 */
async function handleSetFormat(format) {
  await config.setFormat(format);
  logger.log(chalk.green(`✓ Format set to ${format.toLowerCase()}`));
  const devId = await config.getDeveloperId();
  await displayDevConfig(devId);
}

/**
 * Set useEnvironmentScopedResources in ~/.aifabrix/config.yaml
 * @param {string} value - "true" or "false"
 * @returns {Promise<void>}
 */
async function handleSetScopedResources(value) {
  const b = String(value || '').trim().toLowerCase();
  if (b !== 'true' && b !== 'false') {
    throw new Error('Value must be true or false (example: aifabrix dev set-scoped-resources true)');
  }
  await config.setUseEnvironmentScopedResources(b === 'true');
  if (b === 'true') {
    logger.log(
      chalk.green('✓ Environment-scoped resources activated in ~/.aifabrix/config.yaml')
    );
  } else {
    logger.log(chalk.green('✓ Environment-scoped resources passivated (default local naming)'));
  }
  logger.log(
    chalk.gray(
      '  Apps still need environmentScopedResources: true in application.yaml for prefixing when you run with --env dev or tst.'
    )
  );
  const devId = await config.getDeveloperId();
  await displayDevConfig(devId);
}

/**
 * Register dev show and set-id commands.
 * @param {Command} dev - dev subcommand group
 */
function setupDevShowAndSetId(dev) {
  dev
    .command('show')
    .description('Show dev ports and ~/.aifabrix config')
    .action(async() => {
      try {
        const devId = await config.getDeveloperId();
        await displayDevConfig(devId);
      } catch (error) {
        handleCommandError(error, 'dev show');
        process.exit(1);
      }
    });

  dev
    .command('set-id <id>')
    .description('Set developer ID (0 = default infra, >0 = dev-specific ports)')
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

  dev
    .command('set-scoped-resources <value>')
    .description('Set useEnvironmentScopedResources to true|false in ~/.aifabrix/config.yaml')
    .action(async(value) => {
      try {
        await handleSetScopedResources(value);
      } catch (error) {
        handleCommandError(error, 'dev set-scoped-resources');
        process.exit(1);
      }
    });
}

/**
 * Register dev show, set-id, set-env-config, set-home and set-format commands.
 * @param {Command} dev - dev subcommand group
 */
function setupDevConfigCommands(dev) {
  setupDevShowAndSetId(dev);
  setupDevPathAndFormatCommands(dev, handleSetFormat);
}

/**
 * Shared Commander options for dev init (PIN onboarding).
 * @param {object} cmd - Commander command to attach options to
 * @returns {object} Same command for chaining
 */
function addDevOnboardingOptions(cmd) {
  return cmd
    .requiredOption('--pin <pin>', 'One-time PIN from your admin (see aifabrix dev pin)')
    .option(
      '--developer-id <id>',
      'Developer ID (optional if set in ~/.aifabrix/config.yaml and not 0; e.g. 01)'
    )
    .option('--server <url>', 'Builder Server base URL (optional if remote-server is in config)')
    .option('-y, --yes', 'Auto-install development CA without prompt when certificate is untrusted; with --add-hosts, skip hosts-file confirmation')
    .option('--no-install-ca', 'Do not offer CA install; fail with manual instructions on untrusted certificate')
    .option(
      '--add-hosts',
      'Offer to add the server hostname to this machine\'s hosts file (wildcard DNS must be configured separately; may require admin)'
    )
    .option('--hosts-ip <ip>', 'IPv4 for the hosts entry when using --add-hosts (skips lookup / IP prompt)');
}

/**
 * Register dev init and refresh commands.
 * @param {Command} dev - dev subcommand group
 */
function setupDevInitCommand(dev) {
  const runOnboarding = async(options, label) => {
    try {
      await runDevInit(options);
    } catch (error) {
      handleCommandError(error, label);
      process.exit(1);
    }
  };

  addDevOnboardingOptions(
    dev
      .command('init')
      .description('Onboard with Builder Server (cert, settings, SSH for Mutagen)')
      .addHelpText('after', DEV_INIT_HELP_AFTER)
  ).action(async(options) => runOnboarding(options, 'dev init'));

  dev
    .command('refresh')
    .description('Pull server settings into config; renew cert if due or --cert')
    .addHelpText('after', DEV_REFRESH_HELP_AFTER)
    .option('--cert', 'Force certificate refresh (create PIN + issue-cert) even when cert is still valid')
    .action(async(options) => {
      try {
        await runDevRefresh(options);
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
    .description('List developers (remote Builder Server)')
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
    .description('Create developer on server (admin); then dev pin for onboarding')
    .requiredOption('--developer-id <id>', 'Unique id, digits only (e.g. 02); used with dev init --developer-id')
    .requiredOption('--name <name>', 'Display name')
    .requiredOption('--email <email>', 'Email address')
    .option('--groups <items>', 'Comma-separated roles: admin, secret-manager, developer, docker', 'developer')
    .addHelpText('after', DEV_ADD_HELP_AFTER)
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
    .description('Patch name/email/groups (admin); only given flags change')
    .option('--developer-id <id>', 'Developer ID (same as dev add)')
    .option('--name <name>', 'Display name')
    .option('--email <email>', 'Email address')
    .option('--groups <items>', 'Comma-separated groups (admin, secret-manager, developer, docker)')
    .addHelpText('after', DEV_UPDATE_HELP_AFTER)
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
    .description('One-time onboarding PIN for dev init (admin)')
    .option('--hosts-ip <ip>', 'Builder Server LAN IPv4 to embed in the hosts-file init command (optional)')
    .addHelpText('after', DEV_PIN_HELP_AFTER)
    .action(async(developerId, options) => {
      try {
        await handleDevPin(developerId, options);
      } catch (error) {
        handleCommandError(error, 'dev pin');
        process.exit(1);
      }
    });

  dev
    .command('delete <developerId>')
    .description('Remove developer from server (admin)')
    .addHelpText('after', DEV_DELETE_HELP_AFTER)
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
    .description('Stop Mutagen sync; --apps also stops app containers')
    .addHelpText('after', DEV_DOWN_HELP_AFTER)
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
    .description('Local dev config, Builder onboarding, remote admin, Mutagen/sync')
    .addHelpText('after', DEV_GROUP_HELP_AFTER);

  setupDevConfigCommands(dev);
  setupDevInitCommand(dev);
  setupDevUserCommands(dev);
}

module.exports = { setupDevCommands };
