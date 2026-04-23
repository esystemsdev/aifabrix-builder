/**
 * AI Fabrix Builder - Datasource Commands
 *
 * Handles datasource validation, listing, comparison, deployment, and online validation runs.
 * Subcommands `test`, `test-integration`, and `test-e2e` call the dataplane unified validation API; `log-test` / `log-integration` / `log-e2e` read saved debug JSON locally. Permissions are summarized in `docs/commands/permissions.md`.
 *
 * @fileoverview Datasource management commands for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { sectionTitle, headerKeyValue, metadata, formatSuccessLine, formatBlockingError } = require('../utils/cli-test-layout-chalk');
const { validateDatasourceFile } = require('../datasource/validate');
const { listDatasources } = require('../datasource/list');
const { compareDatasources } = require('../datasource/diff');
const { deployDatasource } = require('../datasource/deploy');
const { runLogViewer } = require('../datasource/log-viewer');
const {
  setupDatasourceTestCommand,
  setupDatasourceTestIntegrationCommand,
  setupDatasourceTestE2ECommand
} = require('./datasource-unified-test-cli');

const DATASOURCE_HELP_AFTER = `
Subcommands:
  validate <file-or-key>       Validate datasource JSON (path or datasource key under integration/<app>/)
  list                         List datasources (env from config)
  upload <file-or-key>         Deploy one datasource JSON to the dataplane (path or key; systemKey in file)
  diff                         Compare two datasource JSON files
  test <key>                   Structural/policy validation via unified dataplane API (DatasourceTestRun)
  test-integration / test-e2e  Integration or E2E run via the same unified validation API
  log-test / log-integration / log-e2e  Show saved debug logs (structural, integration, E2E)
`;

const DATASOURCE_VALIDATE_HELP_AFTER = `
Examples:
  $ aifabrix datasource validate test-e2e-hubspot-users
  $ aifabrix datasource validate integration/myapp/myapp-datasource-contacts.json
  $ aifabrix datasource validate ./test-e2e-hubspot-datasource-users.json
  $ aifabrix datasource validate /path/to/system-datasource-entity.json
  $ af ds validate ../integration/hubspot/hubspot-datasource-deals.json
`;

const DATASOURCE_UPLOAD_HELP_AFTER = `
Examples:
  $ aifabrix datasource upload test-e2e-hubspot-users
  $ aifabrix datasource upload integration/myapp/myapp-datasource-contacts.json
  $ aifabrix datasource upload ./test-e2e-hubspot-datasource-users.json
  $ aifabrix datasource upload /path/to/system-datasource-entity.json
  $ af ds upload ../integration/hubspot/hubspot-datasource-deals.json
`;

/**
 * TTY layout for local datasource JSON validation (aligned with cli-test-layout-chalk).
 * @param {{ valid: boolean, errors: string[], resolvedPath: string }} result
 * @param {string} trimmed - original CLI argument
 * @param {boolean} showMapping - show Key + File when key resolved to a path
 */
function logDatasourceValidateOutcome(result, trimmed, showMapping) {
  logger.log('');
  logger.log(sectionTitle('Datasource validation'));
  logger.log(metadata('Offline — JSON schema and integration wiring'));
  logger.log('');
  if (!result.valid) {
    logger.log(headerKeyValue('File:', result.resolvedPath));
    logger.log('');
    logger.log(formatBlockingError('Datasource file has errors:'));
    result.errors.forEach(error => logger.log(chalk.red(`  • ${error}`)));
    return;
  }
  if (showMapping) {
    logger.log(headerKeyValue('Key:', trimmed));
    logger.log(headerKeyValue('File:', result.resolvedPath));
  } else {
    logger.log(headerKeyValue('File:', result.resolvedPath));
  }
  logger.log('');
  logger.log(formatSuccessLine('Datasource file is valid.'));
}

