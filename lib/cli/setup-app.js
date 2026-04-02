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

const CREATE_HELP_AFTER = `
Examples:
  $ aifabrix create myapi --type webapp -l typescript
  $ aifabrix create mycrm --wizard
`;

const DEPLOY_HELP_AFTER = `
Examples:
  $ aifabrix deploy myapp
  $ aifabrix deploy myext --local
`;

const PUSH_HELP_AFTER = `
Example:
  $ aifabrix push myapp -t v1.0.0
`;

/**
 * Normalize options for external system creation
 * @param {Object} options - Raw CLI options
 * @returns {Object} Normalized options
 */
const VALID_ENTITY_TYPES = ['recordStorage', 'documentStorage', 'vectorStore', 'messageService', 'none'];

function normalizeExternalOptions(options) {
  const normalized = { ...options };
  if (options.displayName) normalized.systemDisplayName = options.displayName;
  if (options.description) normalized.systemDescription = options.description;
  if (options.systemType) normalized.systemType = options.systemType;
  if (options.authType) normalized.authType = options.authType;
  if (options.entityType) {
    if (!VALID_ENTITY_TYPES.includes(options.entityType)) {
      throw new Error(`Invalid --entity-type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
    }
    normalized.entityType = options.entityType;
  }
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
  if (!normalizedOptions.entityType) missing.push('--entity-type');
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

  const isExternalType = options.type === 'external' || !options.type;
  const isNonInteractive = process.stdin && process.stdin.isTTY === false;

  if (isExternalType && !options.wizard && isNonInteractive) {
    validateNonInteractiveExternalOptions(normalizedOptions);
  }

  const shouldUseWizard = options.wizard && (options.type === 'external' || !options.type);
  if (shouldUseWizard) {
    const { handleWizard } = require('../commands/wizard');
    await handleWizard(wizardOptions);
  } else {
    await app.createApp(appName, normalizedOptions);
  }
}

function setupCreateCommand(program) {
  program.command('create <app>')
    .description('Scaffold builder or external app (flags or --wizard)')
    .addHelpText('after', CREATE_HELP_AFTER)
    .option('-p, --port <port>', 'Application port', '3000')
    .option('-d, --database', 'Requires database')
    .option('-r, --redis', 'Requires Redis')
    .option('-s, --storage', 'Requires file storage')
    .option('-a, --authentication', 'Requires authentication/RBAC')
    .option('-l, --language <lang>', 'Runtime language (typescript/python)')
    .option('-t, --template <name>', 'Template to use (e.g., miso-controller, keycloak)')
    .option('--type <type>', 'Application type (webapp, api, service, functionapp, external)', 'external')
    .option('--app', 'Generate minimal application files (package.json, index.ts or requirements.txt, main.py)')
    .option('-g, --github', 'Generate GitHub Actions workflows')
    .option('--github-steps <steps>', 'Extra GitHub workflow steps (comma-separated, e.g., npm,test)')
    .option('--main-branch <branch>', 'Main branch name for workflows', 'main')
    .option('--wizard', 'Use interactive wizard for external system creation')
    .option('--display-name <name>', 'External system display name')
    .option('--description <desc>', 'External system description')
    .option('--system-type <type>', 'External system type (openapi, mcp, custom)')
    .option('--auth-type <type>', 'External system auth type (oauth2, aad, apikey, basic, queryParam, oidc, hmac, none)')
    .option('--entity-type <type>', 'Entity type for datasources (recordStorage, documentStorage, vectorStore, messageService, none)')
    .option('--datasources <count>', 'Number of datasources to create')
    .action(async(appName, options) => {
      try {
        await handleCreateCommand(appName, options);
      } catch (error) {
        handleCommandError(error, 'create');
        process.exit(1);
      }
    });
}

function setupWizardCommand(program) {
  const wizardHelp = `
Examples:
  $ aifabrix wizard                    Run interactively (mode first, then prompts)
  $ aifabrix wizard my-integration      Load wizard.yaml if present → show summary → "Run with saved config?" or start from step 1
  $ aifabrix wizard my-integration --silent  Run headless with integration/my-integration/wizard.yaml (no prompts)
  $ aifabrix wizard -a my-integration   Same as above (app name set)
  $ aifabrix wizard --config wizard.yaml  Run headless from a wizard config file
  $ aifabrix wizard hubspot-test --debug  Enable debug output and save debug manifests on validation failure

Config path: When appName is provided, integration/<appName>/wizard.yaml is used for load/save and error.log.
To change settings after a run, edit that file and run "aifabrix wizard <app>" again.
Headless config must include: appName, mode (create-system|add-datasource), source (type + filePath/url/platform).
See integration/hubspot-test/wizard-hubspot-e2e.yaml for an example.`;
  program.command('wizard [appName]')
    .description('Guided external system setup (OpenAPI, MCP, HubSpot, …) or headless wizard.yaml')
    .option('-a, --app <app>', 'Application name (synonym for positional appName)')
    .option('--config <file>', 'Run headless using a wizard.yaml file (appName, mode, source, credential, preferences)')
    .option('--silent', 'Run with saved integration/<app>/wizard.yaml only; no prompts (requires app name and existing wizard.yaml)')
    .option('--debug', 'Enable debug output and save debug manifests on validation failure')
    .addHelpText('after', wizardHelp)
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
}

function registerRunCommand(program) {
  const runHelp = `
In dev: use --reload for sync and mount (requires remote server with Mutagen, or local Docker).
Examples:
  $ aifabrix run myapp
  $ aifabrix run myapp --env tst
  $ aifabrix run myapp --reload`;
  program.command('run <app>')
    .description('Run app locally or on remote Docker host')
    .option('-p, --port <port>', 'Override local port')
    .option('-d, --debug', 'Enable debug output with detailed container information')
    .option('-t, --tag <tag>', 'Image tag to run (e.g. v1.0.0); overrides application.yaml image.tag')
    .option('-e, --env <env>', 'Environment: dev (default), tst, or pro', 'dev')
    .option('--reload', 'In dev: use sync and mount (requires remote server; Mutagen or local Docker)')
    .addHelpText('after', runHelp)
    .action(async(appName, options) => {
      try {
        await app.runApp(appName, options);
      } catch (error) {
        handleCommandError(error, 'run');
        process.exit(1);
      }
    });
}

function setupBuildRunLogsDownCommands(program) {
  program.command('build <app>')
    .description('Build Docker image (auto-detect runtime)')
    .option('-l, --language <lang>', 'Override language detection')
    .option('-f, --force-template', 'Force rebuild from template')
    .option('-t, --tag <tag>', 'Image tag (default: latest). Set image.tag in application.yaml to match for deploy.')
    .action(async(appName, options) => {
      try {
        const imageTag = await app.buildApp(appName, options);
        logger.log(`✅ Built image: ${imageTag}`);
      } catch (error) {
        handleCommandError(error, 'build');
        process.exit(1);
      }
    });

  registerRunCommand(program);

  program.command('logs <app>')
    .description('Tail app container logs (optional env summary; secrets masked)')
    .option('-f', 'Follow log stream')
    .option('-t, --tail <lines>', 'Number of lines (default: 100); 0 = full list', '100')
    .option('-l, --level <level>', 'Show only logs at this level or above (debug|info|warn|error)')
    .action(async(appName, options) => {
      try {
        const { runAppLogs } = require('../commands/app-logs');
        const tailNum = parseInt(options.tail, 10);
        const level = options.level !== undefined && options.level !== null && options.level !== '' ? String(options.level).trim() : undefined;
        await runAppLogs(appName, { follow: options.f, tail: Number.isNaN(tailNum) ? 100 : tailNum, level });
      } catch (error) {
        handleCommandError(error, 'logs');
        process.exit(1);
      }
    });

  program.command('down-app <app>')
    .description('Stop and remove app container (--volumes removes data volume)')
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
}

function setupShellTestStopCommands(program) {
  program.command('stop <app>')
    .description('Alias for down-app: stop and remove container')
    .option('--volumes', 'Remove application Docker volume')
    .action(async(appName, options) => {
      try {
        const { runDownAppWithImageRemoval } = require('../commands/app-down');
        await runDownAppWithImageRemoval(appName, { volumes: options.volumes });
      } catch (error) {
        handleCommandError(error, 'stop');
        process.exit(1);
      }
    });

  program.command('shell <app>')
    .description('Interactive shell in running or ephemeral container')
    .option('--env <env>', 'Environment (dev|tst); dev uses running container', 'dev')
    .action(async(appName, options) => {
      try {
        const { runAppShell } = require('../commands/app-shell');
        await runAppShell(appName, { env: options.env });
      } catch (error) {
        handleCommandError(error, 'shell');
        process.exit(1);
      }
    });

  program.command('test <app>')
    .description('Tests: builder in container; external = local validation')
    .option('--env <env>', 'For builder app: dev (running container) or tst (ephemeral)', 'dev')
    .option('-d, --datasource <key>', 'For external system: test specific datasource only')
    .option('-v, --verbose', 'Verbose output')
    .action(async(appName, options) => {
      try {
        const pathsUtil = require('../utils/paths');
        const appType = await pathsUtil.detectAppType(appName).catch(() => null);
        if (appType && appType.baseDir === 'integration') {
          const test = require('../external-system/test');
          const results = await test.testExternalSystem(appName, options);
          test.displayTestResults(results, options.verbose);
          if (!results.valid) process.exit(1);
        } else {
          const { runAppTest } = require('../commands/app-test');
          await runAppTest(appName, { env: options.env });
        }
      } catch (error) {
        handleCommandError(error, 'test');
        process.exit(1);
      }
    });
}

async function runTestE2ECommand(appName, options) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(appName).catch(() => null);
  if (appType && appType.baseDir === 'integration') {
    const { runTestE2EForExternalSystem } = require('../commands/test-e2e-external');
    const { success, results } = await runTestE2EForExternalSystem(appName, {
      env: options.env,
      debug: options.debug,
      verbose: options.verbose,
      async: options.async !== false
    });
    results.forEach(r => {
      const icon = r.success ? chalk.green('✓') : chalk.red('✗');
      const msg = r.error ? `${r.key}: ${r.error}` : r.key;
      logger.log(`  ${icon} ${msg}`);
    });
    if (!success) process.exit(1);
    return;
  }
  const { runAppTestE2e } = require('../commands/app-test');
  await runAppTestE2e(appName, { env: options.env });
}

function setupInstallTestE2eLintCommands(program) {
  program.command('install <app>')
    .description('Install deps in container (builder apps only)')
    .option('--env <env>', 'dev (running container) or tst (ephemeral with .env)', 'dev')
    .action(async(appName, options) => {
      try {
        const pathsUtil = require('../utils/paths');
        const appType = await pathsUtil.detectAppType(appName).catch(() => null);
        if (appType && appType.baseDir === 'integration') {
          logger.log(chalk.gray('Install is for builder applications only. Use aifabrix shell <app> to run commands in external setups.'));
          return;
        }
        const { runAppInstall } = require('../commands/app-install');
        await runAppInstall(appName, { env: options.env });
      } catch (error) {
        handleCommandError(error, 'install');
        process.exit(1);
      }
    });

  program.command('test-e2e <app>')
    .description('E2E: builder in container; external = all datasources via dataplane')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro (builder: dev/tst for container)')
    .option('-v, --verbose', 'Show detailed step output and poll progress')
    .option('--debug', 'Include debug output and write log to integration/<app>/logs/')
    .option('--no-async', 'Use sync mode (no polling); single POST per datasource')
    .action(async(appName, options) => {
      try {
        await runTestE2ECommand(appName, options);
      } catch (error) {
        handleCommandError(error, 'test-e2e');
        process.exit(1);
      }
    });

  program.command('lint <app>')
    .description('Lint in container (builder apps only)')
    .option('--env <env>', 'dev (running container) or tst (ephemeral with .env)', 'dev')
    .action(async(appName, options) => {
      try {
        const pathsUtil = require('../utils/paths');
        const appType = await pathsUtil.detectAppType(appName).catch(() => null);
        if (appType && appType.baseDir === 'integration') {
          logger.log(chalk.gray('lint is for builder applications only. Use aifabrix shell <app> then make lint or pnpm lint.'));
          return;
        }
        const { runAppLint } = require('../commands/app-test');
        await runAppLint(appName, { env: options.env });
      } catch (error) {
        handleCommandError(error, 'lint');
        process.exit(1);
      }
    });
}

function setupPushDeployDockerfileCommands(program) {
  program.command('push <app>')
    .description('Push image to Azure Container Registry')
    .addHelpText('after', PUSH_HELP_AFTER)
    .option('-r, --registry <registry>', 'ACR registry URL (overrides application.yaml)')
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
    .description('Deploy via Miso Controller (Azure or --local)')
    .addHelpText('after', DEPLOY_HELP_AFTER)
    .option('--local', 'Send manifest to controller then run app locally (app: same as aifabrix run <app>; external: restart dataplane)')
    .option('--client-id <id>', 'Client ID (overrides config)')
    .option('--client-secret <secret>', 'Client Secret (overrides config)')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .action(async(appName, options) => {
      try {
        const opts = { ...options, local: !!options.local };
        const outcome = await app.deployApp(appName, opts);
        if (opts.local && outcome) {
          if (outcome.usedExternalDeploy) await app.restartApp('dataplane');
          else await app.runApp(appName, opts);
        }
      } catch (error) {
        handleCommandError(error, 'deploy');
        process.exit(1);
      }
    });

  program.command('dockerfile <app>')
    .description('Generate Dockerfile from detected runtime')
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
 * Sets up application lifecycle commands
 * @param {Command} program - Commander program instance
 */
function setupAppCommands(program) {
  setupCreateCommand(program);
  setupWizardCommand(program);
  setupBuildRunLogsDownCommands(program);
  setupShellTestStopCommands(program);
  setupInstallTestE2eLintCommands(program);
  setupPushDeployDockerfileCommands(program);
}

module.exports = { setupAppCommands };
