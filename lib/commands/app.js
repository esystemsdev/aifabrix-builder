/**
 * AI Fabrix Builder - Application Registration Commands
 *
 * Handles application registration, listing, and credential rotation
 * Commands: app register, app list, app rotate-secret
 *
 * @fileoverview Application management commands for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { listApplications } = require('../app-list');
const { registerApplication } = require('../app-register');
const { rotateSecret } = require('../app-rotate-secret');

/**
 * Setup application management commands
 * @param {Command} program - Commander program instance
 */
function setupAppCommands(program) {
  const app = program
    .command('app')
    .description('Manage applications');

  // Register command
  app
    .command('register <appKey>')
    .description('Register application and get pipeline credentials')
    .requiredOption('-e, --environment <env>', 'Environment ID or key')
    .option('-p, --port <port>', 'Application port (default: from variables.yaml)')
    .option('-n, --name <name>', 'Override display name')
    .option('-d, --description <desc>', 'Override description')
    .action(async(appKey, options) => {
      try {
        await registerApplication(appKey, options);
      } catch (error) {
        logger.error(chalk.red('❌ Registration failed:'), error.message);
        process.exit(1);
      }
    });

  // List command
  app
    .command('list')
    .description('List applications')
    .requiredOption('-e, --environment <env>', 'Environment ID or key')
    .action(async(options) => {
      try {
        await listApplications(options);
      } catch (error) {
        logger.error(chalk.red('❌ Failed to list applications:'), error.message);
        process.exit(1);
      }
    });

  // Rotate secret command
  app
    .command('rotate-secret <appKey>')
    .description('Rotate pipeline ClientSecret for an application')
    .requiredOption('-e, --environment <env>', 'Environment ID or key')
    .action(async(appKey, options) => {
      try {
        await rotateSecret(appKey, options);
      } catch (error) {
        logger.error(chalk.red('❌ Rotation failed:'), error.message);
        process.exit(1);
      }
    });
}

module.exports = { setupAppCommands };

