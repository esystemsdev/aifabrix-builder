const { formatSuccessParagraph } = require('../utils/cli-test-layout-chalk');
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
const { setupInstallTestE2eLintCommands } = require('./setup-app.test-commands');

const CREATE_HELP_AFTER = `
Examples:
  # Builder app → builder/<appKey>/
  $ aifabrix create myapi --type webapp -l typescript
  $ aifabrix create mysvc --type api -l python

  # External system → integration/<systemKey>/ (default --type external)
  $ aifabrix create hubspot --wizard
  $ aifabrix create mycrm --type external --display-name "My CRM" --description "..." \\
      --system-type openapi --auth-type oauth2 --entity-type recordStorage --datasources 1

Positional: appKey for builder types; systemKey for --type external (folder under integration/).
Prefer aifabrix wizard [systemKey] for guided external setup.
`;

const DEPLOY_HELP_AFTER = `
Examples:
  $ aifabrix deploy myapp              # builder appKey → builder/myapp/
  $ aifabrix deploy hubspot --local    # systemKey → integration/hubspot/
`;

const PUSH_HELP_AFTER = `
Example:
  $ aifabrix push myapp -t v1.0.0
`;

const LOGS_HELP_AFTER = `
Examples:
  $ aifabrix logs miso-controller -l error
  $ aifabrix logs miso-controller -f
  $ aifabrix logs dataplane -l warn
  $ aifabrix logs dataplane -f -t 100
  $ aifabrix logs keycloak -f -t 0

Notes:
  - Platform apps use names such as miso-controller, dataplane, keycloak (see aifabrix run).
  - Use -t 0 (--tail 0) for the full buffered log; default is 100 lines.
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
  program.command('create <appKey|systemKey>')
    .description('Create builder app (builder/<appKey>/) or external system (integration/<systemKey>/; --type, flags, or --wizard)')
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
    .option('--wizard', 'Run wizard for external system (systemKey → integration/<systemKey>/; same as aifabrix wizard)')
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

Config path: When appName is provided, integration/<systemKey>/wizard.yaml is used for load/save and error.log.
To change settings after a run, edit that file and run "aifabrix wizard <app>" again.
Headless config must include: appName, mode (create-system|add-datasource), source (type + filePath/url/platform).
See integration/hubspot-test/wizard-hubspot-e2e.yaml for an example.`;
  program.command('wizard [appName]')
    .description('Guided external system setup (OpenAPI, MCP, HubSpot, …) or headless wizard.yaml')
    .option('-a, --app <app>', 'Application name (synonym for positional appName)')
    .option('--config <file>', 'Run headless using a wizard.yaml file (appName, mode, source, credential, preferences)')
    .option('--silent', 'Run with saved integration/<systemKey>/wizard.yaml only; no prompts (requires app name and existing wizard.yaml)')
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
In dev: use --reload for live code in the container. Before start, the CLI prints a "Reload (dev)" section: direct bind mount when the Docker engine is on this machine, or Mutagen when the engine is remote.
Examples:
  $ aifabrix run myapp
  $ aifabrix run myapp --env tst
  $ aifabrix run myapp --tag v1.0.0
  $ aifabrix run myapp --base
  $ aifabrix run myapp --reload
  $ aifabrix run myapp --no-proxy   # same as --proxy false: localhost for Docker declarative public URLs; saves applications.<app>.proxy: false`;
  program.command('run <appKey>')
    .description('Run builder app by appKey locally or on remote Docker host')
    .option('-p, --port <port>', 'Override local port')
    .option('-d, --debug', 'Enable debug output with detailed container information')
    .option('-t, --tag <tag>', 'Image tag to run (e.g. v1.0.0); overrides application.yaml image.tag')
    .option('-e, --env <env>', 'Environment: dev (default), tst, or pro', 'dev')
    .option('--base', 'Use manifest base image only (skip local developer-scoped tag preference)')
    .option('--reload', 'In dev: mount workspace into container (Mutagen only if docker-endpoint is a remote host)')
    .option(
      '--proxy',
      'Use Traefik/front-door public URL hints when infra has Traefik and application.yaml enables frontDoorRouting (default: on)',
      true
    )
    .option(
      '--no-proxy',
      'Docker declarative public url://* use localhost + published port (saves applications.<app>.proxy: false); overrides --proxy'
    )
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
  program.command('build <appKey>')
    .description('Build Docker image for builder appKey (auto-detect runtime)')
    .option('-l, --language <lang>', 'Override language detection')
    .option('-f, --force-template', 'Force rebuild from template')
    .option('--no-cache', 'Full Docker rebuild (disable layer cache); use after Dockerfile or context fixes')
    .option('-t, --tag <tag>', 'Image tag (default: latest). Set image.tag in application.yaml to match for deploy.')
    .option('--base', 'Also tag the manifest base image name (after developer-scoped build when developer id > 0)')
    .action(async(appName, options) => {
      try {
        const imageTag = await app.buildApp(appName, options);
        logger.log(`✔ Built image: ${imageTag}`);
      } catch (error) {
        handleCommandError(error, 'build');
        process.exit(1);
      }
    });

  registerRunCommand(program);

  program.command('logs <appKey>')
    .description('Tail container logs for appKey (optional env summary; secrets masked)')
    .option('-f', 'Follow log stream')
    .option('-t, --tail <lines>', 'Number of lines (default: 100); 0 = full list', '100')
    .option('-l, --level <level>', 'Show only logs at this level or above (debug|info|warn|error)')
    .addHelpText('after', LOGS_HELP_AFTER)
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

  program.command('down-app <appKey>')
    .description('Stop and remove container for appKey (--volumes removes data volume)')
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
  program.command('stop <appKey>')
    .description('Alias for down-app: stop and remove container for appKey')
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

  program.command('shell <appKey>')
    .description('Interactive shell in container for builder appKey')
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
}

