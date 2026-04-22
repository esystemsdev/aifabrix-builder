/**
 * CLI credential and deployment list command setup.
 * Commands: credential list, deployment list.
 *
 * @fileoverview Credential and deployment list CLI definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');
const { runCredentialList } = require('../commands/credential-list');
const { runCredentialEnv } = require('../commands/credential-env');
const { runCredentialPush } = require('../commands/credential-push');
const { runDeploymentList } = require('../commands/deployment-list');

const CREDENTIAL_HELP_AFTER = `
Subcommands:
  env <systemKey>   Prompt for KV_* values → integration/<key>/.env
  push <systemKey>  Upload secrets from .env to Dataplane
  list               List credentials (pagination: --page-size)
`;

const DEPLOYMENT_HELP_AFTER = `
Subcommand:
  list   Recent deployments for the current environment
`;

function setupCredentialEnvAndPush(credential) {
  credential
    .command('env <systemKey>')
    .description('Interactive KV_* prompts → integration/<key>/.env')
    .action(async(systemKey, _options) => {
      try {
        await runCredentialEnv(systemKey);
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'credential env');
        process.exit(1);
      }
    });
  credential
    .command('push <systemKey>')
    .description('Push KV_* secrets from .env to Dataplane')
    .action(async(systemKey, _options) => {
      try {
        await runCredentialPush(systemKey);
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'credential push');
        process.exit(1);
      }
    });
}

/**
 * Sets up credential and deployment list commands
 * @param {Command} program - Commander program instance
 */
function setupCredentialDeploymentCommands(program) {
  const credential = program
    .command('credential')
    .description('Dataplane credentials: env, push, list')
    .addHelpText('after', CREDENTIAL_HELP_AFTER);
  setupCredentialEnvAndPush(credential);
  credential
    .command('list')
    .description('List credentials from Dataplane')
    .option('--active-only', 'List only active credentials')
    .option('--page-size <n>', 'Items per page', '50')
    .action(async(options) => {
      try {
        const opts = {
          activeOnly: options.activeOnly,
          pageSize: parseInt(options.pageSize, 10) || 50
        };
        await runCredentialList(opts);
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'credential list');
        process.exit(1);
      }
    });

  const deployment = program
    .command('deployment')
    .description('Controller deployments (list)')
    .addHelpText('after', DEPLOYMENT_HELP_AFTER);

  deployment
    .command('list')
    .description('List recent deployments for current environment')
    .option('--controller <url>', 'Controller URL (default: from config)')
    .option('--environment <env>', 'Environment key (default: from config)')
    .option('--page-size <n>', 'Items per page', '50')
    .action(async(options) => {
      try {
        const opts = {
          controller: options.controller,
          environment: options.environment,
          pageSize: parseInt(options.pageSize, 10) || 50
        };
        await runDeploymentList(opts);
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        handleCommandError(error, 'deployment list');
        process.exit(1);
      }
    });
}

module.exports = { setupCredentialDeploymentCommands };
