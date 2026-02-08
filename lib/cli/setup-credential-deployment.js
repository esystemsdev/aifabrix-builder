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
const { runDeploymentList } = require('../commands/deployment-list');

/**
 * Sets up credential and deployment list commands
 * @param {Command} program - Commander program instance
 */
function setupCredentialDeploymentCommands(program) {
  const credential = program
    .command('credential')
    .description('Manage credentials');

  credential
    .command('list')
    .description('List credentials from controller/dataplane (GET /api/v1/credential)')
    .option('--controller <url>', 'Controller URL (default: from config)')
    .option('--active-only', 'List only active credentials')
    .option('--page-size <n>', 'Items per page', '50')
    .action(async(options) => {
      try {
        const opts = {
          controller: options.controller,
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
    .description('List deployments');

  deployment
    .command('list')
    .description('List last N deployments for current environment (default pageSize=50)')
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
