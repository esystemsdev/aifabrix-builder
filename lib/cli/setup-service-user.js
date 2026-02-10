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
const { runServiceUserCreate } = require('../commands/service-user');

/**
 * Sets up service-user commands
 * @param {Command} program - Commander program instance
 */
function setupServiceUserCommands(program) {
  const serviceUser = program
    .command('service-user')
    .description('Create and manage service users (API clients) for integrations and CI')
    .addHelpText('after', `
Service users are dedicated accounts for integrations, CI pipelines, or API clients.
The controller returns a one-time clientSecret on create—save it immediately; it cannot be retrieved again.

Example:
  $ aifabrix service-user create -u api-client-001 -e api@example.com \\
      --redirect-uris "https://app.example.com/callback" --group-names "AI-Fabrix-Developers"

Required: permission service-user:create on the controller. Run "aifabrix login" first.`);

  serviceUser
    .command('create')
    .description('Create a service user and receive a one-time clientSecret (save it now; it will not be shown again)')
    .option('--controller <url>', 'Controller base URL (default: from config)')
    .option('-u, --username <username>', 'Service user username (required)')
    .option('-e, --email <email>', 'Email address (required)')
    .option('--redirect-uris <uris>', 'Comma-separated OAuth2 redirect URIs (required)')
    .option('--group-names <names>', 'Comma-separated group names to assign (required)')
    .option('-d, --description <description>', 'Description for the service user')
    .action(async(options) => {
      try {
        const opts = {
          controller: options.controller,
          username: options.username,
          email: options.email,
          redirectUris: options.redirectUris,
          groupNames: options.groupNames,
          description: options.description
        };
        await runServiceUserCreate(opts);
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'service-user create');
        process.exit(1);
      }
    });
}

module.exports = { setupServiceUserCommands };
