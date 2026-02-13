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

function setupLoginCommand(program) {
  program.command('login')
    .description('Authenticate with Miso Controller')
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
        logger.error(chalk.red('\n❌ Login failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupLogoutCommand(program) {
  program.command('logout')
    .description('Clear authentication tokens')
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
  const authStatusHandler = async(options) => {
    try {
      await handleAuthStatus(options);
    } catch (error) {
      handleCommandError(error, 'auth status');
      process.exit(1);
    }
  };
  const auth = program.command('auth').description('Authentication commands');
  auth.command('status')
    .description('Display authentication status for current controller and environment')
    .action(authStatusHandler);
  auth.command('config')
    .description('Configure authentication settings (controller, environment)')
    .option('--set-controller <url>', 'Set default controller URL')
    .option('--set-environment <env>', 'Set default environment')
    .action(async(options) => {
      try {
        await handleAuthConfig(options);
      } catch (error) {
        handleCommandError(error, 'auth config');
        process.exit(1);
      }
    });
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
