/**
 * AI Fabrix Builder CLI Command Definitions
 *
 * This module defines all CLI commands using Commander.js.
 * Commands: up, down, build, run, push, deploy, resolve, json, genkey, doctor
 *
 * @fileoverview Command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const infra = require('./infra');
const app = require('./app');
const secrets = require('./secrets');
const generator = require('./generator');
const validator = require('./validator');
const keyGenerator = require('./key-generator');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { saveConfig } = require('./config');
const { makeApiCall } = require('./utils/api');

/**
 * Sets up all CLI commands on the Commander program instance
 * @param {Command} program - Commander program instance
 */
function setupCommands(program) {
  // Authentication command
  program.command('login')
    .description('Authenticate with Miso Controller')
    .option('-u, --url <url>', 'Controller URL', 'http://localhost:3000')
    .action(async(options) => {
      try {
        console.log(chalk.blue('\n🔐 Logging in to Miso Controller...\n'));

        const controllerUrl = options.url.replace(/\/$/, ''); // Remove trailing slash

        console.log(chalk.gray(`Controller URL: ${controllerUrl}`));

        // Prompt for authentication method
        const authMethod = await inquirer.prompt([{
          type: 'list',
          name: 'method',
          message: 'Choose authentication method:',
          choices: [
            { name: 'Browser-based OAuth (recommended)', value: 'browser' },
            { name: 'ClientId + ClientSecret', value: 'credentials' }
          ]
        }]);

        let token;

        if (authMethod.method === 'browser') {
          // Browser-based OAuth flow
          const { exec } = require('child_process');
          const authUrl = `${controllerUrl}/api/auth/oauth/login`;

          console.log(chalk.yellow('\n⚠️  Opening browser for authentication...'));
          console.log(chalk.gray(`If browser doesn't open, visit: ${authUrl}\n`));

          // Try to open browser based on platform
          const startCommand = process.platform === 'win32' ? 'start' :
            process.platform === 'darwin' ? 'open' : 'xdg-open';
          exec(`${startCommand} "${authUrl}"`);

          // Prompt for token from browser
          const result = await inquirer.prompt([{
            type: 'input',
            name: 'token',
            message: 'Paste the authentication token from the browser:',
            validate: (input) => input.length > 0 || 'Token is required'
          }]);

          token = result.token;

        } else {
          // ClientId + ClientSecret flow
          const credentials = await inquirer.prompt([
            {
              type: 'input',
              name: 'clientId',
              message: 'Client ID:',
              validate: (input) => input.length > 0 || 'Client ID is required'
            },
            {
              type: 'password',
              name: 'clientSecret',
              message: 'Client Secret:',
              mask: '*',
              validate: (input) => input.length > 0 || 'Client Secret is required'
            }
          ]);

          const response = await makeApiCall(`${controllerUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              clientId: credentials.clientId,
              clientSecret: credentials.clientSecret
            })
          });

          if (!response.success) {
            console.error(chalk.red(`❌ Login failed: ${response.error}`));
            process.exit(1);
          }

          token = response.data.token || response.data.accessToken;
        }

        // Save configuration
        await saveConfig({
          apiUrl: controllerUrl,
          token: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

        console.log(chalk.green('\n✅ Successfully logged in!'));
        console.log(chalk.gray(`Controller: ${controllerUrl}`));
        console.log(chalk.gray('Token stored securely in ~/.aifabrix/config.yaml\n'));

      } catch (error) {
        console.error(chalk.red('\n❌ Login failed:'), error.message);
        process.exit(1);
      }
    });

  // Infrastructure commands
  program.command('up')
    .description('Start local infrastructure services (Postgres, Redis, pgAdmin, Redis Commander)')
    .action(async() => {
      try {
        await infra.startInfra();
      } catch (error) {
        handleCommandError(error, 'up');
        process.exit(1);
      }
    });

  program.command('down')
    .description('Stop and remove local infrastructure services')
    .option('-v, --volumes', 'Remove volumes (deletes all data)')
    .action(async(options) => {
      try {
        if (options.volumes) {
          await infra.stopInfraWithVolumes();
        } else {
          await infra.stopInfra();
        }
      } catch (error) {
        handleCommandError(error, 'down');
        process.exit(1);
      }
    });

  // Application commands
  program.command('create <app>')
    .description('Create new application with configuration files')
    .option('-p, --port <port>', 'Application port', '3000')
    .option('-d, --database', 'Requires database')
    .option('-r, --redis', 'Requires Redis')
    .option('-s, --storage', 'Requires file storage')
    .option('-a, --authentication', 'Requires authentication/RBAC')
    .option('-l, --language <lang>', 'Runtime language (typescript/python)')
    .option('-t, --template <name>', 'Template to use (e.g., controller, keycloak)')
    .option('-g, --github', 'Generate GitHub Actions workflows')
    .option('--github-steps <steps>', 'Extra GitHub workflow steps (comma-separated, e.g., npm,test)')
    .option('--main-branch <branch>', 'Main branch name for workflows', 'main')
    .action(async(appName, options) => {
      try {
        await app.createApp(appName, options);
      } catch (error) {
        handleCommandError(error, 'create');
        process.exit(1);
      }
    });

  program.command('build <app>')
    .description('Build container image (auto-detects runtime)')
    .option('-l, --language <lang>', 'Override language detection')
    .option('-f, --force-template', 'Force rebuild from template')
    .option('-t, --tag <tag>', 'Image tag (default: latest)')
    .action(async(appName, options) => {
      try {
        const imageTag = await app.buildApp(appName, options);
        console.log(`✅ Built image: ${imageTag}`);
      } catch (error) {
        handleCommandError(error, 'build');
        process.exit(1);
      }
    });

  program.command('run <app>')
    .description('Run application locally')
    .option('-p, --port <port>', 'Override local port')
    .action(async(appName, options) => {
      try {
        await app.runApp(appName, options);
      } catch (error) {
        handleCommandError(error, 'run');
        process.exit(1);
      }
    });

  // Deployment commands
  program.command('push <app>')
    .description('Push image to Azure Container Registry')
    .option('-r, --registry <registry>', 'ACR registry URL (overrides variables.yaml)')
    .option('-t, --tag <tag>', 'Image tag(s) - comma-separated for multiple (default: latest)')
    .action(async(appName, options) => {
      try {
        await app.pushApp(appName, options);
      } catch (error) {
        handleCommandError(error, 'push');
        process.exit(1);
      }
    });

  program.command('deploy <app>')
    .description('Deploy to Azure via Miso Controller')
    .option('-c, --controller <url>', 'Controller URL')
    .option('-e, --environment <env>', 'Environment (dev, tst, pro)', 'dev')
    .option('--client-id <id>', 'Client ID (overrides config)')
    .option('--client-secret <secret>', 'Client Secret (overrides config)')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .action(async(appName, options) => {
      try {
        await app.deployApp(appName, options);
      } catch (error) {
        handleCommandError(error, 'deploy');
        process.exit(1);
      }
    });

  // Infrastructure status and management
  program.command('doctor')
    .description('Check environment and configuration')
    .action(async() => {
      try {
        const result = await validator.checkEnvironment();
        console.log('\n🔍 AI Fabrix Environment Check\n');

        console.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
        console.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
        console.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);

        if (result.recommendations.length > 0) {
          console.log('\n📋 Recommendations:');
          result.recommendations.forEach(rec => console.log(`  • ${rec}`));
        }

        // Check infrastructure health if Docker is available
        if (result.docker === 'ok') {
          try {
            const health = await infra.checkInfraHealth();
            console.log('\n🏥 Infrastructure Health:');
            Object.entries(health).forEach(([service, status]) => {
              const icon = status === 'healthy' ? '✅' : status === 'unknown' ? '❓' : '❌';
              console.log(`  ${icon} ${service}: ${status}`);
            });
          } catch (error) {
            console.log('\n🏥 Infrastructure: Not running');
          }
        }

        console.log('');
      } catch (error) {
        handleCommandError(error, 'doctor');
        process.exit(1);
      }
    });

  program.command('status')
    .description('Show detailed infrastructure service status')
    .action(async() => {
      try {
        const status = await infra.getInfraStatus();
        console.log('\n📊 Infrastructure Status\n');

        Object.entries(status).forEach(([service, info]) => {
          const icon = info.status === 'running' ? '✅' : '❌';
          console.log(`${icon} ${service}:`);
          console.log(`   Status: ${info.status}`);
          console.log(`   Port: ${info.port}`);
          console.log(`   URL: ${info.url}`);
          console.log('');
        });
      } catch (error) {
        handleCommandError(error, 'status');
        process.exit(1);
      }
    });

  program.command('restart <service>')
    .description('Restart a specific infrastructure service')
    .action(async(service) => {
      try {
        await infra.restartService(service);
        console.log(`✅ ${service} service restarted successfully`);
      } catch (error) {
        handleCommandError(error, 'restart');
        process.exit(1);
      }
    });

  // Utility commands
  program.command('resolve <app>')
    .description('Generate .env file from template')
    .action(async(appName) => {
      try {
        const envPath = await secrets.generateEnvFile(appName);
        console.log(`✓ Generated .env file: ${envPath}`);
      } catch (error) {
        handleCommandError(error, 'resolve');
        process.exit(1);
      }
    });

  program.command('json <app>')
    .description('Generate deployment JSON')
    .action(async(appName) => {
      try {
        const result = await generator.generateDeployJsonWithValidation(appName);
        if (result.success) {
          console.log(`✓ Generated deployment JSON: ${result.path}`);

          if (result.validation.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            result.validation.warnings.forEach(warning => console.log(`   • ${warning}`));
          }
        } else {
          console.log('❌ Validation failed:');
          result.validation.errors.forEach(error => console.log(`   • ${error}`));
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'json');
        process.exit(1);
      }
    });

  program.command('genkey <app>')
    .description('Generate deployment key')
    .action(async(appName) => {
      try {
        const key = await keyGenerator.generateDeploymentKey(appName);
        console.log(`\nDeployment key for ${appName}:`);
        console.log(key);
        console.log(`\nGenerated from: builder/${appName}/variables.yaml`);
      } catch (error) {
        handleCommandError(error, 'genkey');
        process.exit(1);
      }
    });

  program.command('dockerfile <app>')
    .description('Generate Dockerfile for an application')
    .option('-l, --language <lang>', 'Override language detection')
    .option('-f, --force', 'Overwrite existing Dockerfile')
    .action(async(appName, options) => {
      try {
        const dockerfilePath = await app.generateDockerfileForApp(appName, options);
        console.log(chalk.green('\n✅ Dockerfile generated successfully!'));
        console.log(chalk.gray(`Location: ${dockerfilePath}`));
      } catch (error) {
        handleCommandError(error, 'dockerfile');
        process.exit(1);
      }
    });
}

/**
 * Validates command arguments and provides helpful error messages
 * @param {string} command - Command name
 * @param {Object} options - Command options
 * @returns {boolean} True if valid
 */
function validateCommand(_command, _options) {
  // TODO: Implement command validation
  // TODO: Add helpful error messages for common issues
  return true;
}

/**
 * Handles command execution errors with user-friendly messages
 * @param {Error} error - The error that occurred
 * @param {string} command - Command that failed
 */
function handleCommandError(error, command) {
  console.error(`\n❌ Error in ${command} command:`);

  // Provide specific error messages for common issues
  if (error.message.includes('Docker')) {
    console.error('   Docker is not running or not installed.');
    console.error('   Please start Docker Desktop and try again.');
  } else if (error.message.includes('port')) {
    console.error('   Port conflict detected.');
    console.error('   Run "aifabrix doctor" to check which ports are in use.');
  } else if (error.message.includes('permission')) {
    console.error('   Permission denied.');
    console.error('   Make sure you have the necessary permissions to run Docker commands.');
  } else if (error.message.includes('Azure CLI') || error.message.includes('az --version')) {
    console.error('   Azure CLI is not installed.');
    console.error('   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
    console.error('   Run: az login');
  } else if (error.message.includes('authenticate') || error.message.includes('ACR')) {
    console.error('   Azure Container Registry authentication failed.');
    console.error('   Run: az acr login --name <registry-name>');
    console.error('   Or login to Azure: az login');
  } else if (error.message.includes('not found locally') || error.message.includes('not found')) {
    console.error('   Docker image not found.');
    console.error('   Run: aifabrix build <app> first');
  } else if (error.message.includes('Invalid ACR URL') || error.message.includes('Expected format')) {
    console.error('   Invalid registry URL format.');
    console.error('   Use format: *.azurecr.io (e.g., myacr.azurecr.io)');
  } else if (error.message.includes('Registry URL is required')) {
    console.error('   Registry URL is required.');
    console.error('   Provide via --registry flag or configure in variables.yaml under image.registry');
  } else {
    console.error(`   ${error.message}`);
  }

  console.error('\n💡 Run "aifabrix doctor" for environment diagnostics.\n');
}

module.exports = {
  setupCommands,
  validateCommand,
  handleCommandError
};
