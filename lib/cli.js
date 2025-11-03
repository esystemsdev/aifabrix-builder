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
const logger = require('./utils/logger');
const { validateCommand, handleCommandError } = require('./utils/cli-utils');
const { handleLogin } = require('./commands/login');

/**
 * Sets up all CLI commands on the Commander program instance
 * @param {Command} program - Commander program instance
 */
function setupCommands(program) {
  // Authentication command
  program.command('login')
    .description('Authenticate with Miso Controller')
    .option('-u, --url <url>', 'Controller URL', 'http://localhost:3000')
    .option('-m, --method <method>', 'Authentication method (device|credentials)')
    .option('--client-id <id>', 'Client ID (for credentials method)')
    .option('--client-secret <secret>', 'Client Secret (for credentials method)')
    .option('-e, --environment <env>', 'Environment key (for device method, e.g., dev, tst, pro)')
    .action(async(options) => {
      try {
        await handleLogin(options);
      } catch (error) {
        logger.error(chalk.red('\n❌ Login failed:'), error.message);
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
    .option('-t, --template <name>', 'Template to use (e.g., miso-controller, keycloak)')
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
        logger.log(`✅ Built image: ${imageTag}`);
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
        logger.log('\n🔍 AI Fabrix Environment Check\n');

        logger.log(`Docker: ${result.docker === 'ok' ? '✅ Running' : '❌ Not available'}`);
        logger.log(`Ports: ${result.ports === 'ok' ? '✅ Available' : '⚠️  Some ports in use'}`);
        logger.log(`Secrets: ${result.secrets === 'ok' ? '✅ Configured' : '❌ Missing'}`);

        if (result.recommendations.length > 0) {
          logger.log('\n📋 Recommendations:');
          result.recommendations.forEach(rec => logger.log(`  • ${rec}`));
        }

        // Check infrastructure health if Docker is available
        if (result.docker === 'ok') {
          try {
            const health = await infra.checkInfraHealth();
            logger.log('\n🏥 Infrastructure Health:');
            Object.entries(health).forEach(([service, status]) => {
              const icon = status === 'healthy' ? '✅' : status === 'unknown' ? '❓' : '❌';
              logger.log(`  ${icon} ${service}: ${status}`);
            });
          } catch (error) {
            logger.log('\n🏥 Infrastructure: Not running');
          }
        }

        logger.log('');
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
        logger.log('\n📊 Infrastructure Status\n');

        Object.entries(status).forEach(([service, info]) => {
          const icon = info.status === 'running' ? '✅' : '❌';
          logger.log(`${icon} ${service}:`);
          logger.log(`   Status: ${info.status}`);
          logger.log(`   Port: ${info.port}`);
          logger.log(`   URL: ${info.url}`);
          logger.log('');
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
        logger.log(`✅ ${service} service restarted successfully`);
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
        logger.log(`✓ Generated .env file: ${envPath}`);
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
          logger.log(`✓ Generated deployment JSON: ${result.path}`);

          if (result.validation.warnings.length > 0) {
            logger.log('\n⚠️  Warnings:');
            result.validation.warnings.forEach(warning => logger.log(`   • ${warning}`));
          }
        } else {
          logger.log('❌ Validation failed:');
          result.validation.errors.forEach(error => logger.log(`   • ${error}`));
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
        logger.log(`\nDeployment key for ${appName}:`);
        logger.log(key);
        logger.log(`\nGenerated from: builder/${appName}/variables.yaml`);
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
        logger.log(chalk.green('\n✅ Dockerfile generated successfully!'));
        logger.log(chalk.gray(`Location: ${dockerfilePath}`));
      } catch (error) {
        handleCommandError(error, 'dockerfile');
        process.exit(1);
      }
    });
}

module.exports = {
  setupCommands,
  validateCommand,
  handleCommandError
};