function setupDatasourceValidateCommand(datasource) {
  datasource.command('validate <file-or-key>')
    .description('Validate datasource JSON (file path or datasource key under integration/<app>/)')
    .addHelpText('after', DATASOURCE_VALIDATE_HELP_AFTER)
    .action(async(fileOrKey) => {
      try {
        const trimmed = fileOrKey.trim();
        const result = await validateDatasourceFile(trimmed);
        const resolvedPath = result.resolvedPath;
        const argResolved = path.resolve(trimmed);
        const showMapping = resolvedPath && argResolved !== resolvedPath && trimmed !== resolvedPath;
        logDatasourceValidateOutcome(result, trimmed, showMapping);
        if (!result.valid) {
          process.exit(1);
        }
      } catch (error) {
        logger.error(formatBlockingError('Validation failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceListCommand(datasource) {
  datasource.command('list')
    .description('List datasources for environment in config')
    .action(async() => {
      try {
        await listDatasources({});
      } catch (error) {
        logger.error(formatBlockingError('Failed to list datasources:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceDiffCommand(datasource) {
  datasource.command('diff <file1> <file2>')
    .description('Diff two datasource JSON files')
    .action(async(file1, file2) => {
      try {
        await compareDatasources(file1, file2);
      } catch (error) {
        logger.error(formatBlockingError('Diff failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceUploadCommand(datasource) {
  datasource.command('upload <file-or-key>')
    .description('Deploy datasource JSON to dataplane (file path or datasource key under integration/<app>/)')
    .addHelpText('after', DATASOURCE_UPLOAD_HELP_AFTER)
    .action(async(fileOrKey, options) => {
      try {
        await deployDatasource(fileOrKey, options);
      } catch (error) {
        logger.error(formatBlockingError('Upload failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceLogE2ECommand(datasource) {
  datasource.command('log-e2e <datasourceKey>')
    .description('Show E2E test log (latest or --file)')
    .option(
      '-a, --app <app>',
      'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
    .option('-f, --file <path>', 'Path to log file (default: latest in app logs folder)')
    .action(async(datasourceKey, options) => {
      try {
        await runLogViewer(datasourceKey, {
          app: options.app,
          file: options.file,
          logType: 'test-e2e'
        });
      } catch (error) {
        logger.error(formatBlockingError('log-e2e failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceLogIntegrationCommand(datasource) {
  datasource.command('log-integration <datasourceKey>')
    .description('Show integration test log (latest or --file)')
    .option(
      '-a, --app <app>',
      'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
    .option('-f, --file <path>', 'Path to log file (default: latest in app logs folder)')
    .action(async(datasourceKey, options) => {
      try {
        await runLogViewer(datasourceKey, {
          app: options.app,
          file: options.file,
          logType: 'test-integration'
        });
      } catch (error) {
        logger.error(formatBlockingError('log-integration failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceLogTestCommand(datasource) {
  datasource.command('log-test <datasourceKey>')
    .description('Show structural validation log from datasource test (latest test-*.json or --file)')
    .option(
      '-a, --app <app>',
      'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
    .option('-f, --file <path>', 'Path to log file (default: latest structural log in app logs folder)')
    .action(async(datasourceKey, options) => {
      try {
        await runLogViewer(datasourceKey, {
          app: options.app,
          file: options.file,
          logType: 'test'
        });
      } catch (error) {
        logger.error(formatBlockingError('log-test failed:'), error.message);
        process.exit(1);
      }
    });
}

/**
 * Setup datasource management commands
 * @param {Command} program - Commander program instance
 */
function setupDatasourceCommands(program) {
  const datasource = program
    .command('datasource')
    .description('Datasource JSON: validate, list, deploy, test, logs')
    .addHelpText('after', DATASOURCE_HELP_AFTER);
  if (typeof datasource.alias === 'function') {
    datasource.alias('ds');
  }
  setupDatasourceValidateCommand(datasource);
  setupDatasourceListCommand(datasource);
  setupDatasourceDiffCommand(datasource);
  setupDatasourceUploadCommand(datasource);
  setupDatasourceTestCommand(datasource);
  setupDatasourceTestIntegrationCommand(datasource);
  setupDatasourceTestE2ECommand(datasource);
  setupDatasourceLogE2ECommand(datasource);
  setupDatasourceLogIntegrationCommand(datasource);
  setupDatasourceLogTestCommand(datasource);
}

module.exports = { setupDatasourceCommands };

