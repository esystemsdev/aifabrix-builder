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

const infra = require('./infrastructure');
const app = require('./app');
const secrets = require('./core/secrets');
const generator = require('./generator');
const validator = require('./validation/validator');
const config = require('./core/config');
const devConfig = require('./utils/dev-config');
const chalk = require('chalk');
const path = require('path');
const logger = require('./utils/logger');
const { validateCommand, handleCommandError } = require('./utils/cli-utils');
const { handleLogin } = require('./commands/login');
const { handleLogout } = require('./commands/logout');
const { handleAuthStatus } = require('./commands/auth-status');
const { handleSecure } = require('./commands/secure');
const { handleSecretsSet } = require('./commands/secrets-set');
const { handleAuthConfig } = require('./commands/auth-config');
const { setupAppCommands: setupAppManagementCommands } = require('./commands/app');
const { setupDatasourceCommands } = require('./commands/datasource');
const { handleUpMiso } = require('./commands/up-miso');
const { handleUpDataplane } = require('./commands/up-dataplane');

/**
 * Sets up authentication commands
 * @param {Command} program - Commander program instance
 */
function setupAuthCommands(program) {
  program.command('login')
    .description('Authenticate with Miso Controller')
    .option('-c, --controller <url>', 'Controller URL (default: from config or developer ID, e.g. http://localhost:3000)')
    .option('-m, --method <method>', 'Authentication method (device|credentials)', 'device')
    .option('-a, --app <app>', 'Application name (required for credentials method, reads from secrets.local.yaml)')
    .option('--client-id <id>', 'Client ID (for credentials method, overrides secrets.local.yaml)')
    .option('--client-secret <secret>', 'Client Secret (for credentials method, overrides secrets.local.yaml)')
    .option('-e, --environment <env>', 'Environment key (updates root-level environment in config.yaml, e.g., miso, dev, tst, pro)')
    .option('--online', 'Request online-only token (excludes offline_access scope, device flow only)')
    .option('--scope <scopes>', 'Custom OAuth2 scope string (device flow only, default: "openid profile email offline_access")')
    .action(async(options) => {
      try {
        await handleLogin(options);
      } catch (error) {
        logger.error(chalk.red('\n❌ Login failed:'), error.message);
        process.exit(1);
      }
    });

  program.command('logout')
    .description('Clear authentication tokens')
    .option('-c, --controller <url>', 'Clear device tokens for specific controller')
    .option('-e, --environment <env>', 'Clear client tokens for specific environment')
    .option('-a, --app <app>', 'Clear client tokens for specific app (requires --environment)')
    .action(async(options) => {
      try {
        await handleLogout(options);
      } catch (error) {
        handleCommandError(error, 'logout');
        process.exit(1);
      }
    });

  const authStatusHandler = async(options) => {
    try {
      await handleAuthStatus(options);
    } catch (error) {
      handleCommandError(error, 'auth status');
      process.exit(1);
    }
  };

  // Use nested command pattern for multi-word commands (like environment deploy)
  const auth = program
    .command('auth')
    .description('Authentication commands');

  auth
    .command('status')
    .description('Display authentication status for current controller and environment')
    .action(authStatusHandler);

  auth
    .command('config')
    .description('Configure authentication settings (controller, environment)')
    .option('--set-controller <url>', 'Set default controller URL')
    .option('--set-environment <env>', 'Set default environment')
    .action(async(options) => {
      try {
        await handleAuthConfig(options);
      } catch (error) {
        handleCommandError(error, 'auth config');
        process.exit(1);
      }
    });
}

/**
 * Runs the up command: resolves developer ID, traefik, and starts infra.
 * @param {Object} options - Commander options (developer, traefik)
 * @returns {Promise<void>}
 */
async function runUpCommand(options) {
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
  const cfg = await config.getConfig();
  if (options.traefik === true) {
    cfg.traefik = true;
    await config.saveConfig(cfg);
    logger.log(chalk.green('✓ Traefik enabled and saved to config'));
  } else if (options.traefik === false) {
    cfg.traefik = false;
    await config.saveConfig(cfg);
    logger.log(chalk.green('✓ Traefik disabled and saved to config'));
  }
  const useTraefik = options.traefik === true ? true : (options.traefik === false ? false : !!(cfg.traefik));
  await infra.startInfra(developerId, { traefik: useTraefik });
}

