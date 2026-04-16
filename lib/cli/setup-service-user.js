/**
 * CLI service-user command setup.
 * Command: service-user create (create service user, get one-time secret).
 *
 * @fileoverview Service user CLI definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const {
  runServiceUserCreate,
  runServiceUserList,
  runServiceUserRotateSecret,
  runServiceUserDelete,
  runServiceUserUpdateGroups,
  runServiceUserUpdateRedirectUris
} = require('../commands/service-user');

const HELP_AFTER = `
Service users are dedicated accounts for integrations, CI pipelines, or API clients.
Use: list (service-user:read), create (service-user:create), rotate-secret, update-groups, update-redirect-uris (service-user:update), delete (service-user:delete).
The controller returns a one-time clientSecret on create and rotate-secret—save it immediately; it cannot be retrieved again.

Examples:
  $ aifabrix service-user create -u postman -e postman@aifabrix.dev \\
      --redirect-uris https://oauth.pstmn.io/v1/callback --group-names AI-Fabrix-Platform-Admins
  $ aifabrix service-user list
  $ aifabrix service-user rotate-secret --id <uuid>
  $ aifabrix service-user delete --id <uuid>
  $ aifabrix service-user update-groups --id <uuid> --group-names Group1,Group2
  $ aifabrix service-user update-redirect-uris --id <uuid> --redirect-uris https://app.example.com/callback

Run "aifabrix login" first.`;

function parseOptionalInt(val) {
  return (val !== undefined && val !== null) ? parseInt(val, 10) : undefined;
}

function addCreateCommand(serviceUser) {
  serviceUser.command('create')
    .description('Create a service user and receive a one-time clientSecret (save it now; it will not be shown again)')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('-u, --username <username>', 'Service user username (required)')
    .option('-e, --email <email>', 'Email address (required)')
    .option('--redirect-uris <uris>', 'Comma-separated OAuth2 redirect URIs (required)')
    .option('--group-names <names>', 'Comma-separated group names to assign (required)')
    .option('-d, --description <description>', 'Description for the service user')
    .action(async(options) => {
      try {
        await runServiceUserCreate({
          controller: options.controller,
          username: options.username,
          email: options.email,
          redirectUris: options.redirectUris,
          groupNames: options.groupNames,
          description: options.description
        });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'service-user create');
        process.exit(1);
      }
    });
}

function addListCommand(serviceUser) {
  serviceUser.command('list')
    .description('List service users (supports pagination and search)')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--page <n>', 'Page number')
    .option('--page-size <n>', 'Items per page')
    .option('--search <term>', 'Search term')
    .option('--sort <field>', 'Sort field/direction')
    .option('--filter <expr>', 'Filter expression')
    .action(async(options) => {
      try {
        await runServiceUserList({
          controller: options.controller,
          page: parseOptionalInt(options.page),
          pageSize: parseOptionalInt(options.pageSize),
          search: options.search,
          sort: options.sort,
          filter: options.filter
        });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'service-user list');
        process.exit(1);
      }
    });
}

function addRotateSecretCommand(serviceUser) {
  serviceUser.command('rotate-secret')
    .description('Rotate (regenerate) secret for a service user; new secret shown once only')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--id <uuid>', 'Service user ID (required)')
    .action(async(options) => {
      try {
        await runServiceUserRotateSecret({ controller: options.controller, id: options.id });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'service-user rotate-secret');
        process.exit(1);
      }
    });
}

function addDeleteCommand(serviceUser) {
  serviceUser.command('delete')
    .description('Delete (deactivate) a service user')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--id <uuid>', 'Service user ID (required)')
    .action(async(options) => {
      try {
        await runServiceUserDelete({ controller: options.controller, id: options.id });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'service-user delete');
        process.exit(1);
      }
    });
}

function addUpdateGroupsCommand(serviceUser) {
  serviceUser.command('update-groups')
    .description('Update group assignments for a service user')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--id <uuid>', 'Service user ID (required)')
    .option('--group-names <names>', 'Comma-separated group names (required)')
    .action(async(options) => {
      try {
        await runServiceUserUpdateGroups({
          controller: options.controller,
          id: options.id,
          groupNames: options.groupNames
        });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'service-user update-groups');
        process.exit(1);
      }
    });
}

function addUpdateRedirectUrisCommand(serviceUser) {
  serviceUser.command('update-redirect-uris')
    .description('Update redirect URIs for a service user (min 1)')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('--id <uuid>', 'Service user ID (required)')
    .option('--redirect-uris <uris>', 'Comma-separated redirect URIs (required, min 1)')
    .action(async(options) => {
      try {
        await runServiceUserUpdateRedirectUris({
          controller: options.controller,
          id: options.id,
          redirectUris: options.redirectUris
        });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'service-user update-redirect-uris');
        process.exit(1);
      }
    });
}

/**
 * Sets up service-user commands
 * @param {Command} program - Commander program instance
 */
function setupServiceUserCommands(program) {
  const serviceUser = program
    .command('service-user')
    .description('OAuth service users on Controller (integrations, CI)')
    .addHelpText('after', HELP_AFTER);
  addCreateCommand(serviceUser);
  addListCommand(serviceUser);
  addRotateSecretCommand(serviceUser);
  addDeleteCommand(serviceUser);
  addUpdateGroupsCommand(serviceUser);
  addUpdateRedirectUrisCommand(serviceUser);
}

module.exports = { setupServiceUserCommands };
