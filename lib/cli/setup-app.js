/**
 * CLI application lifecycle command setup (create, wizard, build, run, push, deploy, dockerfile).
 *
 * @fileoverview Application command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const path = require('path');
const app = require('../app');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');

/**
 * Normalize options for external system creation
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
    const { handleWizard } = require('../commands/wizard');
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

  program.command('wizard [appName]')
    .description('Create or extend external systems (OpenAPI, MCP, or known platforms like HubSpot) via guided steps or a config file')
    .option('-a, --app <app>', 'Application name (synonym for positional appName)')
    .option('--config <file>', 'Run headless using a wizard.yaml file (appName, mode, source, credential, preferences)')
    .option('--silent', 'Run with saved integration/<app>/wizard.yaml only; no prompts (requires app name and existing wizard.yaml)')
    .addHelpText('after', `
Examples:
  $ aifabrix wizard                    Run interactively (mode first, then prompts)
  $ aifabrix wizard my-integration      Load wizard.yaml if present → show summary → "Run with saved config?" or start from step 1
  $ aifabrix wizard my-integration --silent  Run headless with integration/my-integration/wizard.yaml (no prompts)
  $ aifabrix wizard -a my-integration   Same as above (app name set)
  $ aifabrix wizard --config wizard.yaml  Run headless from a wizard config file

Config path: When appName is provided, integration/<appName>/wizard.yaml is used for load/save and error.log.
To change settings after a run, edit that file and run "aifabrix wizard <app>" again.
Headless config must include: appName, mode (create-system|add-datasource), source (type + filePath/url/platform).
See integration/hubspot/wizard-hubspot-e2e.yaml for an example.`)
    .action(async(positionalAppName, options) => {
      try {
        const appName = positionalAppName || options.app;
        const configPath = appName ? path.join(process.cwd(), 'integration', appName, 'wizard.yaml') : null;
        const { handleWizard } = require('../commands/wizard');
        await handleWizard({ ...options, app: appName, config: options.config, configPath });
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
    .option('-t, --tag <tag>', 'Image tag to run (e.g. v1.0.0); overrides variables.yaml image.tag')
    .action(async(appName, options) => {
      try {
        await app.runApp(appName, options);
      } catch (error) {
        handleCommandError(error, 'run');
        process.exit(1);
      }
    });

  program.command('logs <app>')
    .description('Show application container logs (and optional env summary with secrets masked)')
    .option('-f', 'Follow log stream')
    .option('-t, --tail <lines>', 'Number of lines (default: 100); 0 = full list', '100')
    .option('-l, --level <level>', 'Show only logs at this level or above (debug|info|warn|error)')
    .action(async(appName, options) => {
      try {
        const { runAppLogs } = require('../commands/app-logs');
        const tailNum = parseInt(options.tail, 10);
        const level = options.level !== undefined && options.level !== null && options.level !== '' ? String(options.level).trim() : undefined;
        await runAppLogs(appName, {
          follow: options.f,
          tail: Number.isNaN(tailNum) ? 100 : tailNum,
          level
        });
      } catch (error) {
        handleCommandError(error, 'logs');
        process.exit(1);
      }
    });

  program.command('down-app <app>')
    .description('Stop and remove application container; optionally remove volume and image')
    .option('--volumes', 'Remove application Docker volume')
    .action(async(appName, options) => {
      try {
        const { runDownAppWithImageRemoval } = require('../commands/app-down');
        await runDownAppWithImageRemoval(appName, { volumes: options.volumes });
      } catch (error) {
        handleCommandError(error, 'down-app');
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
    .option('--deployment <target>', 'Deployment target: \'local\' (send manifest to controller, then run app locally) or \'cloud\' (deploy via Miso Controller only)', 'cloud')
    .option('--type <type>', 'Application type: external to deploy from integration/<app> (no app register needed)')
    .option('--client-id <id>', 'Client ID (overrides config)')
    .option('--client-secret <secret>', 'Client Secret (overrides config)')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .action(async(appName, options) => {
      try {
        const target = (options.deployment || 'cloud').toLowerCase();
        if (target !== 'local' && target !== 'cloud') {
          throw new Error('Deployment target must be \'local\' or \'cloud\'');
        }
        await app.deployApp(appName, options);
        if (target === 'local') {
          await app.runApp(appName, options);
        }
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

module.exports = { setupAppCommands };