function setupDockerfileGenerateCommand(program) {
  program.command('dockerfile <appKey>')
    .description('Generate Dockerfile for builder appKey from detected runtime')
    .option('-l, --language <lang>', 'Override language detection')
    .option('-f, --force', 'Overwrite existing Dockerfile')
    .action(async(appName, options) => {
      try {
        const dockerfilePath = await app.generateDockerfileForApp(appName, options);
        logger.log(formatSuccessParagraph('Dockerfile generated successfully!'));
        logger.log(chalk.gray(`Location: ${dockerfilePath}`));
      } catch (error) {
        handleCommandError(error, 'dockerfile');
        process.exit(1);
      }
    });
}

function setupPushDeployDockerfileCommands(program) {
  program.command('push <appKey>')
    .description('Push builder appKey image to Azure Container Registry')
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

  program.command('deploy <appKey|systemKey>')
    .description('Deploy builder app or external system via Miso Controller (Azure or --local)')
    .addHelpText('after', DEPLOY_HELP_AFTER)
    .option('--local', 'Send manifest to controller then run app locally (app: same as aifabrix run <app>; external: restart dataplane)')
    .option('--client-id <id>', 'Client ID (overrides config)')
    .option('--client-secret <secret>', 'Client Secret (overrides config)')
    .option('--repository-url <url>', 'Repository URL for pipeline validation (default: application.yaml repository.repositoryUrl, else https://github.com/aifabrix/<appKey>)')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .option('--probe', 'After external deploy, run dataplane runtime checks (validation/run); slower')
    .option('--probe-timeout <ms>', 'Timeout for --probe on external deploy (default: 120000)', '120000')
    .option(
      '--no-cert-sync',
      'Skip updating integration certification in the system file from the dataplane after external deploy'
    )
    .action(async(appName, options) => {
      try {
        const probeTimeout =
          options.probeTimeout === undefined || options.probeTimeout === null
            ? 120000
            : Number(options.probeTimeout);
        const opts = {
          ...options,
          local: !!options.local,
          probeTimeout: Number.isFinite(probeTimeout) ? probeTimeout : 120000
        };
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

  setupDockerfileGenerateCommand(program);
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
