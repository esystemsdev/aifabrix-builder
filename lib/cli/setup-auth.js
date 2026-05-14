/**
 * CLI authentication command setup (login, logout, auth status/config).
 *
 * @fileoverview Authentication command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { handleLogin } = require('../commands/login');
const { handleLogout } = require('../commands/logout');
const { handleAuthStatus } = require('../commands/auth-status');
const { handleAuthConfig } = require('../commands/auth-config');

const LOGIN_HELP_AFTER = `
Examples:
  $ aifabrix login
  $ aifabrix login -m credentials -a myapp -e dev
`;

const AUTH_HELP_AFTER = `
Without options: show auth status (same as: aifabrix auth status).
With --set-controller or --set-environment: write defaults to config.yaml.
Omit the URL on --set-controller to pick from controllers already stored in config (device logins + default).
For details on omitting the URL: aifabrix auth set-controller -h
Aliases:
  aifabrix auth set-controller [url]
  aifabrix auth set-environment <env>
Subcommand: auth status [--validate] for CI/scripts.
`;

const AUTH_SET_CONTROLLER_HELP_AFTER = `
Argument:
  [url]   Optional. When omitted, the CLI uses controllers already known in your config file
          (the default controller value plus each device-token key). Requires an interactive TTY.

Behavior:
  - No saved controllers: error; run aifabrix login first, or pass a URL.
  - One saved controller: if it is already the default, prints confirmation; otherwise sets it.
  - Several saved controllers: interactive list to choose the default.
  - Non-interactive shell: pass the URL explicitly (piped/CI shells cannot pick without a URL).

Examples:
  $ aifabrix auth set-controller
    Pick default controller from config (TTY), or set the only saved one.

  $ aifabrix auth set-controller http://localhost:3600
    Set default controller to that URL (validated; same rules as aifabrix auth --set-controller).

  $ aifabrix auth --set-controller
    Same as omitting the URL on this subcommand (parent command flag).
`;

function createAuthStatusAction() {
  return async(options) => {
    try {
      await handleAuthStatus(options);
    } catch (error) {
      handleCommandError(error, 'auth status');
      process.exit(1);
    }
  };
}

function createAuthParentAction() {
  return async(options) => {
    try {
      const setController = options.setController || options['set-controller'];
      const setEnvironment = options.setEnvironment || options['set-environment'];
      if (setController || setEnvironment) {
        await handleAuthConfig({
          setController,
          setEnvironment
        });
        return;
      }
      await handleAuthStatus(options);
    } catch (error) {
      handleCommandError(error, 'auth');
      process.exit(1);
    }
  };
}

function registerAuthSetControllerSubcommand(auth) {
  const setControllerCmd = auth.command('set-controller [url]').description(
    'Set config.controller to a URL, or omit the URL to pick from controllers already stored in config'
  );
  if (typeof setControllerCmd.summary === 'function') {
    setControllerCmd.summary('Set or pick default controller URL in config');
  }
  setControllerCmd.addHelpText('after', AUTH_SET_CONTROLLER_HELP_AFTER).action(async(url) => {
    try {
      await handleAuthConfig({ setController: url || true });
    } catch (error) {
      handleCommandError(error, 'auth set-controller');
      process.exit(1);
    }
  });
}

function registerAuthSetEnvironmentSubcommand(auth) {
  auth.command('set-environment <env>')
    .description('Set default environment in config (alias for auth --set-environment)')
    .action(async(env) => {
      try {
        await handleAuthConfig({ setEnvironment: env });
      } catch (error) {
        handleCommandError(error, 'auth set-environment');
        process.exit(1);
      }
    });
}

function setupLoginCommand(program) {
  program.command('login')
    .description('Sign in to Miso Controller (device or credentials flow)')
    .addHelpText('after', LOGIN_HELP_AFTER)
    .option('-c, --controller <url>', 'Controller URL (default: from config or developer ID, e.g. http://localhost:3000)')
    .option('-m, --method <method>', 'Authentication method (device|credentials)', 'device')
    .option('-a, --app <app>', 'Application name (required for credentials method, reads from secrets.local.yaml)')
    .option('--client-id <id>', 'Client ID (for credentials method, overrides secrets.local.yaml)')
    .option('--client-secret <secret>', 'Client Secret (for credentials method, overrides secrets.local.yaml)')
    .option('-e, --environment <env>', 'Environment key (updates root-level environment in config.yaml, e.g., miso, dev, tst, pro)')
    .option('--online', 'Request online-only token (excludes offline_access scope, device flow only)')
    .option('--scope <scopes>', 'Custom OAuth2 scope string (device flow only, default: "openid profile email offline_access")')
    .action(async(options) => {
      try {
        await handleLogin(options);
      } catch (error) {
        logger.error(chalk.red('\n✖ Login failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupLogoutCommand(program) {
  program.command('logout')
    .description('Clear stored tokens (optional filter by controller/env/app)')
    .option('-c, --controller <url>', 'Clear device tokens for specific controller')
    .option('-e, --environment <env>', 'Clear client tokens for specific environment')
    .option('-a, --app <app>', 'Clear client tokens for specific app (requires --environment)')
    .action(async(options) => {
      try {
        await handleLogout(options);
      } catch (error) {
        handleCommandError(error, 'logout');
        process.exit(1);
      }
    });
}

function setupAuthSubcommands(program) {
  const auth = program.command('auth')
    .description('Show auth status or set default controller/environment')
    .addHelpText('after', AUTH_HELP_AFTER)
    .option(
      '--set-controller [url]',
      'Set default controller URL in config; omit url to choose from controllers registered in config'
    )
    .option('--set-environment <env>', 'Set default environment in config')
    .action(createAuthParentAction());

  registerAuthSetControllerSubcommand(auth);
  registerAuthSetEnvironmentSubcommand(auth);

  auth.command('status')
    .description('Show tokens/session for current controller and environment')
    .option('--validate', 'Exit with code 1 when not authenticated (for scripted use, e.g. manual test setup)')
    .action(createAuthStatusAction());
}

/**
 * Sets up authentication commands
 * @param {Command} program - Commander program instance
 */
function setupAuthCommands(program) {
  setupLoginCommand(program);
  setupLogoutCommand(program);
  setupAuthSubcommands(program);
}

module.exports = { setupAuthCommands };
