/* eslint-disable max-lines */
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
const config = require('./config');
const devConfig = require('./utils/dev-config');
const chalk = require('chalk');
const logger = require('./utils/logger');
const { validateCommand, handleCommandError } = require('./utils/cli-utils');
const { handleLogin } = require('./commands/login');
const { handleSecure } = require('./commands/secure');
const { handleSecretsSet } = require('./commands/secrets-set');

/**
 * Sets up all CLI commands on the Commander program instance
 * @param {Command} program - Commander program instance
 */
function setupCommands(program) {
  // Authentication command
  program.command('login')
    .description('Authenticate with Miso Controller')
    .option('-c, --controller <url>', 'Controller URL', 'http://localhost:3000')
    .option('-m, --method <method>', 'Authentication method (device|credentials)')
    .option('-a, --app <app>', 'Application name (required for credentials method, reads from secrets.local.yaml)')
    .option('--client-id <id>', 'Client ID (for credentials method, overrides secrets.local.yaml)')
    .option('--client-secret <secret>', 'Client Secret (for credentials method, overrides secrets.local.yaml)')
    .option('-e, --environment <env>', 'Environment key (updates root-level environment in config.yaml, e.g., miso, dev, tst, pro)')
    .option('--offline', 'Request offline token (adds offline_access scope, device flow only)')
    .option('--scope <scopes>', 'Custom OAuth2 scope string (device flow only, default: "openid profile email")')
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
    .option('-d, --developer <id>', 'Set developer ID and start infrastructure')
    .action(async(options) => {
      try {
        let developerId = null;
        if (options.developer) {
          const id = parseInt(options.developer, 10);
          if (isNaN(id) || id < 0) {
            throw new Error('Developer ID must be a non-negative number (0 = default infra, > 0 = developer-specific)');
          }
          await config.setDeveloperId(id);
          process.env.AIFABRIX_DEVELOPERID = id.toString();
          developerId = id;
          logger.log(chalk.green(`✓ Developer ID set to ${id}`));
        }
        await infra.startInfra(developerId);
      } catch (error) {
        handleCommandError(error, 'up');
        process.exit(1);
      }
    });

  program.command('down [app]')
    .description('Stop and remove local infrastructure services or a specific application')
    .option('-v, --volumes', 'Remove volumes (deletes all data)')
    .action(async(appName, options) => {
      try {
        // If app name is provided, stop/remove that application (optionally volumes)
        if (typeof appName === 'string' && appName.trim().length > 0) {
          await app.downApp(appName, { volumes: !!options.volumes });
        } else {
          // Otherwise, stop/remove infrastructure
          if (options.volumes) {
            await infra.stopInfraWithVolumes();
          } else {
            await infra.stopInfra();
          }
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
    .option('--type <type>', 'Application type (webapp, api, service, functionapp, external)', 'webapp')
    .option('--app', 'Generate minimal application files (package.json, index.ts or requirements.txt, main.py)')
    .option('-g, --github', 'Generate GitHub Actions workflows')
    .option('--github-steps <steps>', 'Extra GitHub workflow steps (comma-separated, e.g., npm,test)')
    .option('--main-branch <branch>', 'Main branch name for workflows', 'main')
    .action(async(appName, options) => {
      try {
        // Validate type if provided
        const validTypes = ['webapp', 'api', 'service', 'functionapp', 'external'];
        if (options.type && !validTypes.includes(options.type)) {
          throw new Error(`Invalid type: ${options.type}. Must be one of: ${validTypes.join(', ')}`);
        }
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
    .option('-d, --debug', 'Enable debug output with detailed container information')
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

  program.command('environment deploy <env>')
    .alias('env deploy')
    .description('Deploy/setup environment in Miso Controller')
    .option('-c, --controller <url>', 'Controller URL (required)')
    .option('--config <file>', 'Environment configuration file')
    .option('--skip-validation', 'Skip environment validation')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .action(async(envKey, options) => {
      try {
        const environmentDeploy = require('./environment-deploy');
        await environmentDeploy.deployEnvironment(envKey, options);
      } catch (error) {
        handleCommandError(error, 'environment deploy');
        process.exit(1);
      }
    });

  program.command('deploy <app>')
    .description('Deploy to Azure via Miso Controller')
    .option('-c, --controller <url>', 'Controller URL')
    .option('-e, --environment <env>', 'Environment (miso, dev, tst, pro)', 'dev')
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
    .description('Show detailed infrastructure service status and running applications')
    .action(async() => {
      try {
        const status = await infra.getInfraStatus();
        logger.log('\n📊 Infrastructure Status\n');

        Object.entries(status).forEach(([service, info]) => {
          // Normalize status value for comparison (handle edge cases)
          const normalizedStatus = String(info.status).trim().toLowerCase();
          const icon = normalizedStatus === 'running' ? '✅' : '❌';
          logger.log(`${icon} ${service}:`);
          logger.log(`   Status: ${info.status}`);
          logger.log(`   Port: ${info.port}`);
          logger.log(`   URL: ${info.url}`);
          logger.log('');
        });

        // Show running applications
        const apps = await infra.getAppStatus();
        if (apps.length > 0) {
          logger.log('📱 Running Applications\n');
          apps.forEach((app) => {
            const normalizedStatus = String(app.status).trim().toLowerCase();
            const icon = normalizedStatus.includes('running') || normalizedStatus.includes('up') ? '✅' : '❌';
            logger.log(`${icon} ${app.name}:`);
            logger.log(`   Container: ${app.container}`);
            logger.log(`   Port: ${app.port}`);
            logger.log(`   Status: ${app.status}`);
            logger.log(`   URL: ${app.url}`);
            logger.log('');
          });
        }
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
    .description('Generate .env file from template and validate application files')
    .option('-f, --force', 'Generate missing secret keys in secrets file')
    .option('--skip-validation', 'Skip file validation after generating .env')
    .action(async(appName, options) => {
      try {
        // builder/.env should use docker context (postgres:5432)
        // apps/.env (if envOutputPath is set) will be generated with local context by processEnvVariables
        const envPath = await secrets.generateEnvFile(appName, undefined, 'docker', options.force);
        logger.log(`✓ Generated .env file: ${envPath}`);

        // Validate application files after generating .env
        if (!options.skipValidation) {
          const validate = require('./validate');
          const result = await validate.validateAppOrFile(appName);
          validate.displayValidationResults(result);
          if (!result.valid) {
            logger.log(chalk.yellow('\n⚠️  Validation found errors. Fix them before deploying.'));
            process.exit(1);
          }
        }
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

          if (result.validation.warnings && result.validation.warnings.length > 0) {
            logger.log('\n⚠️  Warnings:');
            result.validation.warnings.forEach(warning => logger.log(`   • ${warning}`));
          }
        } else {
          logger.log('❌ Validation failed:');
          if (result.validation.errors && result.validation.errors.length > 0) {
            result.validation.errors.forEach(error => logger.log(`   • ${error}`));
          }
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
        // Generate JSON first, then extract key from it
        const jsonPath = await generator.generateDeployJson(appName);

        // Read the generated JSON file
        const fs = require('fs');
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const deployment = JSON.parse(jsonContent);

        // Extract deploymentKey from JSON
        const key = deployment.deploymentKey;

        if (!key) {
          throw new Error('deploymentKey not found in generated JSON');
        }

        logger.log(`\nDeployment key for ${appName}:`);
        logger.log(key);
        logger.log(chalk.gray(`\nGenerated from: ${jsonPath}`));
      } catch (error) {
        handleCommandError(error, 'genkey');
        process.exit(1);
      }
    });

  // Validation command
  program.command('validate <appOrFile>')
    .description('Validate application or external integration file')
    .action(async(appOrFile) => {
      try {
        const validate = require('./validate');
        const result = await validate.validateAppOrFile(appOrFile);
        validate.displayValidationResults(result);
        if (!result.valid) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'validate');
        process.exit(1);
      }
    });

  // Diff command
  program.command('diff <file1> <file2>')
    .description('Compare two configuration files (for deployment pipeline)')
    .action(async(file1, file2) => {
      try {
        const diff = require('./diff');
        const result = await diff.compareFiles(file1, file2);
        diff.formatDiffOutput(result);
        if (!result.identical) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'diff');
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

  // Developer configuration commands
  program.command('dev config')
    .description('Show or set developer configuration')
    .option('--set-id <id>', 'Set developer ID')
    .action(async(cmdName, opts) => {
      try {
        // For commands with spaces like 'dev config', Commander.js passes command name as first arg
        // Options are passed as second arg, or if only one arg, it might be the command name
        const options = typeof cmdName === 'object' && cmdName !== null ? cmdName : (opts || {});
        // Commander.js converts --set-id to setId in options object
        const setIdValue = options.setId || options['set-id'];
        if (setIdValue) {
          const digitsOnly = /^[0-9]+$/.test(setIdValue);
          if (!digitsOnly) {
            throw new Error('Developer ID must be a non-negative digit string (0 = default infra, > 0 = developer-specific)');
          }
          // Preserve the original string value to maintain leading zeros (e.g., "01")
          await config.setDeveloperId(setIdValue);
          process.env.AIFABRIX_DEVELOPERID = setIdValue;
          logger.log(chalk.green(`✓ Developer ID set to ${setIdValue}`));
          // Convert to number only for getDevPorts (which requires a number)
          const devIdNum = parseInt(setIdValue, 10);
          // Use the ID we just set instead of reading from file to avoid race conditions
          const ports = devConfig.getDevPorts(devIdNum);
          logger.log('\n🔧 Developer Configuration\n');
          logger.log(`Developer ID: ${setIdValue}`);
          logger.log('\nPorts:');
          logger.log(`  App: ${ports.app}`);
          logger.log(`  Postgres: ${ports.postgres}`);
          logger.log(`  Redis: ${ports.redis}`);
          logger.log(`  pgAdmin: ${ports.pgadmin}`);
          logger.log(`  Redis Commander: ${ports.redisCommander}`);

          // Display configuration variables if set
          const aifabrixHome = await config.getAifabrixHomeOverride();
          const aifabrixSecrets = await config.getAifabrixSecretsPath();
          const aifabrixEnvConfig = await config.getAifabrixEnvConfigPath();

          if (aifabrixHome || aifabrixSecrets || aifabrixEnvConfig) {
            logger.log('\nConfiguration:');
            if (aifabrixHome) {
              logger.log(`  aifabrix-home: ${aifabrixHome}`);
            }
            if (aifabrixSecrets) {
              logger.log(`  aifabrix-secrets: ${aifabrixSecrets}`);
            }
            if (aifabrixEnvConfig) {
              logger.log(`  aifabrix-env-config: ${aifabrixEnvConfig}`);
            }
          }
          logger.log('');
          return;
        }

        const devId = await config.getDeveloperId();
        // Convert string developer ID to number for getDevPorts
        const devIdNum = parseInt(devId, 10);
        const ports = devConfig.getDevPorts(devIdNum);
        logger.log('\n🔧 Developer Configuration\n');
        logger.log(`Developer ID: ${devId}`);
        logger.log('\nPorts:');
        logger.log(`  App: ${ports.app}`);
        logger.log(`  Postgres: ${ports.postgres}`);
        logger.log(`  Redis: ${ports.redis}`);
        logger.log(`  pgAdmin: ${ports.pgadmin}`);
        logger.log(`  Redis Commander: ${ports.redisCommander}`);

        // Display configuration variables if set
        const aifabrixHome = await config.getAifabrixHomeOverride();
        const aifabrixSecrets = await config.getAifabrixSecretsPath();
        const aifabrixEnvConfig = await config.getAifabrixEnvConfigPath();

        if (aifabrixHome || aifabrixSecrets || aifabrixEnvConfig) {
          logger.log('\nConfiguration:');
          if (aifabrixHome) {
            logger.log(`  aifabrix-home: ${aifabrixHome}`);
          }
          if (aifabrixSecrets) {
            logger.log(`  aifabrix-secrets: ${aifabrixSecrets}`);
          }
          if (aifabrixEnvConfig) {
            logger.log(`  aifabrix-env-config: ${aifabrixEnvConfig}`);
          }
        }
        logger.log('');
      } catch (error) {
        handleCommandError(error, 'dev config');
        process.exit(1);
      }
    });

  // Secrets management commands
  const secretsCmd = program
    .command('secrets')
    .description('Manage secrets in secrets files');

  secretsCmd
    .command('set <key> <value>')
    .description('Set a secret value in secrets file')
    .option('--shared', 'Save to general secrets file (from config.yaml aifabrix-secrets) instead of user secrets')
    .action(async(key, value, options) => {
      try {
        await handleSecretsSet(key, value, options);
      } catch (error) {
        handleCommandError(error, 'secrets set');
        process.exit(1);
      }
    });

  // Security command
  program.command('secure')
    .description('Encrypt secrets in secrets.local.yaml files for ISO 27001 compliance')
    .option('--secrets-encryption <key>', 'Encryption key (32 bytes, hex or base64)')
    .action(async(options) => {
      try {
        await handleSecure(options);
      } catch (error) {
        handleCommandError(error, 'secure');
        process.exit(1);
      }
    });
}

module.exports = {
  setupCommands,
  validateCommand,
  handleCommandError
};
