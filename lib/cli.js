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

const { Command: _Command } = require('commander');
const _infra = require('./infra');
const _app = require('./app');
const _secrets = require('./secrets');
const _generator = require('./generator');
const _validator = require('./validator');
const _keyGenerator = require('./key-generator');

/**
 * Sets up all CLI commands on the Commander program instance
 * @param {Command} program - Commander program instance
 */
function setupCommands(program) {
  // Infrastructure commands
  program.command('up')
    .description('Start local infrastructure services (Postgres, Redis, pgAdmin, Redis Commander)')
    .action(async() => {
      try {
        await _infra.startInfra();
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
          await _infra.stopInfraWithVolumes();
        } else {
          await _infra.stopInfra();
        }
      } catch (error) {
        handleCommandError(error, 'down');
        process.exit(1);
      }
    });

  // Application commands
  // program.command('create <app>')
  //       .description('Create new application with configuration files')
  //       .option('-p, --port <port>', 'Application port')
  //       .option('-d, --database', 'Requires database')
  //       .option('-r, --redis', 'Requires Redis')
  //       .option('-s, --storage', 'Requires file storage')
  //       .option('-a, --authentication', 'Requires authentication/RBAC')
  //       .option('-l, --language <lang>', 'Runtime language (typescript/python)')
  //       .option('-t, --template <name>', 'Template to use (platform for Keycloak/Miso)')
  //       .action(app.createApp);

  // program.command('build <app>')
  //       .description('Build container image (auto-detects runtime)')
  //       .option('-l, --language <lang>', 'Override language detection')
  //       .option('-f, --force-template', 'Force rebuild from template')
  //       .action(app.buildApp);

  // program.command('run <app>')
  //       .description('Run application locally')
  //       .option('-p, --port <port>', 'Override local port')
  //       .action(app.runApp);

  // Deployment commands
  // program.command('push <app>')
  //       .description('Push image to Azure Container Registry')
  //       .option('-r, --registry <registry>', 'ACR registry URL')
  //       .option('-t, --tag <tag>', 'Image tag')
  //       .action(app.pushApp);

  // program.command('deploy <app>')
  //       .description('Send deploy JSON to Miso Controller API')
  //       .option('-c, --controller <url>', 'Controller URL')
  //       .option('-e, --environment <env>', 'Deployment environment')
  //       .action(app.deployApp);

  // Infrastructure status and management
  program.command('doctor')
    .description('Check environment and configuration')
    .action(async() => {
      try {
        const result = await _validator.checkEnvironment();
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
            const health = await _infra.checkInfraHealth();
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
        const status = await _infra.getInfraStatus();
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
        await _infra.restartService(service);
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
        const envPath = await _secrets.generateEnvFile(appName);
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
        const result = await _generator.generateDeployJsonWithValidation(appName);
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
        const key = await _keyGenerator.generateDeploymentKey(appName);
        console.log(`\nDeployment key for ${appName}:`);
        console.log(key);
        console.log(`\nGenerated from: builder/${appName}/variables.yaml`);
      } catch (error) {
        handleCommandError(error, 'genkey');
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
