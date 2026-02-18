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
const { runAppDeploymentList } = require('./deployment-list');

function setupAppRegisterCommand(app) {
  app.command('register <appKey>')
    .description('Register application and get pipeline credentials')
    .option('-p, --port <port>', 'Application port (default: from application.yaml)')
    .option('-u, --url <url>', 'Application URL. If omitted: app.url, deployment.dataplaneUrl or deployment.appUrl in application.yaml; else http://localhost:{port})')
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
}

function setupAppListCommand(app) {
  app.command('list')
    .description('List applications')
    .action(async(options) => {
      try {
        await listApplications(options);
      } catch (error) {
        logger.error(chalk.red('❌ Failed to list applications:'), error.message);
        process.exit(1);
      }
    });
}

function setupAppRotateSecretCommand(app) {
  app.command('rotate-secret <appKey>')
    .description('Rotate pipeline ClientSecret for an application')
    .action(async(appKey, options) => {
      try {
        await rotateSecret(appKey, options);
      } catch (error) {
        logger.error(chalk.red('❌ Rotation failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupAppShowCommand(app) {
  app.command('show <appKey>')
    .description('Show application from controller (online). Same as aifabrix show <appKey> --online')
    .option('--online', 'Fetch from controller (default for this command)')
    .option('--json', 'Output as JSON')
    .option('--permissions', 'Show only list of permissions')
    .action(async(appKey, options) => {
      try {
        await showApp(appKey, { online: true, json: !!options.json, permissions: !!options.permissions });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function setupAppDeploymentCommand(app) {
  app.command('deployment <appKey>')
    .description('List last N deployments for an application in current environment (default pageSize=50)')
    .option('--controller <url>', 'Controller URL (default: from config)')
    .option('--environment <env>', 'Environment key (default: from config)')
    .option('--page-size <n>', 'Items per page', '50')
    .action(async(appKey, options) => {
      try {
        const opts = {
          controller: options.controller,
          environment: options.environment,
          pageSize: parseInt(options.pageSize, 10) || 50
        };
        await runAppDeploymentList(appKey, opts);
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * Setup application management commands
 * @param {Command} program - Commander program instance
 */
function setupAppCommands(program) {
  const app = program.command('app').description('Manage applications');
  setupAppRegisterCommand(app);
  setupAppListCommand(app);
  setupAppRotateSecretCommand(app);
  setupAppShowCommand(app);
  setupAppDeploymentCommand(app);
}

module.exports = { setupAppCommands };

