const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
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

const APP_HELP_AFTER = `
Subcommands:
  register <appKey>     Register app; get pipeline client id/secret
  list                  Applications in current environment
  rotate-secret <key>   New ClientSecret (shown once)
  show <key>            From controller (like show --online)
  deployment <key>      Deployment history for app

Requires: aifabrix login
`;

function setupAppRegisterCommand(app) {
  app.command('register <appKey>')
    .description('Register app; receive pipeline credentials')
    .option('-p, --port <port>', 'Application port (default: from application.yaml)')
    .option('-u, --url <url>', 'Application URL. If omitted: app.url, deployment.dataplaneUrl or deployment.appUrl in application.yaml; else http://localhost:{port})')
    .option('-n, --name <name>', 'Override display name')
    .option('-d, --description <desc>', 'Override description')
    .action(async(appKey, options) => {
      try {
        await registerApplication(appKey, options);
      } catch (error) {
        logger.error(formatBlockingError('Registration failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupAppListCommand(app) {
  app.command('list')
    .description('List apps in current environment')
    .action(async(options) => {
      try {
        await listApplications(options);
      } catch (error) {
        logger.error(formatBlockingError('Failed to list applications:'), error.message);
        process.exit(1);
      }
    });
}

function setupAppRotateSecretCommand(app) {
  app.command('rotate-secret <appKey>')
    .description('Rotate pipeline ClientSecret (one-time display)')
    .action(async(appKey, options) => {
      try {
        await rotateSecret(appKey, options);
      } catch (error) {
        logger.error(formatBlockingError('Rotation failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupAppShowCommand(app) {
  app.command('show <app>')
    .description('App details from controller (same as show --online)')
    .option('--online', 'Fetch from controller (default for this command)')
    .option('--json', 'Output as JSON')
    .option('--permissions', 'Show only list of permissions')
    .option(
      '--verify-cert',
      'For external integrations, verify trust state on the dataplane (requires login)'
    )
    .action(async(appKey, options) => {
      try {
        await showApp(appKey, {
          online: true,
          json: !!options.json,
          permissions: !!options.permissions,
          verifyCert: options.verifyCert === true
        });
      } catch (error) {
        logger.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

function setupAppDeploymentCommand(app) {
  app.command('deployment <appKey>')
    .description('List recent deployments for app in current environment')
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
  const app = program.command('app').description('Controller apps: register, list, secrets, deploy history').addHelpText('after', APP_HELP_AFTER);
  setupAppRegisterCommand(app);
  setupAppListCommand(app);
  setupAppRotateSecretCommand(app);
  setupAppShowCommand(app);
  setupAppDeploymentCommand(app);
}

module.exports = { setupAppCommands };