/**
 * Sets up infrastructure commands
 * @param {Command} program - Commander program instance
 */
function setupInfraCommands(program) {
  program.command('up')
    .description('Start local infrastructure services (Postgres, Redis, pgAdmin, Redis Commander)')
    .option('-d, --developer <id>', 'Set developer ID and start infrastructure')
    .option('--traefik', 'Include Traefik reverse proxy and save to config')
    .option('--no-traefik', 'Exclude Traefik and save to config')
    .action(async(options) => {
      try {
        await runUpCommand(options);
      } catch (error) {
        handleCommandError(error, 'up');
        process.exit(1);
      }
    });

  program.command('up-miso')
    .description('Install keycloak, miso-controller, and dataplane from images (no build). Infra must be up. Uses auto-generated secrets for testing.')
    .option('-r, --registry <url>', 'Override registry for all apps (e.g. myacr.azurecr.io)')
    .option('--registry-mode <mode>', 'Override registry mode (acr|external)')
    .option('-i, --image <key>=<value>', 'Override image (e.g. keycloak=myreg/k:v1, miso-controller=myreg/m:v1, dataplane=myreg/d:v1); can be repeated', (v, prev) => (prev || []).concat([v]))
    .action(async(options) => {
      try {
        await handleUpMiso(options);
      } catch (error) {
        handleCommandError(error, 'up-miso');
        process.exit(1);
      }
    });

  program.command('up-dataplane')
    .description('Register and deploy dataplane app in dev (requires login, environment must be dev)')
    .option('-r, --registry <url>', 'Override registry for dataplane image')
    .option('--registry-mode <mode>', 'Override registry mode (acr|external)')
    .option('-i, --image <ref>', 'Override dataplane image reference (e.g. myreg/dataplane:latest)')
    .action(async(options) => {
      try {
        await handleUpDataplane(options);
      } catch (error) {
        handleCommandError(error, 'up-dataplane');
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
}

/**
 * Normalize options for external system creation
 * @function normalizeExternalOptions
 * @param {Object} options - Raw CLI options
 * @returns {Object} Normalized options
 */
function normalizeExternalOptions(options) {
  const normalized = { ...options };
  if (options.displayName) normalized.systemDisplayName = options.displayName;
  if (options.description) normalized.systemDescription = options.description;
  if (options.systemType) normalized.systemType = options.systemType;
  if (options.authType) normalized.authType = options.authType;
  if (options.datasources !== undefined) {
    const parsedCount = parseInt(options.datasources, 10);
    if (Number.isNaN(parsedCount) || parsedCount < 1 || parsedCount > 10) {
      throw new Error('Datasources count must be a number between 1 and 10');
    }
    normalized.datasourceCount = parsedCount;
  }
  if (options.controller) {
    normalized.controller = true;
    normalized.controllerUrl = options.controller;
  }
  return normalized;
}

/**
 * Validate required options for non-interactive external creation
 * @function validateNonInteractiveExternalOptions
 * @param {Object} normalizedOptions - Normalized options
 * @throws {Error} If required options are missing
 */
function validateNonInteractiveExternalOptions(normalizedOptions) {
  const missing = [];
  if (!normalizedOptions.systemDisplayName) missing.push('--display-name');
  if (!normalizedOptions.systemDescription) missing.push('--description');
  if (!normalizedOptions.systemType) missing.push('--system-type');
  if (!normalizedOptions.authType) missing.push('--auth-type');
  if (!normalizedOptions.datasourceCount) missing.push('--datasources');
  if (missing.length > 0) {
    throw new Error(`Missing required options for non-interactive external create: ${missing.join(', ')}`);
  }
  if (!Object.prototype.hasOwnProperty.call(normalizedOptions, 'github')) {
    normalizedOptions.github = false;
  }
  if (!Object.prototype.hasOwnProperty.call(normalizedOptions, 'controller')) {
    normalizedOptions.controller = false;
  }
}

/**
 * Handle create command execution
 * @async
 * @function handleCreateCommand
 * @param {string} appName - Application name
 * @param {Object} options - CLI options
 */
async function handleCreateCommand(appName, options) {
  const validTypes = ['webapp', 'api', 'service', 'functionapp', 'external'];
  if (options.type && !validTypes.includes(options.type)) {
    throw new Error(`Invalid type: ${options.type}. Must be one of: ${validTypes.join(', ')}`);
  }

  const wizardOptions = { app: appName, ...options };
  const normalizedOptions = normalizeExternalOptions(options);

  const isExternalType = options.type === 'external';
  const isNonInteractive = process.stdin && process.stdin.isTTY === false;

  if (isExternalType && !options.wizard && isNonInteractive) {
    validateNonInteractiveExternalOptions(normalizedOptions);
  }

  const shouldUseWizard = options.wizard && (options.type === 'external' || (!options.type && validTypes.includes('external')));
  if (shouldUseWizard) {
    const { handleWizard } = require('./commands/wizard');
    await handleWizard(wizardOptions);
  } else {
    await app.createApp(appName, normalizedOptions);
  }
}

/**
 * Sets up application lifecycle commands
 * @param {Command} program - Commander program instance
 */
function setupAppCommands(program) {
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
    .option('--wizard', 'Use interactive wizard for external system creation')
    .option('--display-name <name>', 'External system display name')
    .option('--description <desc>', 'External system description')
    .option('--system-type <type>', 'External system type (openapi, mcp, custom)')
    .option('--auth-type <type>', 'External system auth type (oauth2, apikey, basic)')
    .option('--datasources <count>', 'Number of datasources to create')
    .action(async(appName, options) => {
      try {
        await handleCreateCommand(appName, options);
      } catch (error) {
        handleCommandError(error, 'create');
        process.exit(1);
      }
    });

  program.command('wizard')
    .description('Create or extend external systems (OpenAPI, MCP, or known platforms like HubSpot) via guided steps or a config file')
    .option('-a, --app <app>', 'Application name; skips the prompt in interactive mode')
    .option('--config <file>', 'Run headless using a wizard.yaml file (appName, mode, source, credential, preferences)')
    .addHelpText('after', `
Examples:
  $ aifabrix wizard                    Run interactively (prompts for app name and steps)
  $ aifabrix wizard -a my-integration Run interactively with app name set
  $ aifabrix wizard --config wizard.yaml  Run headless from a wizard config file

Headless config (wizard.yaml) must include: appName, mode (create-system|add-datasource), source (type + filePath/url/platform).
See integration/hubspot/wizard-hubspot-e2e.yaml for an example.`)
    .action(async(options) => {
      try {
        const { handleWizard } = require('./commands/wizard');
        await handleWizard(options);
      } catch (error) {
        handleCommandError(error, 'wizard');
        process.exit(1);
      }
    });

  program.command('build <app>')
    .description('Build container image (auto-detects runtime)')
    .option('-l, --language <lang>', 'Override language detection')
    .option('-f, --force-template', 'Force rebuild from template')
    .option('-t, --tag <tag>', 'Image tag (default: latest). Set image.tag in variables.yaml to match for deploy.')
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

/**
 * Sets up environment deployment commands
 * @param {Command} program - Commander program instance
 */
function setupEnvironmentCommands(program) {
  const deployEnvHandler = async(envKey, options) => {
    try {
      const environmentDeploy = require('./deployment/environment');
      await environmentDeploy.deployEnvironment(envKey, options);
    } catch (error) {
      handleCommandError(error, 'environment deploy');
      process.exit(1);
    }
  };

  const environment = program
    .command('environment')
    .description('Manage environments');

  environment
    .command('deploy <env>')
    .description('Deploy/setup environment in Miso Controller')
    .option('--config <file>', 'Environment configuration file')
    .option('--skip-validation', 'Skip environment validation')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .action(deployEnvHandler);

  // Alias: env deploy (register as separate command since Commander.js doesn't support multi-word aliases)
  const env = program
    .command('env')
    .description('Environment management (alias for environment)');

  env
    .command('deploy <env>')
    .description('Deploy/setup environment in Miso Controller')
    .option('--config <file>', 'Environment configuration file')
    .option('--skip-validation', 'Skip environment validation')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .action(deployEnvHandler);
}

/**
 * Handles split-json command logic
 * @async
 * @function handleSplitJsonCommand
 * @param {string} appName - Application name
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Paths to generated files
 */
async function handleSplitJsonCommand(appName, options) {
  const fs = require('fs');
  const { detectAppType, getDeployJsonPath } = require('./utils/paths');
  const { appPath, appType } = await detectAppType(appName, options);

  const outputDir = options.output || appPath;
  if (appType === 'external') {
    const schemaPath = path.join(appPath, 'application-schema.json');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`application-schema.json not found: ${schemaPath}`);
    }
    return generator.splitExternalApplicationSchema(schemaPath, outputDir);
  }

  const deployJsonPath = getDeployJsonPath(appName, appType, true);
  if (!fs.existsSync(deployJsonPath)) {
    throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
  }

  return generator.splitDeployJson(deployJsonPath, outputDir);
}

/**
 * Logs split-json results
 * @function logSplitJsonResult
 * @param {Object} result - Generated file paths
 * @returns {void}
 */
function logSplitJsonResult(result) {
  logger.log(chalk.green('\n✓ Successfully split deployment JSON into component files:'));
  logger.log(`  • env.template: ${result.envTemplate}`);
  logger.log(`  • variables.yaml: ${result.variables}`);
  if (result.rbac) {
    logger.log(`  • rbac.yml: ${result.rbac}`);
  }
  logger.log(`  • README.md: ${result.readme}`);
}

/**
 * Sets up utility commands
 * @param {Command} program - Commander program instance
 */
function setupUtilityCommands(program) {
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
          const validate = require('./validation/validate');
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
    .description('Generate deployment JSON (aifabrix-deploy.json for normal apps, application-schema.json for external systems)')
    .option('--type <type>', 'Application type (external) - if set, only checks integration folder')
    .action(async(appName, options) => {
      try {
        const result = await generator.generateDeployJsonWithValidation(appName, options);
        if (result.success) {
          const fileName = result.path.includes('application-schema.json') ? 'application-schema.json' : 'deployment JSON';
          logger.log(`✓ Generated ${fileName}: ${result.path}`);

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

  program.command('split-json <app>')
    .description('Split deployment JSON into component files (env.template, variables.yaml, rbac.yml, README.md)')
    .option('-o, --output <dir>', 'Output directory for component files (defaults to same directory as JSON)')
    .option('--type <type>', 'Application type (external) - if set, only checks integration folder')
    .action(async(appName, options) => {
      try {
        const result = await handleSplitJsonCommand(appName, options);
        logSplitJsonResult(result);
      } catch (error) {
        handleCommandError(error, 'split-json');
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

  program.command('validate <appOrFile>')
    .description('Validate application or external integration file')
    .option('--type <type>', 'Application type (external) - if set, only checks integration folder')
    .action(async(appOrFile, options) => {
      try {
        const validate = require('./validation/validate');
        const result = await validate.validateAppOrFile(appOrFile, options);
        validate.displayValidationResults(result);
        if (!result.valid) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'validate');
        process.exit(1);
      }
    });

  program.command('diff <file1> <file2>')
    .description('Compare two configuration files (for deployment pipeline)')
    .action(async(file1, file2) => {
      try {
        const diff = require('./core/diff');
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
}

/**
 * Helper function to display developer configuration
 * @param {string} devId - Developer ID
 */
async function displayDevConfig(devId) {
  const devIdNum = parseInt(devId, 10);
  const ports = devConfig.getDevPorts(devIdNum);
  const configVars = [
    { key: 'aifabrix-home', value: await config.getAifabrixHomeOverride() },
    { key: 'aifabrix-secrets', value: await config.getAifabrixSecretsPath() },
    { key: 'aifabrix-env-config', value: await config.getAifabrixEnvConfigPath() }
  ].filter(v => v.value);

  logger.log('\n🔧 Developer Configuration\n');
  logger.log(`Developer ID: ${devId}`);
  logger.log('\nPorts:');
  logger.log(`  App: ${ports.app}`);
  logger.log(`  Postgres: ${ports.postgres}`);
  logger.log(`  Redis: ${ports.redis}`);
  logger.log(`  pgAdmin: ${ports.pgadmin}`);
  logger.log(`  Redis Commander: ${ports.redisCommander}`);

  if (configVars.length > 0) {
    logger.log('\nConfiguration:');
    configVars.forEach(v => logger.log(`  ${v.key}: ${v.value}`));
  }
  logger.log('');
}

/**
 * Sets up developer configuration commands
 * @param {Command} program - Commander program instance
 */
function setupDevCommands(program) {
  const dev = program
    .command('dev')
    .description('Developer configuration and isolation');

  dev
    .command('config')
    .description('Show or set developer configuration')
    .option('--set-id <id>', 'Set developer ID')
    .action(async(options) => {
      try {
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
          // Use the ID we just set instead of reading from file to avoid race conditions
          await displayDevConfig(setIdValue);
          return;
        }

        const devId = await config.getDeveloperId();
        await displayDevConfig(devId);
      } catch (error) {
        handleCommandError(error, 'dev config');
        process.exit(1);
      }
    });

  dev
    .command('set-id <id>')
    .description('Set developer ID (convenience alias for "dev config --set-id")')
    .action(async(id) => {
      try {
        const digitsOnly = /^[0-9]+$/.test(id);
        if (!digitsOnly) {
          throw new Error('Developer ID must be a non-negative digit string (0 = default infra, > 0 = developer-specific)');
        }
        // Preserve the original string value to maintain leading zeros (e.g., "01")
        await config.setDeveloperId(id);
        process.env.AIFABRIX_DEVELOPERID = id;
        logger.log(chalk.green(`✓ Developer ID set to ${id}`));
        // Use the ID we just set instead of reading from file to avoid race conditions
        await displayDevConfig(id);
      } catch (error) {
        handleCommandError(error, 'dev set-id');
        process.exit(1);
      }
    });
}

/**
 * Sets up secrets and security commands
 * @param {Command} program - Commander program instance
 */
function setupSecretsCommands(program) {
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

/**
 * Sets up external system commands
 * @param {Command} program - Commander program instance
 */
function setupExternalSystemCommands(program) {
  program.command('download <system-key>')
    .description('Download external system from dataplane to local development structure')
    .option('--dry-run', 'Show what would be downloaded without actually downloading')
    .action(async(systemKey, options) => {
      try {
        const download = require('./external-system/download');
        await download.downloadExternalSystem(systemKey, options);
      } catch (error) {
        handleCommandError(error, 'download');
        process.exit(1);
      }
    });

  program.command('delete <system-key>')
    .description('Delete external system from dataplane (also deletes all associated datasources)')
    .option('--type <type>', 'Application type (external) - required for external systems')
    .option('--yes', 'Skip confirmation prompt')
    .option('--force', 'Skip confirmation prompt (alias for --yes)')
    .action(async(systemKey, options) => {
      try {
        if (options.type !== 'external') {
          throw new Error('Delete command for external systems requires --type external');
        }
        const externalDelete = require('./external-system/delete');
        await externalDelete.deleteExternalSystem(systemKey, options);
      } catch (error) {
        handleCommandError(error, 'delete');
        process.exit(1);
      }
    });

  program.command('test <app>')
    .description('Run unit tests for external system (local validation, no API calls)')
    .option('-d, --datasource <key>', 'Test specific datasource only')
    .option('-v, --verbose', 'Show detailed validation output')
    .action(async(appName, options) => {
      try {
        const test = require('./external-system/test');
        const results = await test.testExternalSystem(appName, options);
        test.displayTestResults(results, options.verbose);
        if (!results.valid) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'test');
        process.exit(1);
      }
    });

  program.command('test-integration <app>')
    .description('Run integration tests via dataplane pipeline API')
    .option('-d, --datasource <key>', 'Test specific datasource only')
    .option('-p, --payload <file>', 'Path to custom test payload file')
    .option('-v, --verbose', 'Show detailed test output')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
    .action(async(appName, options) => {
      try {
        const test = require('./external-system/test');
        const results = await test.testExternalSystemIntegration(appName, options);
        test.displayIntegrationTestResults(results, options.verbose);
        if (!results.success) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'test-integration');
        process.exit(1);
      }
    });
}

/**
 * Sets up all CLI commands on the Commander program instance
 * @param {Command} program - Commander program instance
 */
function setupCommands(program) {
  setupInfraCommands(program);
  setupAuthCommands(program);
  setupAppCommands(program);
  setupEnvironmentCommands(program);
  setupAppManagementCommands(program);
  setupDatasourceCommands(program);
  setupUtilityCommands(program);
  setupExternalSystemCommands(program);
  setupDevCommands(program);
  setupSecretsCommands(program);
}

module.exports = {
  setupCommands,
  validateCommand,
  handleCommandError
};
