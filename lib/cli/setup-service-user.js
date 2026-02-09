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
    .description('Create service users for integrations (one-time secret on create)');

  serviceUser
    .command('create')
    .description('Create a service user (username, email, redirectUris, groupIds); receive one-time clientSecret (save it now)')
    .option('--controller <url>', 'Controller URL (default: from config)')
    .option('-u, --username <username>', 'Service user username (required)')
    .option('-e, --email <email>', 'Email address (required)')
    .option('--redirect-uris <uris>', 'Comma-separated redirect URIs for OAuth2 (required, e.g. https://app.example.com/callback)')
    .option('--group-names <names>', 'Comma-separated group names (required, e.g. AI-Fabrix-Developers)')
    .option('-d, --description <description>', 'Optional description')
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
