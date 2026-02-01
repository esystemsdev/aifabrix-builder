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
const { listApplications } = require('../app/list');
const { registerApplication } = require('../app/register');
const { rotateSecret } = require('../app/rotate-secret');
const { showApp } = require('../app/show');

/**
 * Setup application management commands
 * @param {Command} program - Commander program instance
 */
function setupAppCommands(program) {
  const app = program
    .command('app')
    .description('Manage applications');

  // Register command (controller and environment from config.yaml)
  app
    .command('register <appKey>')
    .description('Register application and get pipeline credentials')
    .option('-p, --port <port>', 'Application port (default: from variables.yaml)')
    .option('-u, --url <url>', 'Application URL. If omitted: app.url, deployment.dataplaneUrl or deployment.appUrl in variables.yaml; else http://localhost:{build.localPort or port}')
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

  // List command (controller and environment from config.yaml)
  app
    .command('list')
    .description('List applications')
    .action(async(options) => {
      try {
        await listApplications(options);
      } catch (error) {
        logger.error(chalk.red('❌ Failed to list applications:'), error.message);
        process.exit(1);
      }
    });

  // Rotate secret command (controller and environment from config.yaml)
  app
    .command('rotate-secret <appKey>')
    .description('Rotate pipeline ClientSecret for an application')
    .action(async(appKey, options) => {
      try {
        await rotateSecret(appKey, options);
      } catch (error) {
        logger.error(chalk.red('❌ Rotation failed:'), error.message);
        process.exit(1);
      }
    });

  // Show command: show application from controller (online). Same as aifabrix show <appKey> --online.
  app
    .command('show <appKey>')
    .description('Show application from controller (online). Same as aifabrix show <appKey> --online')
    .option('--json', 'Output as JSON')
    .action(async(appKey, options) => {
      try {
        await showApp(appKey, { online: true, json: !!options.json });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

module.exports = { setupAppCommands };

