/**
 * AI Fabrix Builder - Datasource Commands
 *
 * Handles datasource validation, listing, comparison, deployment, and online validation runs.
 * Subcommands `test`, `test-integration`, and `test-e2e` call the dataplane unified validation API; permissions are summarized in `docs/commands/permissions.md`.
 *
 * @fileoverview Datasource management commands for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
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
  diff / upload                Compare files or deploy to dataplane
  test <key>                   Structural/policy validation via unified dataplane API (DatasourceTestRun)
  test-integration / test-e2e  Integration or E2E run via the same unified validation API
  log-integration / log-e2e    Show saved test logs
`;

const DATASOURCE_VALIDATE_HELP_AFTER = `
Examples:
  $ aifabrix datasource validate test-e2e-hubspot-users
  $ aifabrix datasource validate integration/myapp/myapp-datasource-contacts.json
  $ aifabrix datasource validate ./test-e2e-hubspot-datasource-users.json
  $ aifabrix datasource validate /path/to/system-datasource-entity.json
  $ af ds validate ../integration/hubspot/hubspot-datasource-deals.json
`;

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
        if (result.valid) {
          const shown = showMapping ? `${trimmed} → ${resolvedPath}` : resolvedPath;
          logger.log(chalk.green(`\n✓ Datasource file is valid: ${shown}`));
        } else {
          logger.log(chalk.red(`\n✗ Datasource file has errors: ${resolvedPath}`));
          result.errors.forEach(error => logger.log(chalk.red(`  • ${error}`)));
          process.exit(1);
        }
      } catch (error) {
        logger.error(chalk.red('✖ Validation failed:'), error.message);
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
        logger.error(chalk.red('✖ Failed to list datasources:'), error.message);
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
        logger.error(chalk.red('✖ Diff failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceUploadCommand(datasource) {
  datasource.command('upload <systemKey> <file>')
    .description('Deploy datasource file to dataplane')
    .action(async(myapp, file, options) => {
      try {
        await deployDatasource(myapp, file, options);
      } catch (error) {
        logger.error(chalk.red('✖ Upload failed:'), error.message);
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
        logger.error(chalk.red('✖ log-e2e failed:'), error.message);
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
        logger.error(chalk.red('✖ log-integration failed:'), error.message);
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
}

module.exports = { setupDatasourceCommands };

